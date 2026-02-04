// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CardConstants.sol";

/// @title Hand Evaluator
/// @notice Evaluates 7-card poker hands to find the best 5-card combination
library HandEvaluator {
    using CardConstants for uint8;

    struct HandResult {
        uint8 handRank; // Type of hand (pair, flush, etc.)
        uint32 value; // Numeric value for comparison within same rank
    }

    /// @notice Evaluate a 7-card hand and return its ranking
    /// @param cards Array of 7 card indices (0-51)
    /// @return result The hand ranking and value
    function evaluate(uint8[7] memory cards) internal pure returns (HandResult memory result) {
        // Count ranks and suits
        uint8[13] memory rankCounts;
        uint8[4] memory suitCounts;

        for (uint256 i = 0; i < 7; i++) {
            uint8 rank = CardConstants.getRank(cards[i]);
            uint8 suit = CardConstants.getSuit(cards[i]);
            rankCounts[rank]++;
            suitCounts[suit]++;
        }

        // Check for flush
        int8 flushSuit = -1;
        for (uint8 s = 0; s < 4; s++) {
            if (suitCounts[s] >= 5) {
                flushSuit = int8(s);
                break;
            }
        }

        // Get flush cards if flush exists
        uint8[7] memory flushCards;
        uint8 flushCount = 0;
        if (flushSuit >= 0) {
            for (uint256 i = 0; i < 7; i++) {
                if (CardConstants.getSuit(cards[i]) == uint8(flushSuit)) {
                    flushCards[flushCount++] = CardConstants.getRank(cards[i]);
                }
            }
        }

        // Check for straight flush
        if (flushSuit >= 0) {
            int8 straightHigh = _checkStraight(flushCards, flushCount);
            if (straightHigh >= 0) {
                if (straightHigh == 12) {
                    // Royal flush (A-high straight flush)
                    result.handRank = CardConstants.ROYAL_FLUSH;
                    result.value = 0;
                } else {
                    result.handRank = CardConstants.STRAIGHT_FLUSH;
                    result.value = uint32(uint8(straightHigh));
                }
                return result;
            }
        }

        // Count pairs, trips, quads
        uint8 pairs = 0;
        uint8 trips = 0;
        uint8 quads = 0;
        uint8 quadRank = 0;
        uint8 tripRank = 0;
        uint8[2] memory pairRanks;
        uint8 pairIdx = 0;

        // Count from highest rank down
        for (int8 r = 12; r >= 0; r--) {
            uint8 rank = uint8(r);
            if (rankCounts[rank] == 4) {
                quads++;
                quadRank = rank;
            } else if (rankCounts[rank] == 3) {
                trips++;
                if (tripRank == 0 || rank > tripRank) {
                    tripRank = rank;
                }
            } else if (rankCounts[rank] == 2) {
                pairs++;
                if (pairIdx < 2) {
                    pairRanks[pairIdx++] = rank;
                }
            }
        }

        // Four of a kind
        if (quads > 0) {
            result.handRank = CardConstants.FOUR_OF_A_KIND;
            uint8 kicker = _getHighestExcluding(rankCounts, quadRank, 255);
            result.value = uint32(quadRank) * 16 + uint32(kicker);
            return result;
        }

        // Full house
        if (trips > 0 && (pairs > 0 || trips > 1)) {
            result.handRank = CardConstants.FULL_HOUSE;
            uint8 pairRank = pairs > 0 ? pairRanks[0] : _getSecondTrip(rankCounts, tripRank);
            result.value = uint32(tripRank) * 16 + uint32(pairRank);
            return result;
        }

        // Flush
        if (flushSuit >= 0) {
            result.handRank = CardConstants.FLUSH;
            result.value = _getFlushValue(flushCards, flushCount);
            return result;
        }

        // Straight (check all 7 cards)
        uint8[7] memory allRanks;
        for (uint256 i = 0; i < 7; i++) {
            allRanks[i] = CardConstants.getRank(cards[i]);
        }
        int8 straightHigh = _checkStraight(allRanks, 7);
        if (straightHigh >= 0) {
            result.handRank = CardConstants.STRAIGHT;
            result.value = uint32(uint8(straightHigh));
            return result;
        }

        // Three of a kind
        if (trips > 0) {
            result.handRank = CardConstants.THREE_OF_A_KIND;
            uint8 k1 = _getHighestExcluding(rankCounts, tripRank, 255);
            uint8 k2 = _getHighestExcluding(rankCounts, tripRank, k1);
            result.value = uint32(tripRank) * 256 + uint32(k1) * 16 + uint32(k2);
            return result;
        }

        // Two pair
        if (pairs >= 2) {
            result.handRank = CardConstants.TWO_PAIR;
            uint8 kicker = _getHighestExcluding2(rankCounts, pairRanks[0], pairRanks[1]);
            result.value = uint32(pairRanks[0]) * 256 + uint32(pairRanks[1]) * 16 + uint32(kicker);
            return result;
        }

        // One pair
        if (pairs == 1) {
            result.handRank = CardConstants.PAIR;
            uint8 k1 = _getHighestExcluding(rankCounts, pairRanks[0], 255);
            uint8 k2 = _getHighestExcluding(rankCounts, pairRanks[0], k1);
            uint8 k3 = _getHighestExcluding(rankCounts, pairRanks[0], k2);
            result.value =
                uint32(pairRanks[0]) * 4096 + uint32(k1) * 256 + uint32(k2) * 16 + uint32(k3);
            return result;
        }

        // High card
        result.handRank = CardConstants.HIGH_CARD;
        result.value = _getHighCardValue(rankCounts);
        return result;
    }

    /// @notice Compare two hands, returns 1 if hand1 wins, -1 if hand2 wins, 0 if tie
    function compare(
        HandResult memory hand1,
        HandResult memory hand2
    ) internal pure returns (int8) {
        if (hand1.handRank > hand2.handRank) return 1;
        if (hand1.handRank < hand2.handRank) return -1;
        if (hand1.value > hand2.value) return 1;
        if (hand1.value < hand2.value) return -1;
        return 0;
    }

    // Internal helper functions

    function _checkStraight(uint8[7] memory ranks, uint8 count) private pure returns (int8) {
        bool[13] memory hasRank;
        for (uint8 i = 0; i < count; i++) {
            hasRank[ranks[i]] = true;
        }

        // Check for straights (high to low)
        for (int8 high = 12; high >= 4; high--) {
            bool isStraight = true;
            for (int8 j = 0; j < 5; j++) {
                if (!hasRank[uint8(high - j)]) {
                    isStraight = false;
                    break;
                }
            }
            if (isStraight) return high;
        }

        // Check for A-2-3-4-5 (wheel)
        if (hasRank[12] && hasRank[0] && hasRank[1] && hasRank[2] && hasRank[3]) {
            return 3; // 5-high straight
        }

        return -1;
    }

    function _getHighestExcluding(
        uint8[13] memory rankCounts,
        uint8 exclude1,
        uint8 exclude2
    ) private pure returns (uint8) {
        for (int8 r = 12; r >= 0; r--) {
            uint8 rank = uint8(r);
            if (rankCounts[rank] > 0 && rank != exclude1 && rank != exclude2) {
                return rank;
            }
        }
        return 0;
    }

    function _getHighestExcluding2(
        uint8[13] memory rankCounts,
        uint8 exclude1,
        uint8 exclude2
    ) private pure returns (uint8) {
        for (int8 r = 12; r >= 0; r--) {
            uint8 rank = uint8(r);
            if (rankCounts[rank] > 0 && rank != exclude1 && rank != exclude2) {
                return rank;
            }
        }
        return 0;
    }

    function _getSecondTrip(uint8[13] memory rankCounts, uint8 firstTrip) private pure returns (uint8) {
        for (int8 r = 12; r >= 0; r--) {
            uint8 rank = uint8(r);
            if (rankCounts[rank] == 3 && rank != firstTrip) {
                return rank;
            }
        }
        return 0;
    }

    function _getFlushValue(uint8[7] memory flushRanks, uint8 count) private pure returns (uint32) {
        // Sort flush ranks descending and take top 5
        uint8[7] memory sorted = flushRanks;
        for (uint8 i = 0; i < count - 1; i++) {
            for (uint8 j = i + 1; j < count; j++) {
                if (sorted[j] > sorted[i]) {
                    (sorted[i], sorted[j]) = (sorted[j], sorted[i]);
                }
            }
        }

        // Encode top 5 cards
        return uint32(sorted[0]) * 65536 + uint32(sorted[1]) * 4096 + uint32(sorted[2]) * 256
            + uint32(sorted[3]) * 16 + uint32(sorted[4]);
    }

    function _getHighCardValue(uint8[13] memory rankCounts) private pure returns (uint32) {
        uint8[5] memory top;
        uint8 idx = 0;

        for (int8 r = 12; r >= 0 && idx < 5; r--) {
            uint8 rank = uint8(r);
            for (uint8 c = 0; c < rankCounts[rank] && idx < 5; c++) {
                top[idx++] = rank;
            }
        }

        return uint32(top[0]) * 65536 + uint32(top[1]) * 4096 + uint32(top[2]) * 256
            + uint32(top[3]) * 16 + uint32(top[4]);
    }
}
