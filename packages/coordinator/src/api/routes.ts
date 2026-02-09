/**
 * Phase 6: REST API Route Handlers
 * Handles all REST endpoints for the Public Agent API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pino } from 'pino';
import {
  registerExternalAgent,
  validateApiKey,
  extractApiKey,
  getAllExternalAgents,
  checkRateLimit,
  getRateLimitRemaining,
} from './auth.js';
import { processAction, validateActionRequest } from './actions.js';
import type {
  RegisterAgentRequest,
  RegisterAgentResponse,
  AgentInfoResponse,
  QueueJoinRequest,
  QueueJoinResponse,
  QueueLeaveResponse,
  ActiveGamesResponse,
  GameStateResponse,
  ActionRequest,
  ActionResponse,
  LeaderboardResponse,
  ApiError,
} from './types.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Context provided by coordinator for route handlers
 */
export interface RouteContext {
  // Match storage
  getMatch: (gameId: string) => {
    gameId: string;
    players: string[];
    playerNames: string[];
    wagerAmount: bigint;
    status: 'pending' | 'active' | 'complete';
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
  } | undefined;
  getAllMatches: () => Array<{
    gameId: string;
    players: string[];
    playerNames: string[];
    wagerAmount: bigint;
    status: 'pending' | 'active' | 'complete';
    createdAt: number;
    startedAt?: number;
  }>;

  // Matchmaking queue
  getQueueSize: () => number;
  getQueuePosition: (walletAddress: string) => number;
  addExternalToQueue: (walletAddress: string, agentName: string, maxWager: bigint) => boolean;
  removeFromQueue: (walletAddress: string) => boolean;

  // Transaction verification
  verifyTransaction: (txHash: string, expectedAction: string, walletAddress: string) => Promise<boolean>;

  // Broadcast to frontends
  broadcastToFrontends: (gameId: string, data: unknown) => void;
  broadcastToAllFrontends: (data: unknown) => void;
}

/**
 * Authentication hook - validates API key and adds agent to request
 */
function createAuthHook(requireAuth: boolean) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      if (requireAuth) {
        reply.status(401).send({
          error: 'Missing or invalid Authorization header',
          code: 'AUTH_REQUIRED',
        } as ApiError);
        return;
      }
      return;
    }

    // Check rate limit
    if (!checkRateLimit(apiKey)) {
      const { resetMs } = getRateLimitRemaining(apiKey);
      reply.status(429).send({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        details: { retryAfterMs: resetMs },
      } as ApiError);
      return;
    }

    // Validate API key
    const agent = validateApiKey(apiKey);
    if (!agent) {
      if (requireAuth) {
        reply.status(401).send({
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
        } as ApiError);
        return;
      }
      return;
    }

    // Add agent to request for route handlers
    (request as any).agent = agent;
    (request as any).apiKey = apiKey;

    // Set rate limit headers
    const { remaining, resetMs } = getRateLimitRemaining(apiKey);
    reply.header('X-RateLimit-Limit', '100');
    reply.header('X-RateLimit-Remaining', String(remaining));
    reply.header('X-RateLimit-Reset', String(Math.ceil(resetMs / 1000)));
  };
}

/**
 * Registers all API routes on the Fastify instance
 */
