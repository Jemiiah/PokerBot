// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPokerGame.sol";
import "../interfaces/IEscrow.sol";
import "../libraries/HandEvaluator.sol";
import "../libraries/DeckUtils.sol";
import "../core/Escrow.sol";

/// @title Poker Game
/// @notice Heads-up Texas Hold'em poker game contract
contract PokerGame is IPokerGame {
    using HandEvaluator for uint8[7];

    Escrow public escrowContract;
    address public owner;

    mapping(bytes32 => Game) public games;
    bytes32[] public activeGameIds;
    mapping(bytes32 => bytes32) public deckSeeds; // gameId => combined seed for deck

    uint256 public constant MIN_WAGER = 0.001 ether;
    uint256 public constant DEFAULT_TIMEOUT = 120; // 2 minutes

    // Blinds (relative to wager)
    uint256 public constant SMALL_BLIND_PERCENT = 1; // 1% of wager
    uint256 public constant BIG_BLIND_PERCENT = 2; // 2% of wager

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
        escrowContract = Escrow(_escrow);
        owner = msg.sender;
    }

    /// @notice Create a new poker game
    /// @param cardCommitment Commitment hash for player's hole cards
    /// @return gameId The unique game identifier
    function createGame(bytes32 cardCommitment) external payable override returns (bytes32 gameId) {
        if (msg.value < MIN_WAGER) revert InsufficientWager();

        gameId = keccak256(abi.encodePacked(msg.sender, block.timestamp, block.prevrandao));

        Game storage game = games[gameId];
        game.gameId = gameId;
        game.players[0].wallet = msg.sender;
        game.players[0].chips = msg.value;
        game.players[0].cardCommitment = cardCommitment;
        game.phase = GamePhase.WAITING;
        game.timeoutDuration = DEFAULT_TIMEOUT;
        game.lastActionTime = block.timestamp;
        game.isActive = true;

        activeGameIds.push(gameId);

        // Deposit to escrow
        escrowContract.deposit{value: msg.value}(gameId, msg.sender);

        emit GameCreated(gameId, msg.sender, msg.value);
        return gameId;
    }

    /// @notice Join an existing game
    /// @param gameId The game to join
    /// @param cardCommitment Commitment hash for player's hole cards
    function joinGame(bytes32 gameId, bytes32 cardCommitment) external payable override gameExists(gameId) {
        Game storage game = games[gameId];

        if (game.phase != GamePhase.WAITING) revert GameFull();
        if (game.players[1].wallet != address(0)) revert GameFull();
        if (msg.value != game.players[0].chips) revert InvalidAmount();

        game.players[1].wallet = msg.sender;
        game.players[1].chips = msg.value;
        game.players[1].cardCommitment = cardCommitment;

        // Deposit to escrow
        escrowContract.deposit{value: msg.value}(gameId, msg.sender);

        emit PlayerJoined(gameId, msg.sender);

        // Start the game
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
        Player storage opponent = game.players[1 - playerIndex];

        if (player.folded) revert InvalidAction();

        uint256 toCall = game.currentBet > player.currentBet
            ? game.currentBet - player.currentBet
            : 0;

        if (action == Action.FOLD) {
            player.folded = true;
            _endGame(gameId, opponent.wallet);
        } else if (action == Action.CHECK) {
            if (toCall > 0) revert InvalidAction(); // Can't check if there's a bet
        } else if (action == Action.CALL) {
            if (toCall == 0) revert InvalidAction(); // Nothing to call
            if (toCall > player.chips) {
                // All-in call
                game.pot += player.chips;
                player.chips = 0;
            } else {
                player.chips -= toCall;
                player.currentBet += toCall;
                game.pot += toCall;
            }
        } else if (action == Action.RAISE) {
            if (raiseAmount < game.currentBet * 2) revert InvalidAmount(); // Min raise is 2x
            uint256 totalNeeded = raiseAmount - player.currentBet;
            if (totalNeeded > player.chips) revert InvalidAmount();

            player.chips -= totalNeeded;
            player.currentBet = raiseAmount;
            game.currentBet = raiseAmount;
            game.pot += totalNeeded;
        } else if (action == Action.ALL_IN) {
            uint256 allInAmount = player.chips;
            game.pot += allInAmount;
            player.currentBet += allInAmount;
            player.chips = 0;

            if (player.currentBet > game.currentBet) {
                game.currentBet = player.currentBet;
            }
        }

        game.lastActionTime = block.timestamp;
        emit ActionTaken(gameId, msg.sender, action, raiseAmount);

        // Check if betting round is complete
        if (!player.folded && !opponent.folded) {
            if (_isBettingRoundComplete(game)) {
                _advancePhase(gameId);
            } else {
                game.activePlayerIndex = 1 - playerIndex;
            }
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

        // Verify commitment
        bytes32 commitment = DeckUtils.createCommitment(cards, salt);
        if (commitment != player.cardCommitment) revert InvalidReveal();

        player.holeCards = cards;
        player.revealed = true;

        emit CardsRevealed(gameId, msg.sender, cards);

        // Check if both players revealed
        if (game.players[0].revealed && game.players[1].revealed) {
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
        uint8 opponentIndex = 1 - playerIndex;

        // If it's opponent's turn and they timed out, caller wins
        if (game.activePlayerIndex == opponentIndex) {
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
        // Count actual active games
        uint256 count = 0;
        for (uint256 i = 0; i < activeGameIds.length; i++) {
            if (games[activeGameIds[i]].isActive) {
                count++;
            }
        }

        // Build result array
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < activeGameIds.length; i++) {
            if (games[activeGameIds[i]].isActive) {
                result[idx++] = activeGameIds[i];
            }
        }

        return result;
    }

    /// @notice Set deck seed for a game (called by coordinator after commit-reveal)
    /// @param gameId The game identifier
    /// @param seed The combined seed for deck shuffling
    function setDeckSeed(bytes32 gameId, bytes32 seed) external onlyOwner {
        deckSeeds[gameId] = seed;
    }

    // Internal functions

    function _startGame(bytes32 gameId) internal {
        Game storage game = games[gameId];

        game.phase = GamePhase.PREFLOP;

        // Randomly assign dealer
        game.dealerIndex = uint8(uint256(keccak256(abi.encodePacked(gameId, block.timestamp))) % 2);

        // Post blinds
        uint256 smallBlind = game.players[0].chips * SMALL_BLIND_PERCENT / 100;
        uint256 bigBlind = game.players[0].chips * BIG_BLIND_PERCENT / 100;

        uint8 sbIndex = game.dealerIndex; // Dealer posts small blind in heads-up
        uint8 bbIndex = 1 - game.dealerIndex;

        game.players[sbIndex].chips -= smallBlind;
        game.players[sbIndex].currentBet = smallBlind;
        game.players[bbIndex].chips -= bigBlind;
        game.players[bbIndex].currentBet = bigBlind;

        game.pot = smallBlind + bigBlind;
        game.currentBet = bigBlind;

        // Dealer acts first preflop in heads-up
        game.activePlayerIndex = sbIndex;

        game.lastActionTime = block.timestamp;
        emit PhaseChanged(gameId, GamePhase.PREFLOP);
    }

    function _advancePhase(bytes32 gameId) internal {
        Game storage game = games[gameId];

        // Reset betting state
        game.players[0].currentBet = 0;
        game.players[1].currentBet = 0;
        game.currentBet = 0;

        // Non-dealer acts first post-flop
        game.activePlayerIndex = 1 - game.dealerIndex;

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
    }

    function _dealCommunityCards(bytes32 gameId, uint8 count) internal {
        Game storage game = games[gameId];
        bytes32 seed = deckSeeds[gameId];

        // Generate cards from seed (simplified - in production use proper deck state)
        uint8[] memory newCards = new uint8[](count);
        for (uint8 i = 0; i < count; i++) {
            seed = keccak256(abi.encodePacked(seed, game.communityCardCount + i));
            newCards[i] = uint8(uint256(seed) % 52);
            game.communityCards[game.communityCardCount + i] = newCards[i];
        }
        game.communityCardCount += count;

        emit CommunityCardsDealt(gameId, newCards);
    }

    function _isBettingRoundComplete(Game storage game) internal view returns (bool) {
        // Both players must have matched the current bet (or be all-in)
        Player storage p1 = game.players[0];
        Player storage p2 = game.players[1];

        bool p1Done = p1.folded || p1.chips == 0 || p1.currentBet == game.currentBet;
        bool p2Done = p2.folded || p2.chips == 0 || p2.currentBet == game.currentBet;

        return p1Done && p2Done;
    }

    function _determineWinner(bytes32 gameId) internal {
        Game storage game = games[gameId];

        // Build 7-card hands
        uint8[7] memory hand1;
        uint8[7] memory hand2;

        // Player 1's hand
        hand1[0] = game.players[0].holeCards[0];
        hand1[1] = game.players[0].holeCards[1];
        for (uint8 i = 0; i < 5; i++) {
            hand1[2 + i] = game.communityCards[i];
        }

        // Player 2's hand
        hand2[0] = game.players[1].holeCards[0];
        hand2[1] = game.players[1].holeCards[1];
        for (uint8 i = 0; i < 5; i++) {
            hand2[2 + i] = game.communityCards[i];
        }

        // Evaluate hands
        HandEvaluator.HandResult memory result1 = hand1.evaluate();
        HandEvaluator.HandResult memory result2 = hand2.evaluate();

        int8 comparison = HandEvaluator.compare(result1, result2);

        if (comparison > 0) {
            _endGame(gameId, game.players[0].wallet);
        } else if (comparison < 0) {
            _endGame(gameId, game.players[1].wallet);
        } else {
            // Tie - split pot
            _splitPot(gameId);
        }
    }

    function _endGame(bytes32 gameId, address winner) internal {
        Game storage game = games[gameId];
        game.phase = GamePhase.COMPLETE;
        game.isActive = false;

        // Settle escrow
        escrowContract.settle(gameId, winner);

        emit GameEnded(gameId, winner, game.pot);
    }

    function _splitPot(bytes32 gameId) internal {
        Game storage game = games[gameId];
        game.phase = GamePhase.COMPLETE;
        game.isActive = false;

        // Refund to split pot
        escrowContract.refund(gameId);

        emit GameEnded(gameId, address(0), game.pot); // address(0) indicates tie
    }

    function _getPlayerIndex(Game storage game, address player) internal view returns (uint8) {
        if (game.players[0].wallet == player) return 0;
        if (game.players[1].wallet == player) return 1;
        revert Unauthorized();
    }
}
