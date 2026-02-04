// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IEscrow.sol";

/// @title Poker Escrow
/// @notice Holds and manages wagers for poker games
contract Escrow is IEscrow {
    address public pokerGame;
    address public owner;

    mapping(bytes32 => Wager) public wagers;

    error Unauthorized();
    error InvalidAmount();
    error WagerNotFound();
    error AlreadySettled();
    error AlreadyRefunded();
    error TransferFailed();
    error WagerExists();

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
    /// @param player The player address (passed by PokerGame contract)
    function deposit(bytes32 gameId, address player) external payable onlyPokerGame {
        if (msg.value == 0) revert InvalidAmount();

        Wager storage wager = wagers[gameId];

        if (wager.player1 == address(0)) {
            // First player deposit
            wager.player1 = player;
            wager.amount = msg.value;
        } else if (wager.player2 == address(0)) {
            // Second player deposit - must match
            if (msg.value != wager.amount) revert InvalidAmount();
            wager.player2 = player;
        } else {
            revert WagerExists();
        }

        emit WagerDeposited(gameId, player, msg.value);
    }

    /// @notice Deposit wager for a game (legacy - kept for interface)
    /// @param gameId The game identifier
    function deposit(bytes32 gameId) external payable override {
        revert Unauthorized(); // Must use deposit(gameId, player) via PokerGame
    }

    /// @notice Settle the game and pay winner
    /// @param gameId The game identifier
    /// @param winner Address of the winner
    function settle(bytes32 gameId, address winner) external override onlyPokerGame {
        Wager storage wager = wagers[gameId];

        if (wager.player1 == address(0)) revert WagerNotFound();
        if (wager.settled) revert AlreadySettled();
        if (wager.refunded) revert AlreadyRefunded();

        require(
            winner == wager.player1 || winner == wager.player2,
            "Invalid winner"
        );

        wager.settled = true;
        uint256 totalPot = wager.amount * 2;

        // Transfer entire pot to winner
        (bool success, ) = winner.call{value: totalPot}("");
        if (!success) revert TransferFailed();

        emit WagerSettled(gameId, winner, totalPot);
    }

    /// @notice Refund wagers if game is cancelled
    /// @param gameId The game identifier
    function refund(bytes32 gameId) external override onlyPokerGame {
        Wager storage wager = wagers[gameId];

        if (wager.player1 == address(0)) revert WagerNotFound();
        if (wager.settled) revert AlreadySettled();
        if (wager.refunded) revert AlreadyRefunded();

        wager.refunded = true;

        // Refund player 1
        if (wager.player1 != address(0)) {
            (bool success1, ) = wager.player1.call{value: wager.amount}("");
            if (!success1) revert TransferFailed();
            emit WagerRefunded(gameId, wager.player1, wager.amount);
        }

        // Refund player 2 if they deposited
        if (wager.player2 != address(0)) {
            (bool success2, ) = wager.player2.call{value: wager.amount}("");
            if (!success2) revert TransferFailed();
            emit WagerRefunded(gameId, wager.player2, wager.amount);
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
