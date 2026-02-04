import type { OpponentStats, PlayerType, ActionType } from '@poker/shared';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('OpponentModel');

interface ActionRecord {
  phase: string;
  action: ActionType;
  amount?: bigint;
  potSize: bigint;
  facingBet: boolean;
  timestamp: number;
}

interface ShowdownRecord {
  holeCards: [number, number];
  communityCards: number[];
  result: 'win' | 'loss' | 'tie';
  actionsThisHand: ActionRecord[];
}

/**
 * Tracks and analyzes opponent behavior
 */
export class OpponentModel {
  private statsMap: Map<string, OpponentStats> = new Map();
  private actionHistory: Map<string, ActionRecord[]> = new Map();
  private showdownHistory: Map<string, ShowdownRecord[]> = new Map();

  /**
   * Get or create stats for an opponent
   */
  getStats(address: string): OpponentStats {
    let stats = this.statsMap.get(address);
    if (!stats) {
      stats = this.createDefaultStats(address);
      this.statsMap.set(address, stats);
    }
    return stats;
  }

  /**
   * Record an action taken by an opponent
   */
  recordAction(
    address: string,
    action: ActionType,
    phase: string,
    amount: bigint | undefined,
    potSize: bigint,
    facingBet: boolean
  ): void {
    const record: ActionRecord = {
      phase,
      action,
      amount,
      potSize,
      facingBet,
      timestamp: Date.now(),
    };

    const history = this.actionHistory.get(address) || [];
    history.push(record);
    this.actionHistory.set(address, history);

    // Update stats
    this.updateStats(address, record);

    logger.debug(
      { address: address.slice(0, 10), action, phase },
      'Recorded opponent action'
    );
  }

  /**
   * Record a showdown result
   */
  recordShowdown(
    address: string,
    holeCards: [number, number],
    communityCards: number[],
    result: 'win' | 'loss' | 'tie',
    actionsThisHand: ActionRecord[]
  ): void {
    const record: ShowdownRecord = {
      holeCards,
      communityCards,
      result,
      actionsThisHand,
    };

    const history = this.showdownHistory.get(address) || [];
    history.push(record);
    this.showdownHistory.set(address, history);

    // Update showdown-related stats
    const stats = this.getStats(address);
    stats.wtsd = this.calculateWTSD(address);
    stats.wsd = this.calculateWSD(address);

    logger.info(
      { address: address.slice(0, 10), result, holeCards },
      'Recorded showdown'
    );
  }

  /**
   * Classify opponent's playing style
   */
  classifyPlayer(address: string): PlayerType {
    const stats = this.getStats(address);

    // Need minimum sample size
    if (stats.handsPlayed < 10) {
      return 'unknown';
    }

    const isLoose = stats.vpip > 0.30;
    const isAggressive = stats.af > 2.0;

    if (isLoose && isAggressive) return 'lag';  // Loose-Aggressive
    if (isLoose && !isAggressive) return 'fish'; // Loose-Passive (calling station)
    if (!isLoose && isAggressive) return 'tag';  // Tight-Aggressive
    return 'nit'; // Tight-Passive

  }

  /**
   * Get recommended adjustment against opponent
   */
  getStrategyAdjustment(address: string): {
    bluffMore: boolean;
    valueWider: boolean;
    foldMore: boolean;
    callMoreBluffs: boolean;
    description: string;
  } {
    const playerType = this.classifyPlayer(address);

    switch (playerType) {
      case 'fish':
        // Against calling stations: value bet thin, don't bluff
        return {
          bluffMore: false,
          valueWider: true,
          foldMore: false,
          callMoreBluffs: false,
          description: 'Calling station - value bet wide, avoid bluffs',
        };

      case 'nit':
        // Against tight-passive: bluff more, respect their raises
        return {
          bluffMore: true,
          valueWider: false,
          foldMore: true,
          callMoreBluffs: false,
          description: 'Nit - bluff often, fold to aggression',
        };

      case 'lag':
        // Against LAGs: call down lighter, don't bluff
        return {
          bluffMore: false,
          valueWider: true,
          foldMore: false,
          callMoreBluffs: true,
          description: 'LAG - call lighter, dont bluff',
        };

      case 'tag':
        // Against TAGs: play tight, respect raises
        return {
          bluffMore: false,
          valueWider: false,
          foldMore: true,
          callMoreBluffs: false,
          description: 'TAG - play tight, respect their action',
        };

      default:
        return {
          bluffMore: false,
          valueWider: false,
          foldMore: false,
          callMoreBluffs: false,
          description: 'Unknown opponent - play standard',
        };
    }
  }

