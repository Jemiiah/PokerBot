// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Commit-Reveal for Card Randomness
/// @notice Handles multi-party seed commitment and reveal for fair deck shuffling
contract CommitReveal {
    struct SeedState {
        bytes32 player1Commitment;
        bytes32 player2Commitment;
        bytes32 player1Seed;
        bytes32 player2Seed;
        bool player1Committed;
        bool player2Committed;
        bool player1Revealed;
        bool player2Revealed;
        uint256 commitDeadline;
        uint256 revealDeadline;
    }

    mapping(bytes32 => SeedState) public seedStates;

    uint256 public constant COMMIT_TIMEOUT = 60; // 60 seconds to commit
    uint256 public constant REVEAL_TIMEOUT = 60; // 60 seconds to reveal

    event SeedCommitted(bytes32 indexed gameId, address indexed player);
    event SeedRevealed(bytes32 indexed gameId, address indexed player);
    event RandomnessGenerated(bytes32 indexed gameId, bytes32 combinedSeed);

    error AlreadyCommitted();
    error NotCommitted();
    error AlreadyRevealed();
    error InvalidReveal();
    error CommitTimeout();
    error RevealTimeout();
    error NotBothCommitted();

    /// @notice Commit a seed hash
    /// @param gameId The game identifier
    /// @param commitment Hash of the seed (keccak256(seed))
    /// @param isPlayer1 Whether this is player 1
    function commitSeed(bytes32 gameId, bytes32 commitment, bool isPlayer1) external {
        SeedState storage state = seedStates[gameId];

        if (isPlayer1) {
            if (state.player1Committed) revert AlreadyCommitted();
            state.player1Commitment = commitment;
            state.player1Committed = true;
        } else {
            if (state.player2Committed) revert AlreadyCommitted();
            state.player2Commitment = commitment;
            state.player2Committed = true;
        }

        // Set commit deadline on first commitment
        if (state.commitDeadline == 0) {
            state.commitDeadline = block.timestamp + COMMIT_TIMEOUT;
        }

        // Set reveal deadline when both committed
        if (state.player1Committed && state.player2Committed) {
            state.revealDeadline = block.timestamp + REVEAL_TIMEOUT;
        }

        emit SeedCommitted(gameId, msg.sender);
    }

    /// @notice Reveal the original seed
    /// @param gameId The game identifier
    /// @param seed The original seed
    /// @param isPlayer1 Whether this is player 1
    function revealSeed(bytes32 gameId, bytes32 seed, bool isPlayer1) external {
        SeedState storage state = seedStates[gameId];

        if (!state.player1Committed || !state.player2Committed) {
            revert NotBothCommitted();
        }

        bytes32 commitment = keccak256(abi.encodePacked(seed));

        if (isPlayer1) {
            if (state.player1Revealed) revert AlreadyRevealed();
            if (commitment != state.player1Commitment) revert InvalidReveal();
            state.player1Seed = seed;
            state.player1Revealed = true;
        } else {
            if (state.player2Revealed) revert AlreadyRevealed();
            if (commitment != state.player2Commitment) revert InvalidReveal();
            state.player2Seed = seed;
            state.player2Revealed = true;
        }

        emit SeedRevealed(gameId, msg.sender);

        // Generate combined seed when both revealed
        if (state.player1Revealed && state.player2Revealed) {
            bytes32 combinedSeed = keccak256(
                abi.encodePacked(state.player1Seed, state.player2Seed, blockhash(block.number - 1))
            );
            emit RandomnessGenerated(gameId, combinedSeed);
        }
    }

    /// @notice Get the combined seed for deck generation
    /// @param gameId The game identifier
    /// @return The combined seed (only valid after both reveals)
    function getCombinedSeed(bytes32 gameId) external view returns (bytes32) {
        SeedState storage state = seedStates[gameId];
        require(state.player1Revealed && state.player2Revealed, "Not fully revealed");

        return keccak256(
            abi.encodePacked(state.player1Seed, state.player2Seed, blockhash(block.number - 1))
        );
    }

    /// @notice Check if randomness is ready
    /// @param gameId The game identifier
    /// @return Whether both players have revealed
    function isRandomnessReady(bytes32 gameId) external view returns (bool) {
        SeedState storage state = seedStates[gameId];
        return state.player1Revealed && state.player2Revealed;
    }

    /// @notice Get seed state for a game
    /// @param gameId The game identifier
    /// @return The seed state
    function getSeedState(bytes32 gameId) external view returns (SeedState memory) {
        return seedStates[gameId];
    }
}
