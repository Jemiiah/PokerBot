import type { Rank, Suit } from '../types/cards.js';

export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

export const DECK_SIZE = 52;
export const HOLE_CARD_COUNT = 2;
export const COMMUNITY_CARD_COUNT = 5;
export const FLOP_CARD_COUNT = 3;

// Game phase enum values (match contract)
export const PHASE = {
  WAITING: 0,
  PREFLOP: 1,
  FLOP: 2,
  TURN: 3,
  RIVER: 4,
  SHOWDOWN: 5,
  COMPLETE: 6,
} as const;

// Action enum values (match contract)
export const ACTION = {
  FOLD: 0,
  CHECK: 1,
  CALL: 2,
  RAISE: 3,
  ALL_IN: 4,
} as const;

// Standard preflop hand categories
export const PREMIUM_HANDS = ['AA', 'KK', 'QQ', 'AKs', 'AKo'] as const;
export const STRONG_HANDS = ['JJ', 'TT', 'AQs', 'AQo', 'AJs', 'KQs'] as const;
export const PLAYABLE_HANDS = ['99', '88', '77', 'ATs', 'KJs', 'QJs', 'JTs', 'AJo', 'KQo'] as const;

// Default game configuration
export const DEFAULT_BLINDS = {
  small: 1n,
  big: 2n,
} as const;

export const DEFAULT_TIMEOUT_SECONDS = 60;
export const MIN_WAGER = 10n; // 10 units
export const MAX_WAGER = 1000n; // 1000 units
