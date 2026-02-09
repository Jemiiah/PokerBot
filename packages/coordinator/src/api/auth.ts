/**
 * Phase 6: API Authentication Module
 * Handles API key generation, validation, and external agent management
 */

import { randomUUID } from 'crypto';
import type { ExternalAgent, RateLimitInfo } from './types.js';
import { pino } from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * In-memory storage for external agents (keyed by API key)
 * Can be upgraded to Redis/DB later
 */
const externalAgents = new Map<string, ExternalAgent>();

/**
 * Lookup map: wallet address -> API key (for finding agent by wallet)
 */
const walletToApiKey = new Map<string, string>();

/**
 * Rate limiting storage: API key -> rate limit info
 */
const rateLimits = new Map<string, RateLimitInfo>();

/**
 * Rate limit configuration
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

/**
 * Generates a new UUID v4 API key
 */
export function generateApiKey(): string {
  return randomUUID();
}

/**
 * Registers a new external agent
 * @returns The created agent with API key, or null if wallet already registered
 */
export function registerExternalAgent(
  walletAddress: string,
  agentName: string,
  webhookUrl?: string
): ExternalAgent | null {
  // Normalize wallet address
  const normalizedWallet = walletAddress.toLowerCase();

  // Check if wallet already registered
  if (walletToApiKey.has(normalizedWallet)) {
    logger.warn({ walletAddress: normalizedWallet }, 'Wallet already registered');
    return null;
  }

  const apiKey = generateApiKey();
  const now = Date.now();

  const agent: ExternalAgent = {
    apiKey,
    walletAddress: normalizedWallet,
    agentName,
    webhookUrl,
    createdAt: now,
    lastSeen: now,
    gamesPlayed: 0,
    gamesWon: 0,
  };

  externalAgents.set(apiKey, agent);
  walletToApiKey.set(normalizedWallet, apiKey);

  logger.info({
    agentName,
    walletAddress: normalizedWallet,
  }, 'External agent registered');

  return agent;
}

/**
 * Validates an API key and returns the associated agent
 * @returns The agent if valid, null if invalid
 */
export function validateApiKey(apiKey: string): ExternalAgent | null {
  const agent = externalAgents.get(apiKey);
  if (agent) {
    agent.lastSeen = Date.now();
  }
  return agent || null;
}

/**
 * Gets an external agent by wallet address
 */
export function getAgentByWallet(walletAddress: string): ExternalAgent | null {
  const normalizedWallet = walletAddress.toLowerCase();
  const apiKey = walletToApiKey.get(normalizedWallet);
  if (!apiKey) return null;
  return externalAgents.get(apiKey) || null;
}

/**
 * Updates agent statistics after a game
 */
export function updateAgentStats(apiKey: string, won: boolean): void {
  const agent = externalAgents.get(apiKey);
  if (agent) {
    agent.gamesPlayed++;
    if (won) {
      agent.gamesWon++;
    }
    logger.info({
      agentName: agent.agentName,
      gamesPlayed: agent.gamesPlayed,
      gamesWon: agent.gamesWon,
    }, 'Agent stats updated');
  }
}

/**
 * Checks rate limit for an API key
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  let info = rateLimits.get(apiKey);

  if (!info) {
    // First request from this key
    info = { requests: 1, windowStart: now };
    rateLimits.set(apiKey, info);
    return true;
  }

  // Check if we're in a new window
  if (now - info.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Reset window
    info.requests = 1;
    info.windowStart = now;
    return true;
  }

  // Same window - check limit
  if (info.requests >= RATE_LIMIT_MAX_REQUESTS) {
    logger.warn({ apiKey: apiKey.substring(0, 8) + '...' }, 'Rate limit exceeded');
    return false;
  }

  info.requests++;
  return true;
}

/**
 * Gets remaining requests for rate limit window
 */
export function getRateLimitRemaining(apiKey: string): { remaining: number; resetMs: number } {
  const now = Date.now();
  const info = rateLimits.get(apiKey);

  if (!info) {
    return { remaining: RATE_LIMIT_MAX_REQUESTS, resetMs: RATE_LIMIT_WINDOW_MS };
  }

  const windowAge = now - info.windowStart;
  if (windowAge >= RATE_LIMIT_WINDOW_MS) {
    return { remaining: RATE_LIMIT_MAX_REQUESTS, resetMs: RATE_LIMIT_WINDOW_MS };
  }

  return {
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - info.requests),
    resetMs: RATE_LIMIT_WINDOW_MS - windowAge,
  };
}

/**
 * Revokes an API key (admin function)
 * @returns true if key was revoked, false if not found
 */
export function revokeApiKey(apiKey: string): boolean {
  const agent = externalAgents.get(apiKey);
  if (!agent) return false;

  walletToApiKey.delete(agent.walletAddress);
  externalAgents.delete(apiKey);
  rateLimits.delete(apiKey);

  logger.info({ agentName: agent.agentName }, 'API key revoked');
  return true;
}

/**
 * Gets all registered external agents (for admin/leaderboard)
 */
export function getAllExternalAgents(): ExternalAgent[] {
  return Array.from(externalAgents.values());
}

/**
 * Checks if a wallet address is registered as external agent
 */
export function isExternalAgent(walletAddress: string): boolean {
  return walletToApiKey.has(walletAddress.toLowerCase());
}

/**
 * Extracts API key from Authorization header
 * Expects format: "Bearer <apiKey>"
 */
export function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
