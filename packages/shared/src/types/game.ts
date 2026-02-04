import type { HoleCards, CommunityCards } from './cards.js';

export type GamePhase =
  | 'waiting'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'complete';

export type ActionType =
  | 'fold'
  | 'check'
  | 'call'
  | 'raise'
  | 'all_in';

export interface PlayerAction {
  type: ActionType;
  amount?: bigint;
  timestamp: number;
}

export interface Player {
  address: string;
  chips: bigint;
  holeCards?: HoleCards;
  folded: boolean;
  currentBet: bigint;
  isAllIn: boolean;
  hasActed: boolean;
}

export interface GameState {
  gameId: string;
  phase: GamePhase;
  players: [Player, Player]; // Heads-up only
  pot: bigint;
  currentBet: bigint;
  communityCards: CommunityCards;
  dealerIndex: 0 | 1;
  activePlayerIndex: 0 | 1;
  lastAction?: PlayerAction;
  actionHistory: PlayerAction[];
  lastActionTime: number;
  timeoutDuration: number;
}

export interface GameConfig {
  minWager: bigint;
  maxWager: bigint;
  blinds: {
    small: bigint;
    big: bigint;
  };
  timeoutSeconds: number;
}

export interface GameResult {
  gameId: string;
  winner: string;
  loser: string;
  pot: bigint;
  winningHand?: string;
  showdown: boolean;
}

export interface MatchRequest {
  agentAddress: string;
  wagerAmount: bigint;
  cardCommitment: string;
  signature: string;
}

export interface MatchResponse {
  gameId: string;
  opponent: string;
  wagerAmount: bigint;
  status: 'pending' | 'matched' | 'active' | 'complete';
}
