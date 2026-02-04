import type { HoleCards, ActionType } from '@poker/shared';
import { RANK_VALUES } from '@poker/shared';
import { holeCardsToNotation } from '@poker/shared';

/**
 * Preflop hand rankings and strategy
 */

// Hand strength tiers
export type HandTier = 'premium' | 'strong' | 'playable' | 'marginal' | 'trash';

// Preflop action recommendations
export interface PreflopRecommendation {
  tier: HandTier;
  strength: number; // 0-100
  action: ActionType;
  raiseMultiplier?: number; // For raises, multiplier of big blind
  reasoning: string;
}

// Preflop ranges (hand notation -> strength)
const PREFLOP_STRENGTHS: Record<string, number> = {
  // Premium (90-100)
  'AA': 100, 'KK': 98, 'QQ': 95, 'AKs': 93, 'JJ': 91, 'AKo': 90,

  // Strong (80-89)
  'AQs': 89, 'TT': 88, 'AQo': 87, 'AJs': 86, '99': 85, 'KQs': 84,
  'ATs': 83, 'KQo': 82, 'AJo': 81, '88': 80,

  // Playable (65-79)
  'KJs': 79, 'QJs': 78, 'ATo': 77, 'A9s': 76, '77': 75, 'KTs': 74,
  'KJo': 73, 'QTs': 72, 'A8s': 71, 'QJo': 70, 'JTs': 69, '66': 68,
  'A7s': 67, 'KTo': 66, 'A5s': 65,

  // Marginal (50-64)
  'A6s': 64, 'A4s': 63, 'QTo': 62, '55': 61, 'A3s': 60, 'K9s': 59,
  'JTo': 58, 'A2s': 57, 'Q9s': 56, '44': 55, 'J9s': 54, 'K8s': 53,
  'T9s': 52, 'A9o': 51, 'K9o': 50,

  // Marginal (35-49)
  'K7s': 49, '33': 48, 'Q8s': 47, 'T8s': 46, 'J8s': 45, '98s': 44,
  'K6s': 43, 'A8o': 42, 'Q9o': 41, '22': 40, 'K5s': 39, 'J9o': 38,
  '87s': 37, 'K4s': 36, 'T9o': 35,

  // Weak (20-34)
  'Q7s': 34, 'K3s': 33, '97s': 32, 'J7s': 31, '76s': 30, 'K2s': 29,
  'Q6s': 28, 'T7s': 27, '86s': 26, '65s': 25, 'Q5s': 24, 'A7o': 23,
  '96s': 22, '75s': 21, '54s': 20,

  // Trash (< 20)
  'Q4s': 19, 'Q3s': 18, 'T6s': 17, '64s': 16, 'Q2s': 15, '85s': 14,
  'J6s': 13, '53s': 12, 'J5s': 11, '74s': 10, 'J4s': 9, '95s': 8,
  'J3s': 7, '63s': 6, 'J2s': 5, '84s': 4, '43s': 3, 'T5s': 2,
};

/**
 * Preflop strategy engine
 */
export class PreflopStrategy {
  /**
   * Get hand strength (0-100) for hole cards
   */
  getHandStrength(holeCards: HoleCards): number {
    const notation = holeCardsToNotation(holeCards);
    return PREFLOP_STRENGTHS[notation] ?? this.estimateStrength(holeCards);
  }

  /**
   * Estimate strength for hands not in the table
   */
  private estimateStrength(holeCards: HoleCards): number {
    const [c1, c2] = holeCards;
    const r1 = RANK_VALUES[c1.rank];
    const r2 = RANK_VALUES[c2.rank];
    const suited = c1.suit === c2.suit;

    // Pair
    if (r1 === r2) {
      return Math.min(100, 20 + r1 * 5);
    }

    // High cards
    const high = Math.max(r1, r2);
    const low = Math.min(r1, r2);
    const gap = high - low;

    let strength = (high * 2 + low) / 3;

    // Bonus for suited
    if (suited) strength += 4;

    // Penalty for gap
    strength -= gap * 2;

    // Bonus for connectedness
    if (gap === 1) strength += 3;
    if (gap === 2) strength += 1;

    return Math.max(0, Math.min(100, strength * 3));
  }

  /**
   * Get the tier for a hand
   */
  getHandTier(strength: number): HandTier {
    if (strength >= 90) return 'premium';
    if (strength >= 75) return 'strong';
    if (strength >= 55) return 'playable';
    if (strength >= 35) return 'marginal';
    return 'trash';
  }

