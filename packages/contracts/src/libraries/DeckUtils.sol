// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CardConstants.sol";

/// @title Deck Utilities
/// @notice Functions for deck shuffling and card dealing using commit-reveal randomness
library DeckUtils {
    /// @notice Generate a shuffled deck from combined seeds using Fisher-Yates
    /// @param seed Combined seed from all participants
    /// @return deck Shuffled deck of 52 cards (indices 0-51)
    function shuffleDeck(bytes32 seed) internal pure returns (uint8[52] memory deck) {
        // Initialize deck
        for (uint8 i = 0; i < 52; i++) {
            deck[i] = i;
        }

        // Fisher-Yates shuffle using seed-derived randomness
        bytes32 currentSeed = seed;
        for (uint256 i = 51; i > 0; i--) {
            currentSeed = keccak256(abi.encodePacked(currentSeed, i));
            uint256 j = uint256(currentSeed) % (i + 1);
            (deck[i], deck[uint8(j)]) = (deck[uint8(j)], deck[i]);
        }

        return deck;
    }

    /// @notice Create a commitment hash for cards
    /// @param cards The cards being committed
    /// @param salt Random salt for hiding
    /// @return Commitment hash
    function createCommitment(
        uint8[2] memory cards,
        bytes32 salt
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(cards[0], cards[1], salt));
    }

    /// @notice Verify a card commitment
    /// @param commitment The original commitment
    /// @param cards The revealed cards
    /// @param salt The revealed salt
    /// @return Whether the commitment is valid
    function verifyCommitment(
        bytes32 commitment,
        uint8[2] memory cards,
        bytes32 salt
    ) internal pure returns (bool) {
        return commitment == createCommitment(cards, salt);
    }

    /// @notice Combine multiple seeds for deck generation
    /// @param seeds Array of seeds from participants
    /// @param blockHash Block hash for additional entropy
    /// @return Combined seed
    function combineSeeds(
        bytes32[] memory seeds,
        bytes32 blockHash
    ) internal pure returns (bytes32) {
        bytes32 combined = blockHash;
        for (uint256 i = 0; i < seeds.length; i++) {
            combined = keccak256(abi.encodePacked(combined, seeds[i]));
        }
        return combined;
    }

    /// @notice Check if a card array contains duplicates
    /// @param cards Array of card indices
    /// @return hasDuplicates True if duplicates exist
    function hasDuplicates(uint8[] memory cards) internal pure returns (bool) {
        bool[52] memory seen;
        for (uint256 i = 0; i < cards.length; i++) {
            if (cards[i] >= 52) return true; // Invalid card
            if (seen[cards[i]]) return true;
            seen[cards[i]] = true;
        }
        return false;
    }
}
