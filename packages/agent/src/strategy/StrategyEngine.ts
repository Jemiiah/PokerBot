import type { Card, HoleCards, Decision, ActionType } from '@poker/shared';
import { HandEvaluator } from './HandEvaluator.js';
import { EquityCalculator } from './EquityCalculator.js';
import { PreflopStrategy, type PreflopRecommendation } from './PreflopStrategy.js';
import { createChildLogger } from '../utils/logger.js';
import {
  MIN_PLAYABLE_EQUITY,
  STRONG_HAND_EQUITY,
  PREMIUM_HAND_EQUITY,
  POT_BET_RATIO,
  VALUE_BET_RATIO,
  BLUFF_FREQUENCY,
} from '../utils/constants.js';

const logger = createChildLogger('StrategyEngine');

interface StrategyContext {
  gameId: string;
  holeCards: HoleCards;
  communityCards: Card[];
  phase: string;
  position: 'button' | 'big_blind';
  potSize: bigint;
  currentBet: bigint;
  myChips: bigint;
  opponentChips: bigint;
  toCall: bigint;
  lastOpponentAction?: ActionType;
}

/**
 * Main strategy engine that combines all strategy components
 */
export class StrategyEngine {
  private handEvaluator: HandEvaluator;
  private equityCalculator: EquityCalculator;
  private preflopStrategy: PreflopStrategy;

  constructor() {
    this.handEvaluator = new HandEvaluator();
    this.equityCalculator = new EquityCalculator();
    this.preflopStrategy = new PreflopStrategy();
  }

  /**
   * Make a decision based on the current game state
   */
  async decide(context: StrategyContext): Promise<Decision> {
    logger.info(
      {
        gameId: context.gameId,
        phase: context.phase,
        position: context.position,
        pot: context.potSize.toString(),
        toCall: context.toCall.toString(),
      },
      'Making decision'
    );

    if (context.phase === 'preflop') {
      return this.decidePrefop(context);
    }

    return this.decidePostflop(context);
  }

  /**
   * Preflop decision making
   */
  private decidePrefop(context: StrategyContext): Decision {
    const facingRaise = context.toCall > 0n;
    const recommendation = this.preflopStrategy.getRecommendation(
      context.holeCards,
      context.position,
      facingRaise,
      context.toCall,
      context.potSize
    );

    logger.info(
      {
        tier: recommendation.tier,
        strength: recommendation.strength,
        action: recommendation.action,
        reasoning: recommendation.reasoning,
      },
      'Preflop recommendation'
    );

    return this.convertRecommendation(recommendation, context);
  }

  /**
   * Postflop decision making (flop, turn, river)
   */
  private decidePostflop(context: StrategyContext): Decision {
    // Calculate equity
    const equity = this.equityCalculator.calculateEquity(
      context.holeCards,
      context.communityCards,
      500 // Simulations
    );

    // Calculate pot odds
    const potOdds = this.equityCalculator.calculatePotOdds(
      context.toCall,
      context.potSize
    );

    logger.info(
      {
        equity: equity.toFixed(3),
        potOdds: potOdds.toFixed(3),
        phase: context.phase,
      },
      'Postflop analysis'
    );

    // Evaluate current hand
    const currentHand = this.handEvaluator.evaluate([
      ...context.holeCards,
      ...context.communityCards,
    ]);

    // Decision logic based on equity and situation
    return this.makePostflopDecision(context, equity, potOdds, currentHand);
  }

