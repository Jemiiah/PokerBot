// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPokerGame {
    enum GamePhase {
        WAITING,
        PREFLOP,
        FLOP,
        TURN,
        RIVER,
        SHOWDOWN,
        COMPLETE
    }

    enum Action {
        FOLD,
        CHECK,
        CALL,
        RAISE,
        ALL_IN
    }

    struct Player {
        address wallet;
        uint256 chips;
        bytes32 cardCommitment;
        uint8[2] holeCards;
        bool folded;
        bool revealed;
        uint256 currentBet;
    }

    struct Game {
        bytes32 gameId;
        Player[2] players;
        uint256 pot;
        uint256 currentBet;
        uint8 dealerIndex;
        GamePhase phase;
        uint8[5] communityCards;
        uint8 communityCardCount;
        uint256 lastActionTime;
        uint256 timeoutDuration;
        uint8 activePlayerIndex;
        bool isActive;
    }

    event GameCreated(bytes32 indexed gameId, address indexed player1, uint256 wager);
    event PlayerJoined(bytes32 indexed gameId, address indexed player2);
    event ActionTaken(bytes32 indexed gameId, address indexed player, Action action, uint256 amount);
    event PhaseChanged(bytes32 indexed gameId, GamePhase newPhase);
    event GameEnded(bytes32 indexed gameId, address indexed winner, uint256 pot);
    event CardsRevealed(bytes32 indexed gameId, address indexed player, uint8[2] cards);
    event CommunityCardsDealt(bytes32 indexed gameId, uint8[] cards);

    function createGame(bytes32 cardCommitment) external payable returns (bytes32 gameId);
    function joinGame(bytes32 gameId, bytes32 cardCommitment) external payable;
    function takeAction(bytes32 gameId, Action action, uint256 raiseAmount) external;
    function revealCards(bytes32 gameId, uint8[2] calldata cards, bytes32 salt) external;
    function claimTimeout(bytes32 gameId) external;
    function getGame(bytes32 gameId) external view returns (Game memory);
    function getActiveGames() external view returns (bytes32[] memory);
}
