import type { Card, HoleCards } from '@poker/shared';
import { createDeck } from '@poker/shared';
import { HandEvaluator } from './HandEvaluator.js';

/**
 * Monte Carlo equity calculator for poker hands
 */
export class EquityCalculator {
  private handEvaluator: HandEvaluator;

  constructor() {
    this.handEvaluator = new HandEvaluator();
  }

  /**
   * Calculate equity using Monte Carlo simulation
   * @param holeCards Player's hole cards
   * @param communityCards Current community cards
   * @param numSimulations Number of simulations to run
   * @returns Equity as a value between 0 and 1
   */
  calculateEquity(
    holeCards: HoleCards,
    communityCards: Card[],
    numSimulations: number = 1000
  ): number {
    const deck = createDeck();

    // Remove known cards from deck
    const knownCards = new Set([
      ...holeCards.map(c => `${c.rank}${c.suit}`),
      ...communityCards.map(c => `${c.rank}${c.suit}`),
    ]);

    const remainingDeck = deck.filter(c => !knownCards.has(`${c.rank}${c.suit}`));

    let wins = 0;
    let ties = 0;

    for (let i = 0; i < numSimulations; i++) {
      const shuffled = this.shuffle([...remainingDeck]);

      // Deal opponent's hole cards
      const opponentHole: HoleCards = [shuffled[0], shuffled[1]];

      // Complete community cards if needed
      const cardsNeeded = 5 - communityCards.length;
      const completeCommunity = [
        ...communityCards,
        ...shuffled.slice(2, 2 + cardsNeeded),
      ];

      // Evaluate both hands
      const myHand = this.handEvaluator.evaluate([...holeCards, ...completeCommunity]);
      const oppHand = this.handEvaluator.evaluate([...opponentHole, ...completeCommunity]);

      const comparison = this.handEvaluator.compareHands(myHand, oppHand);

      if (comparison > 0) wins++;
      else if (comparison === 0) ties++;
    }

    // Equity = wins + (ties / 2)
    return (wins + ties / 2) / numSimulations;
  }

  /**
   * Calculate equity against a range of hands
   * @param holeCards Player's hole cards
   * @param communityCards Current community cards
   * @param opponentRange Array of possible opponent hole cards
   * @param numSimulations Simulations per opponent hand
   */
  calculateEquityVsRange(
    holeCards: HoleCards,
    communityCards: Card[],
    opponentRange: HoleCards[],
    numSimulations: number = 100
  ): number {
    if (opponentRange.length === 0) {
      return this.calculateEquity(holeCards, communityCards, numSimulations * 10);
    }

    let totalEquity = 0;

    for (const oppHand of opponentRange) {
      // Skip if opponent hand overlaps with known cards
      if (this.hasOverlap(oppHand, holeCards, communityCards)) {
        continue;
      }

      totalEquity += this.calculateEquityVsSpecificHand(
        holeCards,
        oppHand,
        communityCards,
        numSimulations
      );
    }

    return totalEquity / opponentRange.length;
  }

  /**
   * Calculate equity against a specific opponent hand
   */
  private calculateEquityVsSpecificHand(
    holeCards: HoleCards,
    opponentHole: HoleCards,
    communityCards: Card[],
    numSimulations: number
  ): number {
    const deck = createDeck();

    // Remove known cards
    const knownCards = new Set([
      ...holeCards.map(c => `${c.rank}${c.suit}`),
      ...opponentHole.map(c => `${c.rank}${c.suit}`),
      ...communityCards.map(c => `${c.rank}${c.suit}`),
    ]);

    const remainingDeck = deck.filter(c => !knownCards.has(`${c.rank}${c.suit}`));

    let wins = 0;
    let ties = 0;

    for (let i = 0; i < numSimulations; i++) {
      const shuffled = this.shuffle([...remainingDeck]);

      // Complete community cards
      const cardsNeeded = 5 - communityCards.length;
      const completeCommunity = [
        ...communityCards,
        ...shuffled.slice(0, cardsNeeded),
      ];

      // Evaluate both hands
      const myHand = this.handEvaluator.evaluate([...holeCards, ...completeCommunity]);
      const oppHand = this.handEvaluator.evaluate([...opponentHole, ...completeCommunity]);

      const comparison = this.handEvaluator.compareHands(myHand, oppHand);

      if (comparison > 0) wins++;
      else if (comparison === 0) ties++;
    }

    return (wins + ties / 2) / numSimulations;
  }

  /**
   * Check if hands have overlapping cards
   */
  private hasOverlap(oppHand: HoleCards, holeCards: HoleCards, communityCards: Card[]): boolean {
    const knownCards = new Set([
      ...holeCards.map(c => `${c.rank}${c.suit}`),
      ...communityCards.map(c => `${c.rank}${c.suit}`),
    ]);

    return oppHand.some(c => knownCards.has(`${c.rank}${c.suit}`));
  }

  /**
   * Fisher-Yates shuffle
   */
  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Calculate pot odds
   * @param toCall Amount to call
   * @param potSize Current pot size
   */
  calculatePotOdds(toCall: bigint, potSize: bigint): number {
    if (toCall === 0n) return 1; // Free to see
    return Number(toCall) / Number(potSize + toCall);
  }

  /**
   * Check if call is profitable based on equity and pot odds
   */
  isProfitableCall(equity: number, potOdds: number): boolean {
    return equity > potOdds;
  }

  /**
   * Calculate expected value of a call
   */
  calculateCallEV(equity: number, potSize: bigint, toCall: bigint): number {
    const potNum = Number(potSize);
    const callNum = Number(toCall);

    // EV = (equity * pot) - ((1 - equity) * call)
    return equity * potNum - (1 - equity) * callNum;
  }
}