  /**
   * Get preflop recommendation
   */
  getRecommendation(
    holeCards: HoleCards,
    position: 'button' | 'big_blind',
    facingRaise: boolean,
    raiseAmount: bigint,
    potSize: bigint
  ): PreflopRecommendation {
    const strength = this.getHandStrength(holeCards);
    const tier = this.getHandTier(strength);

    // Button strategy (more aggressive as dealer)
    if (position === 'button') {
      return this.getButtonStrategy(strength, tier, facingRaise, raiseAmount, potSize);
    }

    // Big blind strategy (defensive)
    return this.getBigBlindStrategy(strength, tier, facingRaise, raiseAmount, potSize);
  }

  /**
   * Button (dealer) strategy
   */
  private getButtonStrategy(
    strength: number,
    tier: HandTier,
    facingRaise: boolean,
    _raiseAmount: bigint,
    _potSize: bigint
  ): PreflopRecommendation {
    if (!facingRaise) {
      // Open raising from button
      if (tier === 'premium') {
        return {
          tier,
          strength,
          action: 'raise',
          raiseMultiplier: 3,
          reasoning: 'Premium hand, raise for value from button',
        };
      }
      if (tier === 'strong' || tier === 'playable') {
        return {
          tier,
          strength,
          action: 'raise',
          raiseMultiplier: 2.5,
          reasoning: 'Playable hand, steal attempt from button',
        };
      }
      if (tier === 'marginal' && Math.random() < 0.5) {
        return {
          tier,
          strength,
          action: 'raise',
          raiseMultiplier: 2,
          reasoning: 'Marginal hand, occasional steal attempt',
        };
      }
      return {
        tier,
        strength,
        action: 'fold',
        reasoning: 'Weak hand, fold even from button',
      };
    }

    // Facing a raise
    if (tier === 'premium') {
      return {
        tier,
        strength,
        action: 'raise',
        raiseMultiplier: 3,
        reasoning: 'Premium hand, 3-bet for value',
      };
    }
    if (tier === 'strong') {
      // Mix of calls and 3-bets
      if (Math.random() < 0.4) {
        return {
          tier,
          strength,
          action: 'raise',
          raiseMultiplier: 3,
          reasoning: 'Strong hand, occasional 3-bet',
        };
      }
      return {
        tier,
        strength,
        action: 'call',
        reasoning: 'Strong hand, call to see flop',
      };
    }
    if (tier === 'playable') {
      return {
        tier,
        strength,
        action: 'call',
        reasoning: 'Playable hand with position, call',
      };
    }

    return {
      tier,
      strength,
      action: 'fold',
      reasoning: 'Weak hand facing raise, fold',
    };
  }

  /**
   * Big blind strategy
   */
  private getBigBlindStrategy(
    strength: number,
    tier: HandTier,
    facingRaise: boolean,
    raiseAmount: bigint,
    potSize: bigint
  ): PreflopRecommendation {
    if (!facingRaise) {
      // Just check the big blind
      if (tier === 'premium' || tier === 'strong') {
        return {
          tier,
          strength,
          action: 'raise',
          raiseMultiplier: 3,
          reasoning: 'Strong hand in BB, raise for value',
        };
      }
      return {
        tier,
        strength,
        action: 'check',
        reasoning: 'Check option in big blind',
      };
    }

    // Facing a raise
    const potOdds = Number(raiseAmount) / Number(potSize + raiseAmount);

    if (tier === 'premium') {
      return {
        tier,
        strength,
        action: 'raise',
        raiseMultiplier: 3,
        reasoning: 'Premium hand, 3-bet from big blind',
      };
    }
    if (tier === 'strong') {
      if (Math.random() < 0.3) {
        return {
          tier,
          strength,
          action: 'raise',
          raiseMultiplier: 3,
          reasoning: 'Strong hand, occasional 3-bet',
        };
      }
      return {
        tier,
        strength,
        action: 'call',
        reasoning: 'Strong hand, defend big blind',
      };
    }
    if (tier === 'playable' && potOdds < 0.25) {
      return {
        tier,
        strength,
        action: 'call',
        reasoning: 'Playable hand with good pot odds',
      };
    }
    if (tier === 'marginal' && potOdds < 0.15) {
      return {
        tier,
        strength,
        action: 'call',
        reasoning: 'Marginal hand with great pot odds',
      };
    }

    return {
      tier,
      strength,
      action: 'fold',
      reasoning: 'Weak hand facing raise, fold',
    };
  }

  /**
   * Check if hand is in a specific range
   */
  isInRange(holeCards: HoleCards, minStrength: number): boolean {
    return this.getHandStrength(holeCards) >= minStrength;
  }
}
