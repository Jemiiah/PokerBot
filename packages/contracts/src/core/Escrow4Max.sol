// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IEscrow4Max.sol";

/// @title Poker Escrow 4-Max
/// @notice Holds and manages wagers for 2-4 player poker games
contract Escrow4Max is IEscrow4Max {
    address public pokerGame;
    address public owner;

    mapping(bytes32 => Wager) public wagers;

    error Unauthorized();
    error InvalidAmount();
    error WagerNotFound();
    error AlreadySettled();
    error AlreadyRefunded();
    error TransferFailed();
    error GameFull();

    modifier onlyPokerGame() {
        if (msg.sender != pokerGame) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Set the PokerGame contract address
    /// @param _pokerGame Address of the PokerGame contract
    function setPokerGame(address _pokerGame) external onlyOwner {
        pokerGame = _pokerGame;
    }

    /// @notice Deposit wager for a game
    /// @param gameId The game identifier
    /// @param player The player address
    function deposit(bytes32 gameId, address player) external payable override onlyPokerGame {
        if (msg.value == 0) revert InvalidAmount();

        Wager storage wager = wagers[gameId];

        if (wager.playerCount == 0) {
            // First player deposit - set the wager amount
            wager.players[0] = player;
            wager.amount = msg.value;
            wager.playerCount = 1;
        } else {
            // Subsequent deposits must match
            if (msg.value != wager.amount) revert InvalidAmount();
            if (wager.playerCount >= 4) revert GameFull();

            wager.players[wager.playerCount] = player;
            wager.playerCount++;
        }

        emit WagerDeposited(gameId, player, msg.value);
    }

    /// @notice Settle the game and pay winner
    /// @param gameId The game identifier
    /// @param winner Address of the winner
    /// @param amount Total pot amount to pay (allows for side pots)
    function settle(bytes32 gameId, address winner, uint256 amount) external override onlyPokerGame {
        Wager storage wager = wagers[gameId];

        if (wager.playerCount == 0) revert WagerNotFound();
        if (wager.settled) revert AlreadySettled();
        if (wager.refunded) revert AlreadyRefunded();

        // Verify winner is in the game
        bool isValidWinner = false;
        for (uint8 i = 0; i < wager.playerCount; i++) {
            if (wager.players[i] == winner) {
                isValidWinner = true;
                break;
            }
        }
        require(isValidWinner, "Invalid winner");

        wager.settled = true;

        // Transfer winnings to winner
        (bool success, ) = winner.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit WagerSettled(gameId, winner, amount);
    }

    /// @notice Refund wagers if game is cancelled
    /// @param gameId The game identifier
    function refund(bytes32 gameId) external override onlyPokerGame {
        Wager storage wager = wagers[gameId];

        if (wager.playerCount == 0) revert WagerNotFound();
        if (wager.settled) revert AlreadySettled();
        if (wager.refunded) revert AlreadyRefunded();

        wager.refunded = true;

        // Refund all players
        for (uint8 i = 0; i < wager.playerCount; i++) {
            if (wager.players[i] != address(0)) {
                (bool success, ) = wager.players[i].call{value: wager.amount}("");
                if (!success) revert TransferFailed();
                emit WagerRefunded(gameId, wager.players[i], wager.amount);
            }
        }
    }

    /// @notice Get wager details
    /// @param gameId The game identifier
    /// @return The wager struct
    function getWager(bytes32 gameId) external view override returns (Wager memory) {
        return wagers[gameId];
    }

    /// @notice Get contract balance
    /// @return The contract's ETH balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Emergency withdraw (owner only, for stuck funds)
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }
}