  /**
   * Make a postflop decision
   */
  private makePostflopDecision(
    context: StrategyContext,
    equity: number,
    potOdds: number,
    _currentHand: any
  ): Decision {
    const toCallNum = Number(context.toCall);
    const potNum = Number(context.potSize);
    const myChipsNum = Number(context.myChips);

    // Strong made hand - value bet or raise
    if (equity >= PREMIUM_HAND_EQUITY) {
      if (context.toCall === 0n) {
        // We can bet
        const betAmount = BigInt(Math.floor(potNum * VALUE_BET_RATIO));
        return {
          action: 'raise',
          amount: betAmount,
          confidence: 0.9,
          reasoning: `Strong hand (equity: ${(equity * 100).toFixed(1)}%), betting for value`,
        };
      } else {
        // Facing a bet - raise for value
        const raiseAmount = context.currentBet * 3n;
        if (raiseAmount <= context.myChips) {
          return {
            action: 'raise',
            amount: raiseAmount,
            confidence: 0.85,
            reasoning: `Strong hand, raising for value`,
          };
        }
        return {
          action: 'call',
          confidence: 0.9,
          reasoning: `Strong hand, calling (not enough to raise)`,
        };
      }
    }

    // Good hand - bet/call
    if (equity >= STRONG_HAND_EQUITY) {
      if (context.toCall === 0n) {
        const betAmount = BigInt(Math.floor(potNum * POT_BET_RATIO * 0.7));
        return {
          action: 'raise',
          amount: betAmount,
          confidence: 0.75,
          reasoning: `Good hand (equity: ${(equity * 100).toFixed(1)}%), betting`,
        };
      }

      // Profitable call
      if (equity > potOdds) {
        return {
          action: 'call',
          confidence: 0.7,
          reasoning: `Good equity vs pot odds, calling`,
        };
      }
    }

    // Marginal hand - check/call based on pot odds
    if (equity >= MIN_PLAYABLE_EQUITY) {
      if (context.toCall === 0n) {
        // Check or small bet as semi-bluff
        if (Math.random() < 0.3) {
          const betAmount = BigInt(Math.floor(potNum * 0.4));
          return {
            action: 'raise',
            amount: betAmount,
            confidence: 0.5,
            reasoning: `Semi-bluff with marginal hand`,
          };
        }
        return {
          action: 'check',
          confidence: 0.6,
          reasoning: `Marginal hand, checking`,
        };
      }

      // Check pot odds
      if (equity > potOdds) {
        return {
          action: 'call',
          confidence: 0.55,
          reasoning: `Pot odds favorable, calling with marginal hand`,
        };
      }
    }

    // Weak hand
    if (context.toCall === 0n) {
      // Occasional bluff
      if (Math.random() < BLUFF_FREQUENCY && context.phase !== 'river') {
        const bluffAmount = BigInt(Math.floor(potNum * POT_BET_RATIO));
        return {
          action: 'raise',
          amount: bluffAmount,
          confidence: 0.3,
          reasoning: `Bluffing with weak hand`,
        };
      }
      return {
        action: 'check',
        confidence: 0.7,
        reasoning: `Weak hand, checking`,
      };
    }

    // Facing a bet with weak hand - usually fold
    // Small chance of bluff raise (especially if pot is large)
    if (Math.random() < 0.1 && toCallNum < myChipsNum * 0.1) {
      const bluffRaiseAmount = context.currentBet * 3n;
      return {
        action: 'raise',
        amount: bluffRaiseAmount,
        confidence: 0.2,
        reasoning: `Bluff raise attempt`,
      };
    }

    return {
      action: 'fold',
      confidence: 0.8,
      reasoning: `Weak hand facing bet, folding (equity: ${(equity * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Convert preflop recommendation to decision
   */
  private convertRecommendation(
    rec: PreflopRecommendation,
    context: StrategyContext
  ): Decision {
    let amount: bigint | undefined;

    if (rec.action === 'raise' && rec.raiseMultiplier) {
      // Calculate raise based on multiplier of big blind
      const bigBlind = context.potSize / 3n; // Approximate BB from pot
      amount = bigBlind * BigInt(Math.floor(rec.raiseMultiplier));

      // Ensure raise is at least current bet * 2
      if (amount < context.currentBet * 2n) {
        amount = context.currentBet * 2n;
      }

      // Cap at our stack
      if (amount > context.myChips) {
        amount = context.myChips;
      }
    }

    return {
      action: rec.action,
      amount,
      confidence: rec.strength / 100,
      reasoning: rec.reasoning,
    };
  }

  /**
   * Get hand evaluator for external use
   */
  getHandEvaluator(): HandEvaluator {
    return this.handEvaluator;
  }

  /**
   * Get equity calculator for external use
   */
  getEquityCalculator(): EquityCalculator {
    return this.equityCalculator;
  }
}
