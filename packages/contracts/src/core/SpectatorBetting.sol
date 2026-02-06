// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPokerGame.sol";

/// @title Spectator Betting
/// @notice Allows spectators to bet on poker game outcomes
/// @dev Bets are placed on player 0 or player 1, winnings distributed proportionally
contract SpectatorBetting {
    IPokerGame public pokerGame;
    address public owner;

    // Minimum and maximum bet amounts
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 10 ether;

    // Platform fee (2%)
    uint256 public constant PLATFORM_FEE_BPS = 200; // 2% = 200 basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Bet structure
    struct Bet {
        address bettor;
        uint256 amount;
        uint8 predictedWinner; // 0 or 1 (player index)
        bool claimed;
    }

    // Game betting pool
    struct BettingPool {
        uint256 totalPool0; // Total bet on player 0
        uint256 totalPool1; // Total bet on player 1
        uint256 totalBets;
        bool settled;
        address winner; // Winner address (address(0) if tie or not settled)
        uint8 winnerIndex; // 0, 1, or 255 for tie
    }

    // Storage
    mapping(bytes32 => BettingPool) public pools;
    mapping(bytes32 => mapping(address => Bet[])) public bets; // gameId => bettor => bets
    mapping(bytes32 => address[]) public bettors; // gameId => list of unique bettors
    mapping(bytes32 => mapping(address => bool)) public hasBet; // gameId => bettor => has placed bet

    uint256 public accumulatedFees;

    // Events
    event BetPlaced(bytes32 indexed gameId, address indexed bettor, uint8 predictedWinner, uint256 amount);
    event BettingPoolSettled(bytes32 indexed gameId, address winner, uint8 winnerIndex);
    event WinningsClaimed(bytes32 indexed gameId, address indexed bettor, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // Errors
    error GameNotFound();
    error GameNotActive();
    error GameNotComplete();
    error BettingClosed();
    error InvalidBetAmount();
    error InvalidPlayerIndex();
    error AlreadySettled();
    error NotSettled();
    error NothingToClaim();
    error Unauthorized();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _pokerGame) {
        pokerGame = IPokerGame(_pokerGame);
        owner = msg.sender;
    }

    /// @notice Place a bet on a game
    /// @param gameId The game to bet on
    /// @param predictedWinner Player index (0 or 1) you predict will win
    function placeBet(bytes32 gameId, uint8 predictedWinner) external payable {
        if (msg.value < MIN_BET || msg.value > MAX_BET) revert InvalidBetAmount();
        if (predictedWinner > 1) revert InvalidPlayerIndex();

        IPokerGame.Game memory game = pokerGame.getGame(gameId);

        // Game must exist and have both players
        if (game.players[0].wallet == address(0)) revert GameNotFound();
        if (game.players[1].wallet == address(0)) revert GameNotActive();

        // Can only bet before showdown
        if (game.phase == IPokerGame.GamePhase.SHOWDOWN ||
            game.phase == IPokerGame.GamePhase.COMPLETE) {
            revert BettingClosed();
        }

        BettingPool storage pool = pools[gameId];
        if (pool.settled) revert AlreadySettled();

        // Record bet
        bets[gameId][msg.sender].push(Bet({
            bettor: msg.sender,
            amount: msg.value,
            predictedWinner: predictedWinner,
            claimed: false
        }));

        // Update pool totals
        if (predictedWinner == 0) {
            pool.totalPool0 += msg.value;
        } else {
            pool.totalPool1 += msg.value;
        }
        pool.totalBets++;

        // Track unique bettors
        if (!hasBet[gameId][msg.sender]) {
            hasBet[gameId][msg.sender] = true;
            bettors[gameId].push(msg.sender);
        }

        emit BetPlaced(gameId, msg.sender, predictedWinner, msg.value);
    }

    /// @notice Settle the betting pool for a completed game
    /// @param gameId The game to settle
    function settleBets(bytes32 gameId) external {
        IPokerGame.Game memory game = pokerGame.getGame(gameId);

        if (game.phase != IPokerGame.GamePhase.COMPLETE) revert GameNotComplete();

        BettingPool storage pool = pools[gameId];
        if (pool.settled) revert AlreadySettled();

        // Determine winner from game state
        address winner;
        uint8 winnerIndex = 255; // 255 = tie/unknown

        if (game.players[0].folded) {
            winner = game.players[1].wallet;
            winnerIndex = 1;
        } else if (game.players[1].folded) {
            winner = game.players[0].wallet;
            winnerIndex = 0;
        } else {
            // Both players revealed - need to check who has more chips or use event data
            // For simplicity, we check if one player has all chips
            if (game.players[0].chips > game.players[1].chips) {
                winner = game.players[0].wallet;
                winnerIndex = 0;
            } else if (game.players[1].chips > game.players[0].chips) {
                winner = game.players[1].wallet;
                winnerIndex = 1;
            }
            // If equal chips, it's a tie (winnerIndex stays 255)
        }

        pool.settled = true;
        pool.winner = winner;
        pool.winnerIndex = winnerIndex;

        // Calculate platform fee
        uint256 totalPool = pool.totalPool0 + pool.totalPool1;
        uint256 fee = (totalPool * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        accumulatedFees += fee;

        emit BettingPoolSettled(gameId, winner, winnerIndex);
    }

    /// @notice Claim winnings for a settled game
    /// @param gameId The game to claim winnings from
    function claimWinnings(bytes32 gameId) external {
        BettingPool storage pool = pools[gameId];
        if (!pool.settled) revert NotSettled();

        Bet[] storage userBets = bets[gameId][msg.sender];
        if (userBets.length == 0) revert NothingToClaim();

        uint256 totalWinnings = 0;
        uint256 totalRefund = 0;

        uint256 totalPool = pool.totalPool0 + pool.totalPool1;
        uint256 fee = (totalPool * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 prizePool = totalPool - fee;

        for (uint256 i = 0; i < userBets.length; i++) {
            Bet storage bet = userBets[i];
            if (bet.claimed) continue;

            bet.claimed = true;

            if (pool.winnerIndex == 255) {
                // Tie - refund all bets (minus small fee)
                totalRefund += (bet.amount * (BPS_DENOMINATOR - PLATFORM_FEE_BPS)) / BPS_DENOMINATOR;
            } else if (bet.predictedWinner == pool.winnerIndex) {
                // Winner! Calculate proportional share
                uint256 winningPool = pool.winnerIndex == 0 ? pool.totalPool0 : pool.totalPool1;
                if (winningPool > 0) {
                    // User's share = (their bet / winning pool) * prize pool
                    totalWinnings += (bet.amount * prizePool) / winningPool;
                }
            }
            // Losing bets get nothing
        }

        uint256 payout = totalWinnings + totalRefund;
        if (payout == 0) revert NothingToClaim();

        (bool success, ) = msg.sender.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit WinningsClaimed(gameId, msg.sender, payout);
    }

    /// @notice Get betting pool info for a game
    /// @param gameId The game identifier
    function getPool(bytes32 gameId) external view returns (
        uint256 totalPool0,
        uint256 totalPool1,
        uint256 totalBets,
        bool settled,
        address winner,
        uint8 winnerIndex
    ) {
        BettingPool storage pool = pools[gameId];
        return (
            pool.totalPool0,
            pool.totalPool1,
            pool.totalBets,
            pool.settled,
            pool.winner,
            pool.winnerIndex
        );
    }

    /// @notice Get odds for betting on each player
    /// @param gameId The game identifier
    /// @return odds0 Odds for player 0 (multiply by 100 for percentage)
    /// @return odds1 Odds for player 1
    function getOdds(bytes32 gameId) external view returns (uint256 odds0, uint256 odds1) {
        BettingPool storage pool = pools[gameId];
        uint256 total = pool.totalPool0 + pool.totalPool1;

        if (total == 0) {
            return (100, 100); // Even odds if no bets
        }

        // Return potential return percentage (e.g., 150 = 1.5x return)
        if (pool.totalPool0 > 0) {
            odds0 = (total * 100) / pool.totalPool0;
        }
        if (pool.totalPool1 > 0) {
            odds1 = (total * 100) / pool.totalPool1;
        }
    }

    /// @notice Get user's bets for a game
    /// @param gameId The game identifier
    /// @param bettor The bettor address
    function getUserBets(bytes32 gameId, address bettor) external view returns (
        uint256 totalOnPlayer0,
        uint256 totalOnPlayer1,
        uint256 betCount
    ) {
        Bet[] storage userBets = bets[gameId][bettor];
        for (uint256 i = 0; i < userBets.length; i++) {
            if (userBets[i].predictedWinner == 0) {
                totalOnPlayer0 += userBets[i].amount;
            } else {
                totalOnPlayer1 += userBets[i].amount;
            }
        }
        betCount = userBets.length;
    }

    /// @notice Get all bettors for a game
    /// @param gameId The game identifier
    function getBettors(bytes32 gameId) external view returns (address[] memory) {
        return bettors[gameId];
    }

    /// @notice Get player addresses for a game (convenience function)
    /// @param gameId The game identifier
    function getPlayers(bytes32 gameId) external view returns (address player0, address player1) {
        IPokerGame.Game memory game = pokerGame.getGame(gameId);
        return (game.players[0].wallet, game.players[1].wallet);
    }

    /// @notice Withdraw accumulated platform fees
    /// @param to Address to send fees to
    function withdrawFees(address to) external onlyOwner {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;

        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(to, amount);
    }

    /// @notice Update poker game contract address
    /// @param _pokerGame New poker game address
    function setPokerGame(address _pokerGame) external onlyOwner {
        pokerGame = IPokerGame(_pokerGame);
    }

    /// @notice Transfer ownership
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    receive() external payable {}
}
