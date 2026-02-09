/**
 * Phase 6: Game Action Processing
 * Handles action submission flow for external agents
 */

import { pino } from 'pino';
import type { ActionRequest, ActionResponse, GameStateResponse } from './types.js';
import { validateApiKey, updateAgentStats } from './auth.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Valid poker actions
 */
const VALID_ACTIONS = ['fold', 'check', 'call', 'raise', 'all_in'] as const;

/**
 * Pending action verifications: txHash -> { apiKey, gameId, action, timestamp }
 */
interface PendingAction {
  apiKey: string;
  gameId: string;
  action: ActionRequest['action'];
  amount?: string;
  timestamp: number;
}

const pendingActions = new Map<string, PendingAction>();

/**
 * Cleanup old pending actions (older than 5 minutes)
 */
const PENDING_ACTION_TIMEOUT = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [txHash, pending] of pendingActions) {
    if (now - pending.timestamp > PENDING_ACTION_TIMEOUT) {
      pendingActions.delete(txHash);
      logger.debug({ txHash }, 'Cleaned up stale pending action');
    }
  }
}, 60 * 1000); // Run every minute

/**
 * Validates an action request
 */
export function validateActionRequest(action: unknown): action is ActionRequest {
  if (!action || typeof action !== 'object') return false;

  const req = action as Record<string, unknown>;

  // Check required fields
  if (typeof req.action !== 'string' || !VALID_ACTIONS.includes(req.action as any)) {
    return false;
  }

  if (typeof req.txHash !== 'string' || !req.txHash.startsWith('0x')) {
    return false;
  }

  // Amount is optional but must be string if present
  if (req.amount !== undefined && typeof req.amount !== 'string') {
    return false;
  }

  return true;
}

/**
 * Process action submission from external agent
 *
 * Flow:
 * 1. Agent decides action locally
 * 2. Agent calls contract directly (takeAction)
 * 3. Agent notifies coordinator with txHash
 * 4. Coordinator verifies on-chain and updates state
 *
 * @param apiKey - The agent's API key
 * @param gameId - The game ID
 * @param action - The action request with txHash
 * @param getGameState - Function to get current game state
 * @param verifyTransaction - Function to verify on-chain transaction
 */
export async function processAction(
  apiKey: string,
  gameId: string,
  action: ActionRequest,
  getGameState: (gameId: string) => GameStateResponse | null,
  verifyTransaction: (txHash: string, expectedAction: string, walletAddress: string) => Promise<boolean>
): Promise<ActionResponse> {
  // Validate API key
  const agent = validateApiKey(apiKey);
  if (!agent) {
    return {
      success: false,
      verified: false,
      error: 'Invalid API key',
    };
  }

  // Get game state
  const gameState = getGameState(gameId);
  if (!gameState) {
    return {
      success: false,
      verified: false,
      error: 'Game not found',
    };
  }

  // Check if agent is in this game
  const isPlayerInGame = gameState.players.some(
    (p) => p.toLowerCase() === agent.walletAddress.toLowerCase()
  );
  if (!isPlayerInGame) {
    return {
      success: false,
      verified: false,
      error: 'You are not a player in this game',
    };
  }

  // Check if it's agent's turn (if currentTurn is available)
  if (gameState.currentTurn && gameState.currentTurn.toLowerCase() !== agent.walletAddress.toLowerCase()) {
    return {
      success: false,
      verified: false,
      error: 'It is not your turn',
    };
  }

  // Check for duplicate transaction submission
  if (pendingActions.has(action.txHash)) {
    return {
      success: false,
      verified: false,
      error: 'Transaction already submitted',
    };
  }

  // Store pending action
  pendingActions.set(action.txHash, {
    apiKey,
    gameId,
    action: action.action,
    amount: action.amount,
    timestamp: Date.now(),
  });

  // Verify on-chain transaction
  let verified = false;
  try {
    verified = await verifyTransaction(action.txHash, action.action, agent.walletAddress);
  } catch (error) {
    logger.error({ error, txHash: action.txHash }, 'Transaction verification failed');
    pendingActions.delete(action.txHash);
    return {
      success: false,
      verified: false,
      error: 'Transaction verification failed',
    };
  }

  if (!verified) {
    pendingActions.delete(action.txHash);
    return {
      success: false,
      verified: false,
      error: 'Transaction not found or invalid',
    };
  }

  // Action verified - update pending action status
  pendingActions.delete(action.txHash);

  logger.info({
    agent: agent.agentName,
    gameId,
    action: action.action,
    amount: action.amount,
    txHash: action.txHash,
  }, 'External agent action verified');

  // Return updated game state
  const updatedState = getGameState(gameId);

  return {
    success: true,
    verified: true,
    gameState: updatedState || undefined,
  };
}

/**
 * Determine valid actions for a player in current game state
 */
export function getValidActions(
  playerStack: bigint,
  currentBet: bigint,
  playerBet: bigint,
  minRaise: bigint
): Array<{ action: string; minAmount?: string; maxAmount?: string }> {
  const actions: Array<{ action: string; minAmount?: string; maxAmount?: string }> = [];
  const toCall = currentBet - playerBet;

  // Can always fold
  actions.push({ action: 'fold' });

  // Check if we can check (no bet to call)
  if (toCall <= 0n) {
    actions.push({ action: 'check' });
  }

  // Call if there's a bet and we have enough
  if (toCall > 0n && playerStack >= toCall) {
    actions.push({ action: 'call' });
  }

  // Raise if we have more than the call amount
  if (playerStack > toCall) {
    const minRaiseAmount = toCall + minRaise;
    const maxRaiseAmount = playerStack;

    if (maxRaiseAmount >= minRaiseAmount) {
      actions.push({
        action: 'raise',
        minAmount: minRaiseAmount.toString(),
        maxAmount: maxRaiseAmount.toString(),
      });
    }
  }

  // All-in if we have chips
  if (playerStack > 0n) {
    actions.push({
      action: 'all_in',
      minAmount: playerStack.toString(),
      maxAmount: playerStack.toString(),
    });
  }

  return actions;
}

/**
 * Record game result for an external agent
 */
export function recordGameResult(apiKey: string, won: boolean): void {
  updateAgentStats(apiKey, won);
}
