import type { ActionType } from './game.js';

export interface Decision {
  action: ActionType;
  amount?: bigint;
  confidence: number; // 0-1
  reasoning: string;
}

export interface ActionContext {
  gameId: string;
  phase: string;
  position: 'button' | 'big_blind';
  potSize: bigint;
  currentBet: bigint;
  myChips: bigint;
  opponentChips: bigint;
  toCall: bigint;
  minRaise: bigint;
  maxRaise: bigint;
}

export interface OpponentStats {
  address: string;
  handsPlayed: number;
  vpip: number;           // Voluntarily Put In Pot %
  pfr: number;            // Pre-Flop Raise %
  af: number;             // Aggression Factor
  wtsd: number;           // Went To Showdown %
  wsd: number;            // Won at Showdown %
  cbet: number;           // Continuation Bet %
  foldToCbet: number;     // Fold to C-Bet %
  threeBet: number;       // 3-Bet %
  foldToThreeBet: number; // Fold to 3-Bet %
}

export type PlayerType =
  | 'unknown'
  | 'tag'   // Tight-Aggressive
  | 'lag'   // Loose-Aggressive
  | 'nit'   // Tight-Passive
  | 'fish'; // Loose-Passive (calling station)

export interface BankrollState {
  totalBalance: bigint;
  availableBalance: bigint;
  inPlay: bigint;
  sessionProfit: bigint;
  allTimeProfit: bigint;
}
