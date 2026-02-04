// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Tournament & Leaderboard
/// @notice Tracks player statistics and rankings
contract Tournament {
    struct AgentStats {
        address agent;
        uint256 gamesPlayed;
        uint256 wins;
        uint256 losses;
        uint256 ties;
        uint256 totalWagered;
        uint256 totalWon;
        uint256 totalLost;
        uint256 rating; // ELO-style rating
        uint256 lastGameTimestamp;
    }

    struct MatchRecord {
        bytes32 gameId;
        address player1;
        address player2;
        address winner; // address(0) for tie
        uint256 pot;
        uint256 timestamp;
    }

    address public pokerGame;
    address public owner;

    mapping(address => AgentStats) public agentStats;
    mapping(address => bytes32[]) public agentGameHistory;
    mapping(bytes32 => MatchRecord) public matchRecords;

    address[] public registeredAgents;
    bytes32[] public allMatches;

    uint256 public constant INITIAL_RATING = 1500;
    uint256 public constant K_FACTOR = 32; // ELO K-factor

    event AgentRegistered(address indexed agent);
    event MatchRecorded(bytes32 indexed gameId, address indexed winner, uint256 pot);
    event RatingUpdated(address indexed agent, uint256 oldRating, uint256 newRating);

    error Unauthorized();
    error AlreadyRegistered();
    error NotRegistered();

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
    function setPokerGame(address _pokerGame) external onlyOwner {
        pokerGame = _pokerGame;
    }

    /// @notice Register as a competing agent
    function register() external {
        if (agentStats[msg.sender].agent != address(0)) revert AlreadyRegistered();

        agentStats[msg.sender] = AgentStats({
            agent: msg.sender,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            totalWagered: 0,
            totalWon: 0,
            totalLost: 0,
            rating: INITIAL_RATING,
            lastGameTimestamp: block.timestamp
        });

        registeredAgents.push(msg.sender);
        emit AgentRegistered(msg.sender);
    }

    /// @notice Record a match result (called by PokerGame)
    function recordMatch(
        bytes32 gameId,
        address player1,
        address player2,
        address winner,
        uint256 pot
    ) external onlyPokerGame {
        // Store match record
        matchRecords[gameId] = MatchRecord({
            gameId: gameId,
            player1: player1,
            player2: player2,
            winner: winner,
            pot: pot,
            timestamp: block.timestamp
        });

        allMatches.push(gameId);

        // Update player 1 stats
        _updateStats(player1, player2, winner, pot);

        // Update player 2 stats
        _updateStats(player2, player1, winner, pot);

        // Update ELO ratings
        if (winner != address(0)) {
            address loser = winner == player1 ? player2 : player1;
            _updateElo(winner, loser);
        }

        emit MatchRecorded(gameId, winner, pot);
    }

    /// @notice Get agent statistics
    function getAgentStats(address agent) external view returns (AgentStats memory) {
        return agentStats[agent];
    }

    /// @notice Get agent's game history
    function getAgentHistory(address agent) external view returns (bytes32[] memory) {
        return agentGameHistory[agent];
    }

    /// @notice Get leaderboard (top N agents by rating)
    function getLeaderboard(uint256 limit) external view returns (AgentStats[] memory) {
        uint256 count = registeredAgents.length;
        if (limit > count) limit = count;

        // Create sorted array by rating (simple bubble sort for small arrays)
        address[] memory sorted = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            sorted[i] = registeredAgents[i];
        }

        for (uint256 i = 0; i < count - 1; i++) {
            for (uint256 j = 0; j < count - i - 1; j++) {
                if (agentStats[sorted[j]].rating < agentStats[sorted[j + 1]].rating) {
                    (sorted[j], sorted[j + 1]) = (sorted[j + 1], sorted[j]);
                }
            }
        }

        // Return top N
        AgentStats[] memory result = new AgentStats[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = agentStats[sorted[i]];
        }

        return result;
    }

    /// @notice Get total registered agents
    function getAgentCount() external view returns (uint256) {
        return registeredAgents.length;
    }

    /// @notice Get total matches played
    function getMatchCount() external view returns (uint256) {
        return allMatches.length;
    }

    /// @notice Check if agent is registered
    function isRegistered(address agent) external view returns (bool) {
        return agentStats[agent].agent != address(0);
    }

    // Internal functions

    function _updateStats(
        address player,
        address opponent,
        address winner,
        uint256 pot
    ) internal {
        AgentStats storage stats = agentStats[player];

        // Auto-register if not registered
        if (stats.agent == address(0)) {
            stats.agent = player;
            stats.rating = INITIAL_RATING;
            registeredAgents.push(player);
            emit AgentRegistered(player);
        }

        stats.gamesPlayed++;
        stats.totalWagered += pot / 2;
        stats.lastGameTimestamp = block.timestamp;

        if (winner == address(0)) {
            // Tie
            stats.ties++;
        } else if (winner == player) {
            stats.wins++;
            stats.totalWon += pot;
        } else {
            stats.losses++;
            stats.totalLost += pot / 2;
        }

        agentGameHistory[player].push(matchRecords[allMatches[allMatches.length - 1]].gameId);
    }

    function _updateElo(address winner, address loser) internal {
        AgentStats storage winnerStats = agentStats[winner];
        AgentStats storage loserStats = agentStats[loser];

        uint256 oldWinnerRating = winnerStats.rating;
        uint256 oldLoserRating = loserStats.rating;

        // Calculate expected scores
        uint256 expWinner = _expectedScore(winnerStats.rating, loserStats.rating);
        uint256 expLoser = 1000 - expWinner; // Scaled by 1000

        // Update ratings
        // Winner: R' = R + K * (1 - expected)
        // Loser: R' = R + K * (0 - expected)
        uint256 winnerGain = (K_FACTOR * (1000 - expWinner)) / 1000;
        uint256 loserLoss = (K_FACTOR * expLoser) / 1000;

        winnerStats.rating = winnerStats.rating + winnerGain;
        loserStats.rating = loserStats.rating > loserLoss ? loserStats.rating - loserLoss : 0;

        emit RatingUpdated(winner, oldWinnerRating, winnerStats.rating);
        emit RatingUpdated(loser, oldLoserRating, loserStats.rating);
    }

    /// @notice Calculate expected score (scaled by 1000)
    function _expectedScore(uint256 ratingA, uint256 ratingB) internal pure returns (uint256) {
        // E_A = 1 / (1 + 10^((R_B - R_A) / 400))
        // Simplified approximation for integer math
        int256 diff = int256(ratingB) - int256(ratingA);

        if (diff > 400) return 100; // ~0.1
        if (diff < -400) return 900; // ~0.9

        // Linear approximation between these points
        return uint256(500 - (diff * 400) / 800);
    }
}
