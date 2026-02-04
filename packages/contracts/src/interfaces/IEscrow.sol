// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrow {
    struct Wager {
        address player1;
        address player2;
        uint256 amount;
        bool settled;
        bool refunded;
    }

    event WagerDeposited(bytes32 indexed gameId, address indexed player, uint256 amount);
    event WagerSettled(bytes32 indexed gameId, address indexed winner, uint256 amount);
    event WagerRefunded(bytes32 indexed gameId, address indexed player, uint256 amount);

    function deposit(bytes32 gameId) external payable;
    function settle(bytes32 gameId, address winner) external;
    function refund(bytes32 gameId) external;
    function getWager(bytes32 gameId) external view returns (Wager memory);
}