  /**
   * Estimate opponent's hand range based on actions
   */
  estimateRange(address: string, actionsThisHand: ActionRecord[]): string {
    const playerType = this.classifyPlayer(address);

    // Simplified range estimation
    const hasRaisedPreflop = actionsThisHand.some(
      a => a.phase === 'preflop' && a.action === 'raise'
    );
    const hasReRaised = actionsThisHand.filter(
      a => a.action === 'raise'
    ).length > 1;

    if (hasReRaised) {
      return 'premium'; // AA, KK, QQ, AK
    }
    if (hasRaisedPreflop) {
      if (playerType === 'nit') return 'tight'; // Top 10%
      if (playerType === 'lag') return 'wide'; // Top 40%
      return 'standard'; // Top 20%
    }
    return 'any';
  }

  /**
   * Get all tracked opponents
   */
  getTrackedOpponents(): string[] {
    return Array.from(this.statsMap.keys());
  }

  // Private helper methods

  private createDefaultStats(address: string): OpponentStats {
    return {
      address,
      handsPlayed: 0,
      vpip: 0,
      pfr: 0,
      af: 1.0,
      wtsd: 0,
      wsd: 0,
      cbet: 0,
      foldToCbet: 0,
      threeBet: 0,
      foldToThreeBet: 0,
    };
  }

  private updateStats(address: string, record: ActionRecord): void {
    const stats = this.getStats(address);

    // Count hands (rough approximation - new hand when preflop action)
    if (record.phase === 'preflop') {
      stats.handsPlayed++;
    }

    // VPIP - Voluntarily Put In Pot
    if (record.phase === 'preflop' && ['call', 'raise', 'all_in'].includes(record.action)) {
      // Running average update
      stats.vpip = this.runningAverage(stats.vpip, 1, stats.handsPlayed);
    } else if (record.phase === 'preflop') {
      stats.vpip = this.runningAverage(stats.vpip, 0, stats.handsPlayed);
    }

    // PFR - Preflop Raise
    if (record.phase === 'preflop' && ['raise', 'all_in'].includes(record.action)) {
      stats.pfr = this.runningAverage(stats.pfr, 1, stats.handsPlayed);
    } else if (record.phase === 'preflop') {
      stats.pfr = this.runningAverage(stats.pfr, 0, stats.handsPlayed);
    }

    // Aggression Factor
    this.updateAggressionFactor(stats, record);

    // C-bet (continuation bet)
    if (record.phase === 'flop' && record.action === 'raise') {
      stats.cbet = this.runningAverage(stats.cbet, 1, stats.handsPlayed);
    }

    // Fold to c-bet
    if (record.phase === 'flop' && record.facingBet && record.action === 'fold') {
      stats.foldToCbet = this.runningAverage(stats.foldToCbet, 1, stats.handsPlayed);
    }
  }

  private updateAggressionFactor(stats: OpponentStats, _record: ActionRecord): void {
    // AF = (bets + raises) / calls
    const history = this.actionHistory.get(stats.address) || [];

    const betsRaises = history.filter(a =>
      ['raise', 'all_in'].includes(a.action)
    ).length;

    const calls = history.filter(a => a.action === 'call').length;

    stats.af = calls > 0 ? betsRaises / calls : betsRaises || 1;
  }

  private calculateWTSD(address: string): number {
    const showdowns = this.showdownHistory.get(address) || [];
    const handsPlayed = this.getStats(address).handsPlayed;
    return handsPlayed > 0 ? showdowns.length / handsPlayed : 0;
  }

  private calculateWSD(address: string): number {
    const showdowns = this.showdownHistory.get(address) || [];
    const wins = showdowns.filter(s => s.result === 'win').length;
    return showdowns.length > 0 ? wins / showdowns.length : 0;
  }

  private runningAverage(current: number, newValue: number, n: number): number {
    if (n <= 1) return newValue;
    return current + (newValue - current) / n;
  }
}
