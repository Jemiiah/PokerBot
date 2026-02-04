// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Card Constants
/// @notice Constants for card representation and hand rankings
library CardConstants {
    // Card indices: 0-51
    // Index = rank * 4 + suit
    // Ranks: 0=2, 1=3, ..., 8=T, 9=J, 10=Q, 11=K, 12=A
    // Suits: 0=spades, 1=hearts, 2=diamonds, 3=clubs

    uint8 internal constant DECK_SIZE = 52;
    uint8 internal constant SUITS = 4;
    uint8 internal constant RANKS = 13;

    // Hand rankings (higher is better)
    uint8 internal constant HIGH_CARD = 1;
    uint8 internal constant PAIR = 2;
    uint8 internal constant TWO_PAIR = 3;
    uint8 internal constant THREE_OF_A_KIND = 4;
    uint8 internal constant STRAIGHT = 5;
    uint8 internal constant FLUSH = 6;
    uint8 internal constant FULL_HOUSE = 7;
    uint8 internal constant FOUR_OF_A_KIND = 8;
    uint8 internal constant STRAIGHT_FLUSH = 9;
    uint8 internal constant ROYAL_FLUSH = 10;

    /// @notice Get the rank of a card (0-12)
    function getRank(uint8 card) internal pure returns (uint8) {
        require(card < DECK_SIZE, "Invalid card");
        return card / SUITS;
    }

    /// @notice Get the suit of a card (0-3)
    function getSuit(uint8 card) internal pure returns (uint8) {
        require(card < DECK_SIZE, "Invalid card");
        return card % SUITS;
    }

    /// @notice Create a card from rank and suit
    function makeCard(uint8 rank, uint8 suit) internal pure returns (uint8) {
        require(rank < RANKS && suit < SUITS, "Invalid rank or suit");
        return rank * SUITS + suit;
    }
}
