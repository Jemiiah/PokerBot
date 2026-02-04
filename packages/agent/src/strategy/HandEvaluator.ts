import type { Card, HandRank, HandRankType } from '@poker/shared';
import { RANK_VALUES, HAND_RANK_VALUES } from '@poker/shared';

/**
 * Evaluates poker hands and determines rankings
 */
export class HandEvaluator {
  /**
   * Evaluate a 7-card hand (2 hole + 5 community) and return the best 5-card hand
   */
  evaluate(cards: Card[]): HandRank {
    if (cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate');
    }

    // Generate all 5-card combinations if more than 5 cards
    const combinations = cards.length === 5 ? [cards] : this.getCombinations(cards, 5);

    let bestHand: HandRank | null = null;

    for (const combo of combinations) {
      const handRank = this.evaluate5Cards(combo);
      if (!bestHand || this.compareHands(handRank, bestHand) > 0) {
        bestHand = handRank;
      }
    }

    return bestHand!;
  }

  /**
   * Evaluate exactly 5 cards
   */
  private evaluate5Cards(cards: Card[]): HandRank {
    const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);

    // Check for flush
    const isFlush = cards.every(c => c.suit === cards[0].suit);

    // Check for straight
    const ranks = sorted.map(c => RANK_VALUES[c.rank]);
    const isStraight = this.checkStraight(ranks);
    const straightHigh = isStraight ? this.getStraightHigh(ranks) : 0;

    // Count ranks
    const rankCounts = new Map<string, Card[]>();
    for (const card of cards) {
      const existing = rankCounts.get(card.rank) || [];
      existing.push(card);
      rankCounts.set(card.rank, existing);
    }

    const counts = Array.from(rankCounts.values()).sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length;
      return RANK_VALUES[b[0].rank] - RANK_VALUES[a[0].rank];
    });

    // Determine hand type
    if (isFlush && isStraight) {
      if (straightHigh === 14) {
        return this.makeHandRank('royal_flush', 0, sorted, []);
      }
      return this.makeHandRank('straight_flush', straightHigh, sorted, []);
    }

    if (counts[0].length === 4) {
      const quadCards = counts[0];
      const kicker = counts[1][0];
      return this.makeHandRank(
        'four_of_a_kind',
        RANK_VALUES[quadCards[0].rank] * 100 + RANK_VALUES[kicker.rank],
        quadCards,
        [kicker]
      );
    }

    if (counts[0].length === 3 && counts[1].length === 2) {
      const tripCards = counts[0];
      const pairCards = counts[1];
      return this.makeHandRank(
        'full_house',
        RANK_VALUES[tripCards[0].rank] * 100 + RANK_VALUES[pairCards[0].rank],
        [...tripCards, ...pairCards],
        []
      );
    }

    if (isFlush) {
      const value = ranks.reduce((acc, r, i) => acc + r * Math.pow(15, 4 - i), 0);
      return this.makeHandRank('flush', value, sorted, []);
    }

    if (isStraight) {
      return this.makeHandRank('straight', straightHigh, sorted, []);
    }

    if (counts[0].length === 3) {
      const tripCards = counts[0];
      const kickers = [counts[1][0], counts[2][0]].sort(
        (a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]
      );
      const value =
        RANK_VALUES[tripCards[0].rank] * 10000 +
        RANK_VALUES[kickers[0].rank] * 100 +
        RANK_VALUES[kickers[1].rank];
      return this.makeHandRank('three_of_a_kind', value, tripCards, kickers);
    }

    if (counts[0].length === 2 && counts[1].length === 2) {
      const highPair = counts[0];
      const lowPair = counts[1];
      const kicker = counts[2][0];
      const value =
        RANK_VALUES[highPair[0].rank] * 10000 +
        RANK_VALUES[lowPair[0].rank] * 100 +
        RANK_VALUES[kicker.rank];
      return this.makeHandRank('two_pair', value, [...highPair, ...lowPair], [kicker]);
    }

    if (counts[0].length === 2) {
      const pairCards = counts[0];
      const kickers = counts.slice(1).map(c => c[0]).slice(0, 3);
      const value =
        RANK_VALUES[pairCards[0].rank] * 1000000 +
        RANK_VALUES[kickers[0].rank] * 10000 +
        RANK_VALUES[kickers[1].rank] * 100 +
        RANK_VALUES[kickers[2].rank];
      return this.makeHandRank('pair', value, pairCards, kickers);
    }

    // High card
    const value = ranks.reduce((acc, r, i) => acc + r * Math.pow(15, 4 - i), 0);
    return this.makeHandRank('high_card', value, sorted.slice(0, 5), []);
  }

  /**
   * Check if ranks form a straight
   */
  private checkStraight(ranks: number[]): boolean {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

    // Check for A-2-3-4-5 (wheel)
    if (
      uniqueRanks.includes(14) &&
      uniqueRanks.includes(2) &&
      uniqueRanks.includes(3) &&
      uniqueRanks.includes(4) &&
      uniqueRanks.includes(5)
    ) {
      return true;
    }

    // Check for consecutive ranks
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      let isConsecutive = true;
      for (let j = 0; j < 4; j++) {
        if (uniqueRanks[i + j] - uniqueRanks[i + j + 1] !== 1) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) return true;
    }

    return false;
  }

  /**
   * Get the high card of a straight
   */
  private getStraightHigh(ranks: number[]): number {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

    // Check for wheel (A-2-3-4-5)
    if (
      uniqueRanks.includes(14) &&
      uniqueRanks.includes(2) &&
      uniqueRanks.includes(3) &&
      uniqueRanks.includes(4) &&
      uniqueRanks.includes(5)
    ) {
      return 5; // 5-high straight
    }

    // Find highest consecutive sequence
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      let isConsecutive = true;
      for (let j = 0; j < 4; j++) {
        if (uniqueRanks[i + j] - uniqueRanks[i + j + 1] !== 1) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) return uniqueRanks[i];
    }

    return 0;
  }

  /**
   * Create a HandRank object
   */
  private makeHandRank(
    rank: HandRankType,
    value: number,
    cards: Card[],
    kickers: Card[]
  ): HandRank {
    return { rank, value, cards: cards.slice(0, 5), kickers };
  }

  /**
   * Compare two hands: returns positive if hand1 wins, negative if hand2 wins, 0 for tie
   */
  compareHands(hand1: HandRank, hand2: HandRank): number {
    const rank1 = HAND_RANK_VALUES[hand1.rank];
    const rank2 = HAND_RANK_VALUES[hand2.rank];

    if (rank1 !== rank2) {
      return rank1 - rank2;
    }

    return hand1.value - hand2.value;
  }

  /**
   * Get all k-combinations from array
   */
  private getCombinations<T>(arr: T[], k: number): T[][] {
    const result: T[][] = [];

    function backtrack(start: number, current: T[]) {
      if (current.length === k) {
        result.push([...current]);
        return;
      }

      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    }

    backtrack(0, []);
    return result;
  }
}
