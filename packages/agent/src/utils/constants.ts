// Re-export from shared
export * from '@poker/shared/constants';

// Agent-specific constants
export const POLLING_INTERVAL_MS = 1000;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 2000;

// Strategy thresholds
export const MIN_PLAYABLE_EQUITY = 0.35;
export const STRONG_HAND_EQUITY = 0.65;
export const PREMIUM_HAND_EQUITY = 0.80;

// Bet sizing
export const POT_BET_RATIO = 0.75;
export const VALUE_BET_RATIO = 0.66;
export const BLUFF_FREQUENCY = 0.33;
