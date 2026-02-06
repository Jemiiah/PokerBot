// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPokerGame4Max.sol";
import "../interfaces/IEscrow4Max.sol";
import "../libraries/HandEvaluator.sol";
import "../libraries/DeckUtils.sol";

/// @title Poker Game 4-Max
/// @notice Texas Hold'em poker game supporting 2-4 players per table
contract PokerGame4Max is IPokerGame4Max {
    using HandEvaluator for uint8[7];

    address public escrowContract;
    address public owner;

    mapping(bytes32 => Game) public games;
    bytes32[] public activeGameIds;
    mapping(bytes32 => bytes32) public deckSeeds;
    mapping(bytes32 => SidePot[]) public sidePots;

    uint256 public constant MIN_WAGER = 0.001 ether;
    uint256 public constant DEFAULT_TIMEOUT = 120; // 2 minutes

    // Blinds (relative to wager)
    uint256 public constant SMALL_BLIND_PERCENT = 1; // 1% of wager
    uint256 public constant BIG_BLIND_PERCENT = 2;   // 2% of wager

    error GameNotFound();
    error GameNotActive();
    error NotYourTurn();
    error InvalidAction();
    error InvalidAmount();
    error GameFull();
    error InsufficientWager();
    error AlreadyRevealed();
    error InvalidReveal();
    error TimeoutNotReached();
    error GameAlreadyComplete();
    error Unauthorized();
    error InvalidPlayerCount();
    error NotEnoughPlayers();
    error GameAlreadyStarted();
    error AlreadyInGame();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier gameExists(bytes32 gameId) {
        if (!games[gameId].isActive && games[gameId].phase == GamePhase.COMPLETE) {
            // Game completed, allow viewing
        } else if (games[gameId].players[0].wallet == address(0)) {
            revert GameNotFound();
        }
        _;
    }

    modifier gameActive(bytes32 gameId) {
        if (!games[gameId].isActive) revert GameNotActive();
        _;
    }

    constructor(address _escrow) {
        escrowContract = _escrow;
        owner = msg.sender;
    }

    /// @notice Create a new poker game
    /// @param cardCommitment Commitment hash for player's hole cards
    /// @param minPlayers Minimum players to start (2-4)
    /// @param maxPlayers Maximum players allowed (2-4)
    /// @return gameId The unique game identifier
    function createGame(
        bytes32 cardCommitment,
        uint8 minPlayers,
        uint8 maxPlayers
    ) external payable override returns (bytes32 gameId) {
        if (msg.value < MIN_WAGER) revert InsufficientWager();
        if (minPlayers < 2 || minPlayers > 4) revert InvalidPlayerCount();
        if (maxPlayers < minPlayers || maxPlayers > 4) revert InvalidPlayerCount();

        gameId = keccak256(abi.encodePacked(msg.sender, block.timestamp, block.prevrandao));

        Game storage game = games[gameId];
        game.gameId = gameId;
        game.players[0].wallet = msg.sender;
        game.players[0].chips = msg.value;
        game.players[0].cardCommitment = cardCommitment;
        game.playerCount = 1;
        game.minPlayers = minPlayers;
        game.maxPlayers = maxPlayers;
        game.phase = GamePhase.WAITING;
        game.timeoutDuration = DEFAULT_TIMEOUT;
        game.lastActionTime = block.timestamp;
        game.isActive = true;

        activeGameIds.push(gameId);

        // Deposit to escrow
        IEscrow4Max(escrowContract).deposit{value: msg.value}(gameId, msg.sender);

        emit GameCreated(gameId, msg.sender, msg.value, minPlayers, maxPlayers);
        return gameId;
    }

    /// @notice Join an existing game
    /// @param gameId The game to join
    /// @param cardCommitment Commitment hash for player's hole cards
    function joinGame(bytes32 gameId, bytes32 cardCommitment) external payable override gameExists(gameId) {
        Game storage game = games[gameId];

        if (game.phase != GamePhase.WAITING) revert GameAlreadyStarted();
        if (game.playerCount >= game.maxPlayers) revert GameFull();
        if (msg.value != game.players[0].chips) revert InvalidAmount();

        // Check if player is already in the game
        for (uint8 i = 0; i < game.playerCount; i++) {
            if (game.players[i].wallet == msg.sender) revert AlreadyInGame();
        }

        uint8 playerIndex = game.playerCount;
        game.players[playerIndex].wallet = msg.sender;
        game.players[playerIndex].chips = msg.value;
        game.players[playerIndex].cardCommitment = cardCommitment;
        game.playerCount++;

        // Deposit to escrow
        IEscrow4Max(escrowContract).deposit{value: msg.value}(gameId, msg.sender);

        emit PlayerJoined(gameId, msg.sender, playerIndex);

        // Auto-start if we've reached max players
        if (game.playerCount >= game.maxPlayers) {
            _startGame(gameId);
        }
    }

    /// @notice Manually start the game (if min players reached)
    /// @param gameId The game to start
    function startGame(bytes32 gameId) external override gameExists(gameId) {
        Game storage game = games[gameId];

        if (game.phase != GamePhase.WAITING) revert GameAlreadyStarted();
        if (game.playerCount < game.minPlayers) revert NotEnoughPlayers();

        // Only creator can manually start
        if (game.players[0].wallet != msg.sender) revert Unauthorized();

        _startGame(gameId);
    }

    /// @notice Take an action in the game
    /// @param gameId The game identifier
    /// @param action The action to take
    /// @param raiseAmount Amount to raise (if raising)
    function takeAction(
        bytes32 gameId,
        Action action,
        uint256 raiseAmount
    ) external override gameActive(gameId) {
        Game storage game = games[gameId];

        uint8 playerIndex = _getPlayerIndex(game, msg.sender);
        if (playerIndex != game.activePlayerIndex) revert NotYourTurn();

        Player storage player = game.players[playerIndex];

        if (player.folded) revert InvalidAction();

        uint256 toCall = game.currentBet > player.currentBet
            ? game.currentBet - player.currentBet
            : 0;

        if (action == Action.FOLD) {
            player.folded = true;
            emit ActionTaken(gameId, msg.sender, action, 0);

            // Check if only one player remains
            if (_countActivePlayers(game) == 1) {
                address winner = _getLastActivePlayer(game);
                _endGame(gameId, winner);
                return;
            }
        } else if (action == Action.CHECK) {
            if (toCall > 0) revert InvalidAction(); // Can't check if there's a bet
            emit ActionTaken(gameId, msg.sender, action, 0);
        } else if (action == Action.CALL) {
            if (toCall == 0) revert InvalidAction(); // Nothing to call
            if (toCall >= player.chips) {
                // All-in call
                game.mainPot += player.chips;
                player.currentBet += player.chips;
                player.chips = 0;
                player.isAllIn = true;
            } else {
                player.chips -= toCall;
                player.currentBet += toCall;
                game.mainPot += toCall;
            }
            emit ActionTaken(gameId, msg.sender, action, toCall);
        } else if (action == Action.RAISE) {
            if (raiseAmount < game.currentBet * 2) revert InvalidAmount(); // Min raise is 2x
            uint256 totalNeeded = raiseAmount - player.currentBet;
            if (totalNeeded > player.chips) revert InvalidAmount();

            player.chips -= totalNeeded;
            player.currentBet = raiseAmount;
            game.currentBet = raiseAmount;
            game.mainPot += totalNeeded;
            game.lastRaiserIndex = playerIndex;
            game.actionsThisRound = 0; // Reset action counter on raise
            emit ActionTaken(gameId, msg.sender, action, raiseAmount);
        } else if (action == Action.ALL_IN) {
            uint256 allInAmount = player.chips;
            game.mainPot += allInAmount;
            player.currentBet += allInAmount;
            player.chips = 0;
            player.isAllIn = true;

            if (player.currentBet > game.currentBet) {
                game.currentBet = player.currentBet;
                game.lastRaiserIndex = playerIndex;
                game.actionsThisRound = 0;
            }
            emit ActionTaken(gameId, msg.sender, action, allInAmount);
        }

        game.lastActionTime = block.timestamp;
        game.actionsThisRound++;

        // Move to next player or advance phase
        if (!player.folded) {
            _moveToNextPlayer(gameId);
        } else {
            _moveToNextPlayer(gameId);
        }
    }

    /// @notice Reveal hole cards at showdown
    /// @param gameId The game identifier
    /// @param cards The player's hole cards
    /// @param salt The salt used in the commitment
    function revealCards(
        bytes32 gameId,
        uint8[2] calldata cards,
        bytes32 salt
    ) external override gameExists(gameId) {
        Game storage game = games[gameId];

        if (game.phase != GamePhase.SHOWDOWN) revert InvalidAction();

        uint8 playerIndex = _getPlayerIndex(game, msg.sender);
        Player storage player = game.players[playerIndex];

        if (player.revealed) revert AlreadyRevealed();
        if (player.folded) revert InvalidAction();

        // Verify commitment
        bytes32 commitment = DeckUtils.createCommitment(cards, salt);
        if (commitment != player.cardCommitment) revert InvalidReveal();

        player.holeCards = cards;
        player.revealed = true;

        emit CardsRevealed(gameId, msg.sender, cards);

        // Check if all active players revealed
        if (_allActivePlayersRevealed(game)) {
            _determineWinner(gameId);
        }
    }

    /// @notice Claim win due to opponent timeout
    /// @param gameId The game identifier
    function claimTimeout(bytes32 gameId) external override gameActive(gameId) {
        Game storage game = games[gameId];

        if (block.timestamp < game.lastActionTime + game.timeoutDuration) {
            revert TimeoutNotReached();
        }

        uint8 playerIndex = _getPlayerIndex(game, msg.sender);

        // If it's not our turn, the active player timed out, we can claim
        if (game.activePlayerIndex != playerIndex) {
            _endGame(gameId, msg.sender);
        }
    }

    /// @notice Get game details
    /// @param gameId The game identifier
    /// @return The game struct
    function getGame(bytes32 gameId) external view override returns (Game memory) {
        return games[gameId];
    }

    /// @notice Get all active game IDs
    /// @return Array of active game IDs
    function getActiveGames() external view override returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeGameIds.length; i++) {
            if (games[activeGameIds[i]].isActive) {
                count++;
            }
        }

        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < activeGameIds.length; i++) {
            if (games[activeGameIds[i]].isActive) {
                result[idx++] = activeGameIds[i];
            }
        }

        return result;
    }

    /// @notice Set deck seed for a game
    /// @param gameId The game identifier
    /// @param seed The combined seed for deck shuffling
    function setDeckSeed(bytes32 gameId, bytes32 seed) external onlyOwner {
        deckSeeds[gameId] = seed;
    }

    // ============ Internal Functions ============

    function _startGame(bytes32 gameId) internal {
        Game storage game = games[gameId];

        game.phase = GamePhase.PREFLOP;

        // Randomly assign dealer
        game.dealerIndex = uint8(uint256(keccak256(abi.encodePacked(gameId, block.timestamp))) % game.playerCount);

        // Set blinds based on player count
        if (game.playerCount == 2) {
            // Heads-up: dealer is SB, other is BB
            game.smallBlindIndex = game.dealerIndex;
            game.bigBlindIndex = (game.dealerIndex + 1) % 2;
        } else {
            // 3+ players: SB is left of dealer, BB is left of SB
            game.smallBlindIndex = (game.dealerIndex + 1) % game.playerCount;
            game.bigBlindIndex = (game.dealerIndex + 2) % game.playerCount;
        }

        // Post blinds
        uint256 smallBlind = game.players[0].chips * SMALL_BLIND_PERCENT / 100;
        uint256 bigBlind = game.players[0].chips * BIG_BLIND_PERCENT / 100;

        Player storage sbPlayer = game.players[game.smallBlindIndex];
        Player storage bbPlayer = game.players[game.bigBlindIndex];

        sbPlayer.chips -= smallBlind;
        sbPlayer.currentBet = smallBlind;
        bbPlayer.chips -= bigBlind;
        bbPlayer.currentBet = bigBlind;

        game.mainPot = smallBlind + bigBlind;
        game.currentBet = bigBlind;

        // First to act preflop is left of BB (or dealer in heads-up)
        if (game.playerCount == 2) {
            game.activePlayerIndex = game.dealerIndex; // Dealer acts first in heads-up preflop
        } else {
            game.activePlayerIndex = (game.bigBlindIndex + 1) % game.playerCount;
        }

        game.lastRaiserIndex = game.bigBlindIndex;
        game.actionsThisRound = 0;
        game.lastActionTime = block.timestamp;

        emit GameStarted(gameId, game.playerCount);
        emit PhaseChanged(gameId, GamePhase.PREFLOP);
    }

    function _moveToNextPlayer(bytes32 gameId) internal {
        Game storage game = games[gameId];

        // Find next active player
        uint8 nextPlayer = game.activePlayerIndex;
        uint8 checkedPlayers = 0;

        do {
            nextPlayer = (nextPlayer + 1) % game.playerCount;
            checkedPlayers++;

            // Prevent infinite loop
            if (checkedPlayers > game.playerCount) break;

        } while (
            (game.players[nextPlayer].folded || game.players[nextPlayer].isAllIn) &&
            checkedPlayers <= game.playerCount
        );

        // Check if betting round is complete
        if (_isBettingRoundComplete(game)) {
            _advancePhase(gameId);
        } else {
            game.activePlayerIndex = nextPlayer;
        }
    }

    function _isBettingRoundComplete(Game storage game) internal view returns (bool) {
        uint8 activePlayers = 0;
        uint8 playersActed = 0;

        for (uint8 i = 0; i < game.playerCount; i++) {
            Player storage p = game.players[i];
            if (!p.folded && !p.isAllIn) {
                activePlayers++;
                // Player has matched the bet
                if (p.currentBet == game.currentBet) {
                    playersActed++;
                }
            }
        }

        // Round complete if all active players have matched the current bet
        // and everyone has had a chance to act (or we're back to the last raiser)
        if (activePlayers == 0) return true;
        if (activePlayers == 1 && game.currentBet == 0) return true;

        return playersActed == activePlayers && game.actionsThisRound >= activePlayers;
    }

    function _advancePhase(bytes32 gameId) internal {
        Game storage game = games[gameId];

        // Reset betting state for new round
        for (uint8 i = 0; i < game.playerCount; i++) {
            game.players[i].currentBet = 0;
        }
        game.currentBet = 0;
        game.actionsThisRound = 0;

        // First to act post-flop is first active player left of dealer
        game.activePlayerIndex = _getFirstActiveAfterDealer(game);

        if (game.phase == GamePhase.PREFLOP) {
            game.phase = GamePhase.FLOP;
            _dealCommunityCards(gameId, 3);
        } else if (game.phase == GamePhase.FLOP) {
            game.phase = GamePhase.TURN;
            _dealCommunityCards(gameId, 1);
        } else if (game.phase == GamePhase.TURN) {
            game.phase = GamePhase.RIVER;
            _dealCommunityCards(gameId, 1);
        } else if (game.phase == GamePhase.RIVER) {
            game.phase = GamePhase.SHOWDOWN;
        }

        game.lastActionTime = block.timestamp;
        emit PhaseChanged(gameId, game.phase);

        // Check if all but one player folded or all-in, skip to showdown
        uint8 activePlayers = _countActivePlayers(game);
        if (activePlayers <= 1 && game.phase != GamePhase.SHOWDOWN) {
            // Skip to showdown
            while (game.phase != GamePhase.SHOWDOWN && game.phase != GamePhase.COMPLETE) {
                if (game.phase == GamePhase.PREFLOP) {
                    game.phase = GamePhase.FLOP;
                    _dealCommunityCards(gameId, 3);
                } else if (game.phase == GamePhase.FLOP) {
                    game.phase = GamePhase.TURN;
                    _dealCommunityCards(gameId, 1);
                } else if (game.phase == GamePhase.TURN) {
                    game.phase = GamePhase.RIVER;
                    _dealCommunityCards(gameId, 1);
                } else if (game.phase == GamePhase.RIVER) {
                    game.phase = GamePhase.SHOWDOWN;
                }
            }
            emit PhaseChanged(gameId, game.phase);
        }
    }

    function _getFirstActiveAfterDealer(Game storage game) internal view returns (uint8) {
        for (uint8 i = 1; i <= game.playerCount; i++) {
            uint8 idx = (game.dealerIndex + i) % game.playerCount;
            if (!game.players[idx].folded && !game.players[idx].isAllIn) {
                return idx;
            }
        }
        return game.dealerIndex;
    }

    function _dealCommunityCards(bytes32 gameId, uint8 count) internal {
        Game storage game = games[gameId];
        bytes32 seed = deckSeeds[gameId];

        uint8[] memory newCards = new uint8[](count);
        for (uint8 i = 0; i < count; i++) {
            seed = keccak256(abi.encodePacked(seed, game.communityCardCount + i));
            newCards[i] = uint8(uint256(seed) % 52);
            game.communityCards[game.communityCardCount + i] = newCards[i];
        }
        game.communityCardCount += count;

        emit CommunityCardsDealt(gameId, newCards);
    }

    function _countActivePlayers(Game storage game) internal view returns (uint8) {
        uint8 count = 0;
        for (uint8 i = 0; i < game.playerCount; i++) {
            if (!game.players[i].folded && !game.players[i].isAllIn) {
                count++;
            }
        }
        return count;
    }

    function _getLastActivePlayer(Game storage game) internal view returns (address) {
        for (uint8 i = 0; i < game.playerCount; i++) {
            if (!game.players[i].folded) {
                return game.players[i].wallet;
            }
        }
        return address(0);
    }

    function _allActivePlayersRevealed(Game storage game) internal view returns (bool) {
        for (uint8 i = 0; i < game.playerCount; i++) {
            if (!game.players[i].folded && !game.players[i].revealed) {
                return false;
            }
        }
        return true;
    }

    function _determineWinner(bytes32 gameId) internal {
        Game storage game = games[gameId];

        address bestPlayer = address(0);
        HandEvaluator.HandResult memory bestHand;
        bool firstHand = true;

        for (uint8 i = 0; i < game.playerCount; i++) {
            Player storage player = game.players[i];
            if (player.folded || !player.revealed) continue;

            // Build 7-card hand
            uint8[7] memory hand;
            hand[0] = player.holeCards[0];
            hand[1] = player.holeCards[1];
            for (uint8 j = 0; j < 5; j++) {
                hand[2 + j] = game.communityCards[j];
            }

            HandEvaluator.HandResult memory result = hand.evaluate();

            if (firstHand) {
                bestPlayer = player.wallet;
                bestHand = result;
                firstHand = false;
            } else {
                int8 comparison = HandEvaluator.compare(result, bestHand);
                if (comparison > 0) {
                    bestPlayer = player.wallet;
                    bestHand = result;
                }
            }
        }

        if (bestPlayer != address(0)) {
            _endGame(gameId, bestPlayer);
        } else {
            // No winner - split pot (shouldn't happen normally)
            _splitPot(gameId);
        }
    }

    function _endGame(bytes32 gameId, address winner) internal {
        Game storage game = games[gameId];
        game.phase = GamePhase.COMPLETE;
        game.isActive = false;

        // Calculate total pot (wager amount * player count)
        uint256 totalPot = game.players[0].chips + game.mainPot;
        for (uint8 i = 0; i < game.playerCount; i++) {
            totalPot = game.players[i].chips;
        }
        // Actually, total pot is all wagers combined
        totalPot = game.mainPot;
        for (uint8 i = 0; i < game.playerCount; i++) {
            totalPot += game.players[i].chips;
        }

        // Settle via escrow - winner takes the total pot
        IEscrow4Max(escrowContract).settle(gameId, winner, totalPot);

        emit GameEnded(gameId, winner, totalPot);
    }

    function _splitPot(bytes32 gameId) internal {
        Game storage game = games[gameId];
        game.phase = GamePhase.COMPLETE;
        game.isActive = false;

        emit GameEnded(gameId, address(0), game.mainPot);
    }

    function _getPlayerIndex(Game storage game, address player) internal view returns (uint8) {
        for (uint8 i = 0; i < game.playerCount; i++) {
            if (game.players[i].wallet == player) return i;
        }
        revert Unauthorized();
    }
}
