import type { BankrollState } from '@poker/shared';
import { createChildLogger } from '../utils/logger.js';
import { config } from '../utils/config.js';

const logger = createChildLogger('BankrollManager');

export interface SessionStats {
  startBalance: bigint;
  currentBalance: bigint;
  gamesPlayed: number;
  wins: number;
  losses: number;
  biggestWin: bigint;
  biggestLoss: bigint;
  startTime: number;
}

/**
 * Manages bankroll and risk for the poker agent
 */
export class BankrollManager {
  private bankrollState: BankrollState;
  private sessionStats: SessionStats;
  private kellyFraction: number;
  private maxRiskPercent: number;

  constructor(initialBalance: bigint) {
    this.bankrollState = {
      totalBalance: initialBalance,
      availableBalance: initialBalance,
      inPlay: 0n,
      sessionProfit: 0n,
      allTimeProfit: 0n,
    };

    this.sessionStats = {
      startBalance: initialBalance,
      currentBalance: initialBalance,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      biggestWin: 0n,
      biggestLoss: 0n,
      startTime: Date.now(),
    };

    this.kellyFraction = config.kellyFraction;
    this.maxRiskPercent = config.maxWagerPercent / 100;

    logger.info(
      {
        balance: initialBalance.toString(),
        kellyFraction: this.kellyFraction,
        maxRisk: this.maxRiskPercent,
      },
      'Bankroll manager initialized'
    );
  }

  /**
   * Calculate optimal wager using Kelly Criterion
   */
  calculateOptimalWager(winProbability: number, payoutRatio: number = 1): bigint {
    // Kelly formula: f* = (bp - q) / b
    // b = odds received (payout ratio)
    // p = probability of winning
    // q = probability of losing (1 - p)

    const b = payoutRatio;
    const p = winProbability;
    const q = 1 - p;

    let kellyFraction = (b * p - q) / b;

    // Apply fractional Kelly for reduced variance
    kellyFraction = Math.max(0, kellyFraction * this.kellyFraction);

    // Cap at maximum risk
    kellyFraction = Math.min(kellyFraction, this.maxRiskPercent);

    const optimalWager = BigInt(
      Math.floor(Number(this.bankrollState.availableBalance) * kellyFraction)
    );

    logger.debug(
      {
        winProb: winProbability.toFixed(3),
        kelly: kellyFraction.toFixed(4),
        wager: optimalWager.toString(),
      },
      'Calculated optimal wager'
    );

    return optimalWager;
  }

  /**
   * Decide if we should play a match
   */
  shouldPlayMatch(
    wagerAmount: bigint,
    estimatedWinProb: number,
    opponentUnknown: boolean,
    isJoining: boolean = false
  ): { shouldPlay: boolean; reason: string } {
    // Check minimum balance
    if (this.bankrollState.availableBalance < wagerAmount) {
      return { shouldPlay: false, reason: 'Insufficient balance' };
    }

    // Check max risk - be much more lenient when joining existing games (3x buffer for demo)
    const riskPercent = Number(wagerAmount) / Number(this.bankrollState.totalBalance);
    const effectiveMaxRisk = isJoining ? this.maxRiskPercent * 3 : this.maxRiskPercent;
    if (riskPercent > effectiveMaxRisk) {
      return {
        shouldPlay: false,
        reason: `Wager exceeds max risk (${(riskPercent * 100).toFixed(1)}% > ${effectiveMaxRisk * 100}%)`,
      };
    }

    // Check expected value
    const ev = this.calculateExpectedValue(wagerAmount, estimatedWinProb);
    if (ev < 0 && !opponentUnknown) {
      return {
        shouldPlay: false,
        reason: `Negative expected value: ${ev.toFixed(4)}`,
      };
    }

    // Check session stop-loss - but only for creating games, not joining
    // (If stop-loss hit, we should still be able to play smaller games)
    if (this.isStopLossHit() && !isJoining) {
      return { shouldPlay: false, reason: 'Session stop-loss reached' };
    }

    // Against unknown opponents, be more conservative - but much more lenient when joining for demo
    const conservativeThreshold = isJoining ? 5n : 20n;  // Allow up to 20% when joining
    if (opponentUnknown && wagerAmount > this.bankrollState.totalBalance / conservativeThreshold) {
      return {
        shouldPlay: false,
        reason: 'High wager against unknown opponent',
      };
    }

    return { shouldPlay: true, reason: 'Conditions favorable' };
  }

