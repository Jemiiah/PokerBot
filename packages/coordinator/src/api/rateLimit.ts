/**
 * Phase 6: Rate Limiting Middleware
 * Provides rate limiting for API endpoints
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { extractApiKey, checkRateLimit, getRateLimitRemaining } from './auth.js';

/**
 * Rate limit error response
 */
export interface RateLimitError {
  error: string;
  code: string;
  retryAfterMs: number;
}

/**
 * Rate limiting middleware for Fastify
 * Checks rate limit and sets appropriate headers
 *
 * @returns true if request should continue, false if rate limited
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const authHeader = request.headers.authorization;
  const apiKey = extractApiKey(authHeader);

  // No API key = no rate limiting (endpoint may have its own auth)
  if (!apiKey) {
    return true;
  }

  // Check rate limit
  const allowed = checkRateLimit(apiKey);
  const { remaining, resetMs } = getRateLimitRemaining(apiKey);

  // Set rate limit headers
  reply.header('X-RateLimit-Limit', '100');
  reply.header('X-RateLimit-Remaining', String(remaining));
  reply.header('X-RateLimit-Reset', String(Math.ceil(resetMs / 1000)));

  if (!allowed) {
    reply.status(429).send({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterMs: resetMs,
    } as RateLimitError);
    return false;
  }

  return true;
}

/**
 * Creates a rate limit hook for Fastify
 * Apply to specific routes that need rate limiting
 */
export function createRateLimitHook() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const allowed = await rateLimitMiddleware(request, reply);
    if (!allowed) {
      // Reply already sent by middleware
      return;
    }
  };
}