export function registerApiRoutes(fastify: FastifyInstance, context: RouteContext): void {
  // ============================================================
  // POST /api/agents/register - Register new external agent
  // ============================================================
  fastify.post<{ Body: RegisterAgentRequest }>(
    '/api/agents/register',
    async (request, reply): Promise<RegisterAgentResponse | ApiError> => {
      const { walletAddress, agentName, webhookUrl } = request.body || {};

      // Validate required fields
      if (!walletAddress || typeof walletAddress !== 'string') {
        reply.status(400);
        return { error: 'walletAddress is required', code: 'INVALID_REQUEST' };
      }

      if (!agentName || typeof agentName !== 'string') {
        reply.status(400);
        return { error: 'agentName is required', code: 'INVALID_REQUEST' };
      }

      // Validate wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        reply.status(400);
        return { error: 'Invalid wallet address format', code: 'INVALID_WALLET' };
      }

      // Validate agent name length
      if (agentName.length < 2 || agentName.length > 32) {
        reply.status(400);
        return { error: 'Agent name must be 2-32 characters', code: 'INVALID_NAME' };
      }

      // Register agent
      const agent = registerExternalAgent(walletAddress, agentName, webhookUrl);

      if (!agent) {
        reply.status(409);
        return { error: 'Wallet address already registered', code: 'ALREADY_REGISTERED' };
      }

      logger.info({ agentName, walletAddress }, 'External agent registered via API');

      reply.status(201);
      return {
        apiKey: agent.apiKey,
        agentName: agent.agentName,
        walletAddress: agent.walletAddress,
      };
    }
  );

  // ============================================================
  // GET /api/agents/me - Get own agent info
  // ============================================================
  fastify.get(
    '/api/agents/me',
    { preHandler: createAuthHook(true) },
    async (request, _reply): Promise<AgentInfoResponse | ApiError> => {
      const agent = (request as any).agent;

      return {
        walletAddress: agent.walletAddress,
        agentName: agent.agentName,
        webhookUrl: agent.webhookUrl,
        createdAt: agent.createdAt,
        lastSeen: agent.lastSeen,
        gamesPlayed: agent.gamesPlayed,
        gamesWon: agent.gamesWon,
      };
    }
  );

  // ============================================================
  // POST /api/queue/join - Join matchmaking queue
  // ============================================================
  fastify.post<{ Body: QueueJoinRequest }>(
    '/api/queue/join',
    { preHandler: createAuthHook(true) },
    async (request, reply): Promise<QueueJoinResponse | ApiError> => {
      const agent = (request as any).agent;
      const { maxWager } = request.body || {};

      // Validate maxWager
      if (!maxWager || typeof maxWager !== 'string') {
        reply.status(400);
        return { error: 'maxWager is required', code: 'INVALID_REQUEST' };
      }

      let maxWagerBigInt: bigint;
      try {
        maxWagerBigInt = BigInt(maxWager);
      } catch {
        reply.status(400);
        return { error: 'Invalid maxWager format', code: 'INVALID_WAGER' };
      }

      if (maxWagerBigInt <= 0n) {
        reply.status(400);
        return { error: 'maxWager must be positive', code: 'INVALID_WAGER' };
      }

      // Add to queue
      const success = context.addExternalToQueue(agent.walletAddress, agent.agentName, maxWagerBigInt);

      if (!success) {
        reply.status(400);
        return { error: 'Already in queue or in a game', code: 'ALREADY_QUEUED' };
      }

      const position = context.getQueuePosition(agent.walletAddress);
      const queueSize = context.getQueueSize();

      logger.info({
        agent: agent.agentName,
        position,
        queueSize,
      }, 'External agent joined queue');

      return {
        position,
        queueSize,
        estimatedWait: estimateWaitTime(position),
      };
    }
  );

  // ============================================================
  // POST /api/queue/leave - Leave matchmaking queue
  // ============================================================
  fastify.post(
    '/api/queue/leave',
    { preHandler: createAuthHook(true) },
    async (request, reply): Promise<QueueLeaveResponse | ApiError> => {
      const agent = (request as any).agent;

      const success = context.removeFromQueue(agent.walletAddress);

      if (!success) {
        reply.status(400);
        return { error: 'Not in queue', code: 'NOT_IN_QUEUE' };
      }

      logger.info({ agent: agent.agentName }, 'External agent left queue');

      return {
        success: true,
        message: 'Removed from matchmaking queue',
      };
    }
  );

  // ============================================================
  // GET /api/games/active - List active games
  // ============================================================
  fastify.get(
    '/api/games/active',
    { preHandler: createAuthHook(true) },
    async (): Promise<ActiveGamesResponse> => {
      const matches = context.getAllMatches();
      const activeGames = matches
        .filter((m) => m.status === 'active' || m.status === 'pending')
        .map((m) => ({
          gameId: m.gameId,
          players: m.players,
          playerNames: m.playerNames,
          wagerAmount: m.wagerAmount.toString(),
          status: m.status,
          createdAt: m.createdAt,
          startedAt: m.startedAt,
        }));

      return { games: activeGames };
    }
  );

  // ============================================================
  // GET /api/games/:id - Get specific game state
  // ============================================================
  fastify.get<{ Params: { id: string } }>(
    '/api/games/:id',
    { preHandler: createAuthHook(true) },
    async (request, reply): Promise<GameStateResponse | ApiError> => {
      const { id } = request.params;
      const match = context.getMatch(id);

      if (!match) {
        reply.status(404);
        return { error: 'Game not found', code: 'GAME_NOT_FOUND' };
      }

      return {
        gameId: match.gameId,
        players: match.players,
        playerNames: match.playerNames,
        wagerAmount: match.wagerAmount.toString(),
        status: match.status,
        createdAt: match.createdAt,
        startedAt: match.startedAt,
        completedAt: match.completedAt,
      };
    }
  );

  // ============================================================
  // POST /api/games/:id/action - Notify action taken
  // ============================================================
  fastify.post<{ Params: { id: string }; Body: ActionRequest }>(
    '/api/games/:id/action',
    { preHandler: createAuthHook(true) },
    async (request, reply): Promise<ActionResponse | ApiError> => {
      const { id: gameId } = request.params;
      const apiKey = (request as any).apiKey;
      const actionData = request.body;

      // Validate action request
      if (!validateActionRequest(actionData)) {
        reply.status(400);
        return {
          error: 'Invalid action request',
          code: 'INVALID_ACTION',
          details: 'Required: action (fold|check|call|raise|all_in), txHash',
        };
      }

      // Process action
      const result = await processAction(
        apiKey,
        gameId,
        actionData,
        (gid) => {
          const match = context.getMatch(gid);
          if (!match) return null;
          return {
            gameId: match.gameId,
            players: match.players,
            playerNames: match.playerNames,
            wagerAmount: match.wagerAmount.toString(),
            status: match.status,
            createdAt: match.createdAt,
            startedAt: match.startedAt,
            completedAt: match.completedAt,
          };
        },
        context.verifyTransaction
      );

      if (!result.success) {
        reply.status(400);
      }

      return result;
    }
  );

  // ============================================================
  // GET /api/leaderboard - Get rankings (public)
  // ============================================================
  fastify.get('/api/leaderboard', async (): Promise<LeaderboardResponse> => {
    const agents = getAllExternalAgents();

    // Sort by win rate, then by games played
    const sorted = [...agents]
      .filter((a) => a.gamesPlayed > 0)
      .sort((a, b) => {
        const aWinRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
        const bWinRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
        if (bWinRate !== aWinRate) return bWinRate - aWinRate;
        return b.gamesPlayed - a.gamesPlayed;
      });

    const leaderboard = sorted.map((agent, index) => ({
      rank: index + 1,
      walletAddress: agent.walletAddress,
      agentName: agent.agentName,
      gamesPlayed: agent.gamesPlayed,
      gamesWon: agent.gamesWon,
      winRate: agent.gamesPlayed > 0 ? agent.gamesWon / agent.gamesPlayed : 0,
      totalWinnings: '0', // TODO: Track actual winnings
    }));

    return {
      leaderboard,
      lastUpdated: Date.now(),
    };
  });
}

/**
 * Estimate wait time based on queue position
 */
function estimateWaitTime(position: number): string {
  if (position <= 2) return '~10 seconds';
  if (position <= 4) return '~30 seconds';
  if (position <= 8) return '~1 minute';
  return '~2 minutes';
}