  /**
   * Calculate expected value of a match
   */
  calculateExpectedValue(wagerAmount: bigint, winProbability: number): number {
    const wagerNum = Number(wagerAmount);
    // EV = p(win) * profit - p(lose) * loss
    // In heads-up, profit = wager (we win opponent's wager)
    return winProbability * wagerNum - (1 - winProbability) * wagerNum;
  }

  /**
   * Reserve funds for a match
   */
  reserveForMatch(wagerAmount: bigint): boolean {
    if (this.bankrollState.availableBalance < wagerAmount) {
      return false;
    }

    this.bankrollState.availableBalance -= wagerAmount;
    this.bankrollState.inPlay += wagerAmount;

    logger.info(
      {
        reserved: wagerAmount.toString(),
        inPlay: this.bankrollState.inPlay.toString(),
        available: this.bankrollState.availableBalance.toString(),
      },
      'Reserved funds for match'
    );

    return true;
  }

  /**
   * Record match result
   */
  recordResult(wagerAmount: bigint, won: boolean, pot: bigint): void {
    this.bankrollState.inPlay -= wagerAmount;

    if (won) {
      const profit = pot - wagerAmount;
      this.bankrollState.availableBalance += pot;
      this.bankrollState.sessionProfit += profit;
      this.bankrollState.allTimeProfit += profit;
      this.sessionStats.wins++;

      if (profit > this.sessionStats.biggestWin) {
        this.sessionStats.biggestWin = profit;
      }
    } else {
      const loss = wagerAmount;
      this.bankrollState.sessionProfit -= loss;
      this.bankrollState.allTimeProfit -= loss;
      this.sessionStats.losses++;

      if (loss > this.sessionStats.biggestLoss) {
        this.sessionStats.biggestLoss = loss;
      }
    }

    this.bankrollState.totalBalance = this.bankrollState.availableBalance + this.bankrollState.inPlay;
    this.sessionStats.currentBalance = this.bankrollState.totalBalance;
    this.sessionStats.gamesPlayed++;

    logger.info(
      {
        won,
        pot: pot.toString(),
        sessionProfit: this.bankrollState.sessionProfit.toString(),
        totalBalance: this.bankrollState.totalBalance.toString(),
      },
      'Match result recorded'
    );
  }

  /**
   * Check if session stop-loss is hit
   */
  isStopLossHit(): boolean {
    // Stop-loss at 20% of starting balance
    const stopLossThreshold = this.sessionStats.startBalance / 5n;
    return this.bankrollState.sessionProfit < -BigInt(stopLossThreshold);
  }

  /**
   * Get current bankroll state
   */
  getState(): BankrollState {
    return { ...this.bankrollState };
  }

  /**
   * Get session statistics
   */
  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  /**
   * Get win rate
   */
  getWinRate(): number {
    const total = this.sessionStats.wins + this.sessionStats.losses;
    return total > 0 ? this.sessionStats.wins / total : 0;
  }

  /**
   * Update balance from blockchain
   */
  updateBalance(newBalance: bigint): void {
    this.bankrollState.totalBalance = newBalance + this.bankrollState.inPlay;
    this.bankrollState.availableBalance = newBalance;
    this.sessionStats.currentBalance = this.bankrollState.totalBalance;

    logger.info(
      {
        newBalance: newBalance.toString(),
        total: this.bankrollState.totalBalance.toString(),
      },
      'Balance updated'
    );
  }

  /**
   * Get summary report
   */
  getSummary(): string {
    const winRate = this.getWinRate() * 100;
    const sessionTime = (Date.now() - this.sessionStats.startTime) / 1000 / 60;

    return `
Bankroll Summary
================
Total Balance: ${this.bankrollState.totalBalance.toString()}
Session Profit: ${this.bankrollState.sessionProfit.toString()}
Games Played: ${this.sessionStats.gamesPlayed}
Win Rate: ${winRate.toFixed(1)}%
Biggest Win: ${this.sessionStats.biggestWin.toString()}
Biggest Loss: ${this.sessionStats.biggestLoss.toString()}
Session Duration: ${sessionTime.toFixed(1)} minutes
    `.trim();
  }
}
