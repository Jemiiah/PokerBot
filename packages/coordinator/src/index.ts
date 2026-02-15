import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { pino } from 'pino';
import { registerApiRoutes, type RouteContext } from './api/routes.js';
import { validateApiKey, updateAgentStats } from './api/auth.js';
import type { ConnectedExternalAgent } from './api/types.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// Agent name registry - maps addresses to agent names
const agentNameRegistry = new Map<string, string>();

interface Match {
  gameId: string;
  players: string[]; // Up to 4 player addresses
  playerNames: string[]; // Up to 4 player names (Blaze, Frost, etc.)
  wagerAmount: bigint;
  status: 'pending' | 'active' | 'complete';
  minPlayers: number;
  maxPlayers: number;
  createdAt: number;
  startedAt?: number; // When game became active
  completedAt?: number; // When game ended
}

interface ConnectedAgent {
  address: string;
  name: string; // Agent personality name
  socket: any;
  lastPing: number;
  balance: bigint; // Agent's wallet balance
  ready: boolean; // Ready to be matched
  inGame: boolean; // Currently in a game
  currentGameId: string | null; // Track which game agent is in
}

interface ConnectedFrontend {
  socket: any;
  subscribedGames: Set<string>;
  connectedAt: number;
}

// Matchmaking queue - agents ready to play
interface QueuedAgent {
  address: string;
  name: string;
  socket: any;
  balance: bigint;
  maxWager: bigint;
  queuedAt: number;
}

const matches = new Map<string, Match>();
const completedGameIds = new Set<string>();
const connectedAgents = new Map<string, ConnectedAgent>();
const connectedFrontends = new Map<string, ConnectedFrontend>();
const matchmakingQueue: QueuedAgent[] = [];

// Phase 6: External agents connected via WebSocket API
const connectedExternalAgents = new Map<string, ConnectedExternalAgent>();

// Matchmaking configuration
// const MATCHMAKING_INTERVAL = 3000; // Check queue every 3 seconds
const MIN_PLAYERS_FOR_MATCH = 2; // Minimum players to start a match
const MAX_PLAYERS_FOR_MATCH = 4; // Support up to 4 players per game
const OPTIMAL_BATCH_WAIT_MS = 10000; // Wait up to 10s for more players to join
const FIXED_ENTRY_FEE = BigInt('10000000000000000'); // 0.01 MON - fixed entry fee for all games
const STALE_GAME_TIMEOUT = 10 * 60 * 1000; // 10 minutes - games older than this are cleaned up
const CLEANUP_INTERVAL = 60 * 1000; // Run cleanup every minute

// STRICT: Only ONE game at a time
let currentActiveGameId: string | null = null;
let gameCreationPending = false; // Prevents multiple game creations during the creation window
let matchmakingWaitStart: number | null = null; // Track when we started waiting for more players

// Generate unique ID for frontends
let frontendIdCounter = 0;
function generateFrontendId(): string {
  return `frontend-${Date.now()}-${++frontendIdCounter}`;
}

// Broadcast functions (defined at top level so matchmaking can use them)
function broadcast(data: any) {
  const message = JSON.stringify(data);
  for (const agent of connectedAgents.values()) {
    try {
      agent.socket.send(message);
    } catch (error) {
      logger.error({ address: agent.address, error }, 'Failed to send to agent');
    }
  }
}

function broadcastToFrontends(gameId: string, data: any) {
  const message = JSON.stringify(data);
  for (const [id, frontend] of connectedFrontends) {
    if (frontend.subscribedGames.has(gameId)) {
      try {
        frontend.socket.send(message);
      } catch (error) {
        logger.error({ frontendId: id, error }, 'Failed to send to frontend');
      }
    }
  }
}

function broadcastToAllFrontends(data: any) {
  const message = JSON.stringify(data);
  for (const [id, frontend] of connectedFrontends) {
    try {
      frontend.socket.send(message);
    } catch (error) {
      logger.error({ frontendId: id, error }, 'Failed to send to frontend');
    }
  }
}

// Phase 6: Send to specific external agent by wallet
function sendToExternalAgent(walletAddress: string, data: any) {
  const normalizedWallet = walletAddress.toLowerCase();
  for (const [_apiKey, agent] of connectedExternalAgents) {
    if (agent.walletAddress.toLowerCase() === normalizedWallet) {
      try {
        (agent.socket as any).send(JSON.stringify(data));
        return true;
      } catch (error) {
        logger.error({ agentName: agent.agentName, error }, 'Failed to send to external agent');
        return false;
      }
    }
  }
  return false;
}

// // Matchmaking logic
// function startMatchmaking() {
//   setInterval(() => {
//     tryCreateMatch();
//   }, MATCHMAKING_INTERVAL);
//   logger.info({ interval: MATCHMAKING_INTERVAL }, 'Matchmaking system started');
// }

// Matchmaking logic - DISABLED for manual control
function startMatchmaking() {
  logger.info('Manual matchmaking mode - periodic matching disabled');
}

function tryCreateMatch(forceStart: boolean = false) {
  // Require at least one frontend/spectator connected before creating matches
  // This ensures spectators don't miss any game events
  if (connectedFrontends.size === 0) {
    if (matchmakingQueue.length >= MIN_PLAYERS_FOR_MATCH) {
      logger.info(
        { queueSize: matchmakingQueue.length },
        "Waiting for frontend to connect before starting match",
      );
    }
    return;
  }

  // STRICT: Only ONE game at a time - wait for current game to finish
  // Also block if game creation is in progress (waiting for on-chain confirmation)
  if (gameCreationPending) {
    logger.debug("Game creation pending, waiting for confirmation");
    return;
  }

  if (currentActiveGameId) {
    const activeMatch = matches.get(currentActiveGameId);
    if (activeMatch && activeMatch.status !== "complete") {
      logger.debug(
        { currentGame: currentActiveGameId, status: activeMatch?.status },
        "Game in progress, waiting for completion",
      );
      return;
    }
    // Clear the active game if it's complete
    currentActiveGameId = null;
  }

  // Need at least MIN_PLAYERS_FOR_MATCH agents in queue
  if (matchmakingQueue.length < MIN_PLAYERS_FOR_MATCH) {
    matchmakingWaitStart = null; // Reset wait timer
    return;
  }

  // Get agents that can afford the fixed entry fee (sorted by queue time)
  const allEligibleAgents = matchmakingQueue.filter((a) => a.balance >= FIXED_ENTRY_FEE);

  if (allEligibleAgents.length < MIN_PLAYERS_FOR_MATCH) {
    logger.debug(
      {
        queueSize: matchmakingQueue.length,
        eligible: allEligibleAgents.length,
        requiredFee: FIXED_ENTRY_FEE.toString(),
      },
      "Not enough eligible agents for match",
    );
    matchmakingWaitStart = null;
    return;
  }

  // Smart batching: wait briefly for more players if we have 2-3
  const now = Date.now();
  if (allEligibleAgents.length < MAX_PLAYERS_FOR_MATCH && !forceStart) {
    if (matchmakingWaitStart === null) {
      matchmakingWaitStart = now;
      logger.info(
        {
          eligible: allEligibleAgents.length,
          maxPlayers: MAX_PLAYERS_FOR_MATCH,
          waitMs: OPTIMAL_BATCH_WAIT_MS,
        },
        "Waiting for more players to join",
      );
      return;
    }

    const waitedMs = now - matchmakingWaitStart;
    if (waitedMs < OPTIMAL_BATCH_WAIT_MS) {
      logger.debug(
        {
          eligible: allEligibleAgents.length,
          waitedMs,
          remainingMs: OPTIMAL_BATCH_WAIT_MS - waitedMs,
        },
        "Still waiting for more players",
      );
      return;
    }

    // Waited long enough, proceed with current players
    logger.info(
      {
        eligible: allEligibleAgents.length,
        waitedMs,
      },
      "Wait time exceeded, starting match with current players",
    );
  }

  // Reset wait timer since we're starting a match
  matchmakingWaitStart = null;

  // Take up to MAX_PLAYERS_FOR_MATCH
  const eligibleAgents = allEligibleAgents.slice(0, MAX_PLAYERS_FOR_MATCH);

  // Use fixed entry fee for all games
  const wagerAmount = FIXED_ENTRY_FEE;

  // Generate a temporary match ID for tracking (will be replaced with actual gameId)
  const tempMatchId = `pending-${Date.now()}`;

  // Remove matched agents from queue
  for (const agent of eligibleAgents) {
    const idx = matchmakingQueue.findIndex((a) => a.address === agent.address);
    if (idx !== -1) {
      matchmakingQueue.splice(idx, 1);
    }
    // Mark agent as in game IMMEDIATELY
    const connectedAgent = connectedAgents.get(agent.address);
    if (connectedAgent) {
      connectedAgent.inGame = true;
      connectedAgent.ready = false;
      connectedAgent.currentGameId = tempMatchId; // Temporary ID until real game created
    }
  }

  // Sort by balance descending - richest agent creates the game (pays gas)
  const sortedAgents = [...eligibleAgents].sort((a, b) =>
    a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0,
  );
  const creator = sortedAgents[0];
  const joiners = sortedAgents.slice(1);

  logger.info(
    {
      creator: creator.name,
      joiners: joiners.map((j) => j.name),
      wagerAmount: wagerAmount.toString(),
      playerCount: eligibleAgents.length,
    },
    "Creating match via coordinator",
  );

  // Notify frontends about upcoming match
  broadcastToAllFrontends({
    type: "matchmaking_started",
    creator: creator.address,
    creatorName: creator.name,
    players: eligibleAgents.map((a) => ({ address: a.address, name: a.name })),
    wagerAmount: wagerAmount.toString(),
  });

  // Send create command to first agent
  try {
    // Set pending flag BEFORE sending command to prevent race conditions
    gameCreationPending = true;

    creator.socket.send(
      JSON.stringify({
        type: "create_game_command",
        wagerAmount: wagerAmount.toString(),
        minPlayers: MIN_PLAYERS_FOR_MATCH,
        maxPlayers: eligibleAgents.length, // Match with exact number of queued players
        expectedPlayers: joiners.map((j) => ({ address: j.address, name: j.name })),
      }),
    );
    logger.info(
      { agent: creator.name, wager: wagerAmount.toString() },
      "Sent create_game_command",
    );

    // Set timeout to clear pending flag if creation takes too long (30 seconds)
    setTimeout(() => {
      if (gameCreationPending && !currentActiveGameId) {
        logger.warn("Game creation timed out, clearing pending flag");
        gameCreationPending = false;
        readdAgentsToQueue(eligibleAgents);
      }
    }, 30000);
  } catch (error) {
    logger.error({ error, agent: creator.name }, "Failed to send create command");
    gameCreationPending = false;
    // Return agents to queue
    readdAgentsToQueue(eligibleAgents);
  }
}

function readdAgentsToQueue(agents: QueuedAgent[]) {
  for (const agent of agents) {
    const connectedAgent = connectedAgents.get(agent.address);
    if (connectedAgent) {
      connectedAgent.inGame = false;
      connectedAgent.ready = true;
      connectedAgent.currentGameId = null;
    }
    // Re-add to queue if not already there
    if (!matchmakingQueue.find(a => a.address === agent.address)) {
      matchmakingQueue.push(agent);
    }
  }
}

function addToMatchmakingQueue(agent: ConnectedAgent, balance: bigint, maxWager: bigint) {
  // Remove if already in queue
  const existingIdx = matchmakingQueue.findIndex(a => a.address === agent.address);
  if (existingIdx !== -1) {
    matchmakingQueue.splice(existingIdx, 1);
  }

  // STRICT: Don't add if already in a game
  if (agent.inGame || agent.currentGameId) {
    logger.warn({ agent: agent.name, inGame: agent.inGame, currentGameId: agent.currentGameId }, 'Agent already in game, rejecting queue request');
    agent.socket.send(JSON.stringify({ type: 'queue_rejected', reason: 'already_in_game' }));
    return;
  }

  // Check if agent is in any active match (belt and suspenders)
  for (const [gameId, match] of matches) {
    if (match.status !== 'complete' && match.players.some(p => p.toLowerCase() === agent.address.toLowerCase())) {
      logger.warn({ agent: agent.name, gameId }, 'Agent found in active match, rejecting queue request');
      agent.inGame = true;
      agent.currentGameId = gameId;
      agent.socket.send(JSON.stringify({ type: 'queue_rejected', reason: 'already_in_game', gameId }));
      return;
    }
  }

  matchmakingQueue.push({
    address: agent.address,
    name: agent.name,
    socket: agent.socket,
    balance,
    maxWager,
    queuedAt: Date.now(),
  });

  agent.ready = true;
  agent.balance = balance;

  logger.info({
    agent: agent.name,
    balance: balance.toString(),
    maxWager: maxWager.toString(),
    queueSize: matchmakingQueue.length
  }, 'Agent added to matchmaking queue');

  // Notify frontends
  broadcastToAllFrontends({
    type: 'agent_queued',
    address: agent.address,
    name: agent.name,
    queueSize: matchmakingQueue.length,
    queuedAgents: matchmakingQueue.map(a => ({ address: a.address, name: a.name })),
  });

  // Try to create match immediately
  // tryCreateMatch();
}

function removeFromMatchmakingQueue(address: string) {
  const idx = matchmakingQueue.findIndex(a => a.address === address);
  if (idx !== -1) {
    const removed = matchmakingQueue.splice(idx, 1)[0];
    logger.info({ agent: removed.name, queueSize: matchmakingQueue.length }, 'Agent removed from queue');

    // Notify frontends
    broadcastToAllFrontends({
      type: 'agent_dequeued',
      address: removed.address,
      name: removed.name,
      queueSize: matchmakingQueue.length,
      queuedAgents: matchmakingQueue.map(a => ({ address: a.address, name: a.name })),
    });
  }
}

// Phase 6: Add external agent to matchmaking queue (via API)
function addExternalAgentToQueue(walletAddress: string, agentName: string, maxWager: bigint): boolean {
  const normalizedWallet = walletAddress.toLowerCase();

  // Check if already in queue
  if (matchmakingQueue.find(a => a.address.toLowerCase() === normalizedWallet)) {
    logger.warn({ walletAddress: normalizedWallet }, 'External agent already in queue');
    return false;
  }

  // Check if in a game
  for (const [gameId, match] of matches) {
    if (match.status !== 'complete' && match.players.some(p => p.toLowerCase() === normalizedWallet)) {
      logger.warn({ walletAddress: normalizedWallet, gameId }, 'External agent already in game');
      return false;
    }
  }

  // Get external agent's socket if connected
  let socket: any = null;
  for (const [_apiKey, externalAgent] of connectedExternalAgents) {
    if (externalAgent.walletAddress.toLowerCase() === normalizedWallet) {
      socket = externalAgent.socket;
      externalAgent.inQueue = true;
      break;
    }
  }

  // Add to queue (socket may be null if API-only, not WebSocket connected)
  matchmakingQueue.push({
    address: walletAddress,
    name: agentName,
    socket: socket,
    balance: maxWager, // Use maxWager as balance for external agents
    maxWager,
    queuedAt: Date.now(),
  });

  logger.info({
    agent: agentName,
    walletAddress: normalizedWallet,
    maxWager: maxWager.toString(),
    queueSize: matchmakingQueue.length,
    isExternalAgent: true,
  }, 'External agent added to matchmaking queue');

  // Notify frontends
  broadcastToAllFrontends({
    type: 'agent_queued',
    address: walletAddress,
    name: agentName,
    queueSize: matchmakingQueue.length,
    queuedAgents: matchmakingQueue.map(a => ({ address: a.address, name: a.name })),
    isExternalAgent: true,
  });

  // // Try to create match immediately
  // tryCreateMatch();

  return true;
}

// Phase 6: Get queue position for an address
function getQueuePosition(walletAddress: string): number {
  const normalizedWallet = walletAddress.toLowerCase();
  const idx = matchmakingQueue.findIndex(a => a.address.toLowerCase() === normalizedWallet);
  return idx === -1 ? -1 : idx + 1; // 1-indexed position
}

// Phase 6: Remove from queue and return success status
function removeFromQueueByWallet(walletAddress: string): boolean {
  const normalizedWallet = walletAddress.toLowerCase();
  const idx = matchmakingQueue.findIndex(a => a.address.toLowerCase() === normalizedWallet);

  if (idx === -1) {
    return false;
  }

  // Update external agent state if connected
  for (const [_apiKey, externalAgent] of connectedExternalAgents) {
    if (externalAgent.walletAddress.toLowerCase() === normalizedWallet) {
      externalAgent.inQueue = false;
      break;
    }
  }

  removeFromMatchmakingQueue(matchmakingQueue[idx].address);
  return true;
}

// Cleanup stale games and fix inconsistent agent states
function cleanupStaleGames() {
  const now = Date.now();
  const staleGameIds: string[] = [];

  // Find stale games
  for (const [gameId, match] of matches) {
    if (now - match.createdAt > STALE_GAME_TIMEOUT) {
      staleGameIds.push(gameId);
    }
  }

  // Remove stale games and free agents
  for (const gameId of staleGameIds) {
    const match = matches.get(gameId);
    if (match) {
      logger.warn({ gameId, age: now - match.createdAt }, 'Cleaning up stale game');

      // Free all agents in this game
      for (const playerAddr of match.players) {
        const agent = connectedAgents.get(playerAddr);
        if (agent && agent.currentGameId === gameId) {
          agent.inGame = false;
          agent.currentGameId = null;
          agent.ready = false;
          logger.info({ agent: agent.name, gameId }, 'Freed agent from stale game');
        }
      }

      matches.delete(gameId);
      broadcastToAllFrontends({ type: 'game_ended', gameId, reason: 'timeout' });
    }
  }

  // Also check for agents stuck in "inGame" state with no valid game
  for (const [_address, agent] of connectedAgents) {
    if (agent.inGame && agent.currentGameId) {
      if (!matches.has(agent.currentGameId)) {
        logger.warn({ agent: agent.name, gameId: agent.currentGameId }, 'Agent references non-existent game, resetting');
        agent.inGame = false;
        agent.currentGameId = null;
        agent.ready = false;
      }
    }
  }

  // Reset gameCreationPending if stuck (no active game and no pending matches)
  if (gameCreationPending && !currentActiveGameId) {
    const hasPendingMatch = Array.from(matches.values()).some(m => m.status === 'pending');
    if (!hasPendingMatch) {
      logger.warn('gameCreationPending stuck with no pending matches, resetting');
      gameCreationPending = false;
    }
  }
}

function startCleanup() {
  setInterval(() => {
    cleanupStaleGames();
  }, CLEANUP_INTERVAL);
  logger.info({ interval: CLEANUP_INTERVAL }, 'Cleanup system started');
}

async function start() {
  const fastify = Fastify({ logger: true });

  // Add CORS headers
  fastify.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header(
      "Access-Control-Expose-Headers",
      "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
    );
    if (request.method === "OPTIONS") {
      reply.send();
    }
  });

  await fastify.register(websocket);

  // Start matchmaking system
  startMatchmaking();

  // Start cleanup system for stale games
  startCleanup();

  // Phase 6: Register Public Agent API routes
  const apiContext: RouteContext = {
    getMatch: (gameId: string) => matches.get(gameId),
    getAllMatches: () => Array.from(matches.values()),
    getQueueSize: () => matchmakingQueue.length,
    getQueuePosition,
    addExternalToQueue: addExternalAgentToQueue,
    removeFromQueue: removeFromQueueByWallet,
    verifyTransaction: async (_txHash, _expectedAction, _walletAddress) => {
      // TODO: Implement actual on-chain verification via viem
      // For now, return true (trust agent's tx submission)
      logger.debug(
        { txHash: _txHash, action: _expectedAction },
        "Transaction verification (placeholder)",
      );
      return true;
    },
    broadcastToFrontends,
    broadcastToAllFrontends,
  };

  registerApiRoutes(fastify, apiContext);

  // REST endpoints
  fastify.get("/health", async () => {
    return {
      status: "ok",
      matches: matches.size,
      agents: connectedAgents.size,
      externalAgents: connectedExternalAgents.size,
      frontends: connectedFrontends.size,
      queueSize: matchmakingQueue.length,
    };
  });

  // Manual restart - trigger matchmaking
  fastify.post("/start-next-hand", async () => {
    logger.info("Manual start-next-hand triggered");

    // Directly trigger match creation
    tryCreateMatch(true);

    return {
      success: true,
      queueSize: matchmakingQueue.length,
      message: "Match creation triggered",
    };
  });

  // Start a match with specific agents selected by spectator
  fastify.post<{ Body: { agents: string[] } }>(
    "/start-selected-match",
    async (request, reply) => {
      const { agents } = request.body || {};

      if (!agents || !Array.isArray(agents) || agents.length < 2) {
        return reply.status(400).send({
          success: false,
          error: "Must provide an array of at least 2 agent names",
        });
      }

      if (agents.length > 4) {
        return reply.status(400).send({
          success: false,
          error: "Maximum 4 agents per match",
        });
      }

      logger.info(
        { agents, playerCount: agents.length },
        "Selected match requested by spectator",
      );

      // Check if a game is already in progress
      if (currentActiveGameId) {
        const activeMatch = matches.get(currentActiveGameId);
        if (activeMatch && activeMatch.status !== "complete") {
          return reply.status(409).send({
            success: false,
            error: "A game is already in progress. Wait for it to finish.",
          });
        }
        currentActiveGameId = null;
      }

      if (gameCreationPending) {
        return reply.status(409).send({
          success: false,
          error: "A game is being created. Please wait.",
        });
      }

      // Find the requested agents in connected agents (match by name, case-insensitive)
      const selectedAgents: typeof matchmakingQueue = [];
      const missingAgents: string[] = [];

      for (const requestedName of agents) {
        const normalizedName = requestedName.toLowerCase();
        let found = false;

        // First check the matchmaking queue
        for (const queuedAgent of matchmakingQueue) {
          if (queuedAgent.name.toLowerCase() === normalizedName) {
            selectedAgents.push(queuedAgent);
            found = true;
            break;
          }
        }

        // If not in queue, check connected agents and add them
        if (!found) {
          for (const [_, agent] of connectedAgents) {
            if (agent.name.toLowerCase() === normalizedName) {
              if (agent.inGame) {
                return reply.status(409).send({
                  success: false,
                  error: `Agent ${agent.name} is already in a game`,
                });
              }
              // Agent is connected but not in queue - we can still use them
              selectedAgents.push({
                address: agent.address,
                name: agent.name,
                socket: agent.socket,
                balance: agent.balance || BigInt(0),
                maxWager: FIXED_ENTRY_FEE,
                queuedAt: Date.now(),
              });
              found = true;
              break;
            }
          }
        }

        if (!found) {
          missingAgents.push(requestedName);
        }
      }

      if (missingAgents.length > 0) {
        return reply.status(404).send({
          success: false,
          error: `Agents not found or not connected: ${missingAgents.join(", ")}`,
        });
      }

      // Check balances
      for (const agent of selectedAgents) {
        if (agent.balance < FIXED_ENTRY_FEE) {
          return reply.status(400).send({
            success: false,
            error: `Agent ${agent.name} doesn't have enough balance (needs ${FIXED_ENTRY_FEE.toString()} wei)`,
          });
        }
      }

      // Remove selected agents from the matchmaking queue
      for (const agent of selectedAgents) {
        removeFromMatchmakingQueue(agent.address);
      }

      const wagerAmount = FIXED_ENTRY_FEE;

      // Sort by balance to pick creator (highest balance creates)
      const sortedAgents = [...selectedAgents].sort((a, b) =>
        a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0,
      );

      const creator = sortedAgents[0];
      const joiners = sortedAgents.slice(1);

      logger.info(
        {
          creator: creator.name,
          joiners: joiners.map((j) => j.name),
          wagerAmount: wagerAmount.toString(),
          playerCount: selectedAgents.length,
        },
        "Creating selected match",
      );

      // Notify frontends about upcoming match
      broadcastToAllFrontends({
        type: "matchmaking_started",
        creator: creator.address,
        creatorName: creator.name,
        players: selectedAgents.map((a) => ({ address: a.address, name: a.name })),
        wagerAmount: wagerAmount.toString(),
      });

      // Set pending flag and send create command
      gameCreationPending = true;

      try {
        creator.socket.send(
          JSON.stringify({
            type: "create_game_command",
            wagerAmount: wagerAmount.toString(),
            minPlayers: 2,
            maxPlayers: selectedAgents.length,
            expectedPlayers: joiners.map((j) => ({ address: j.address, name: j.name })),
          }),
        );

        // Mark agents as in-game
        for (const agent of selectedAgents) {
          const connAgent = connectedAgents.get(agent.address);
          if (connAgent) {
            connAgent.inGame = true;
          }
        }

        // Timeout if creation takes too long
        setTimeout(() => {
          if (gameCreationPending && !currentActiveGameId) {
            logger.warn("Selected match creation timed out, clearing pending flag");
            gameCreationPending = false;
            // Re-add agents to queue
            for (const agent of selectedAgents) {
              const connAgent = connectedAgents.get(agent.address);
              if (connAgent) {
                connAgent.inGame = false;
                addToMatchmakingQueue(connAgent, agent.balance, agent.maxWager);
              }
            }
          }
        }, 30000);

        return {
          success: true,
          message: `Match starting: ${selectedAgents.map((a) => a.name).join(" vs ")}`,
          creator: creator.name,
          joiners: joiners.map((j) => j.name),
          playerCount: selectedAgents.length,
        };
      } catch (error) {
        logger.error(
          { error, creator: creator.name },
          "Failed to send create command for selected match",
        );
        gameCreationPending = false;

        // Re-add agents to queue on failure
        for (const agent of selectedAgents) {
          const connAgent = connectedAgents.get(agent.address);
          if (connAgent) {
            connAgent.inGame = false;
            addToMatchmakingQueue(connAgent, agent.balance, agent.maxWager);
          }
        }

        return reply.status(500).send({
          success: false,
          error: "Failed to create match",
        });
      }
    },
  );

  // Get arena configuration (entry fee, etc.)
  fastify.get("/config", async () => {
    return {
      entryFee: FIXED_ENTRY_FEE.toString(),
      entryFeeFormatted: "0.01 MON",
      minPlayers: MIN_PLAYERS_FOR_MATCH,
      maxPlayers: MAX_PLAYERS_FOR_MATCH,
    };
  });

  fastify.get("/matches", async () => {
    return Array.from(matches.values()).map((m) => ({
      ...m,
      wagerAmount: m.wagerAmount.toString(),
    }));
  });

  fastify.get("/matches/pending", async () => {
    return Array.from(matches.values())
      .filter((m) => m.status === "pending")
      .map((m) => ({
        ...m,
        wagerAmount: m.wagerAmount.toString(),
      }));
  });

  fastify.get("/leaderboard", async () => {
    // TODO: Fetch from Tournament contract
    return [];
  });

  // Get single game state
  fastify.get<{ Params: { gameId: string } }>("/games/:gameId", async (request) => {
    const { gameId } = request.params;
    const match = matches.get(gameId);
    if (!match) {
      return { error: "Game not found" };
    }
    return {
      ...match,
      wagerAmount: match.wagerAmount.toString(),
    };
  });

  // Get connected agents
  fastify.get("/agents", async () => {
    return Array.from(connectedAgents.values()).map((a) => ({
      address: a.address,
      name: a.name,
      lastPing: a.lastPing,
      ready: a.ready,
      inGame: a.inGame,
      balance: a.balance?.toString(),
    }));
  });

  // Get matchmaking queue
  fastify.get("/queue", async () => {
    return {
      queueSize: matchmakingQueue.length,
      agents: matchmakingQueue.map((a) => ({
        address: a.address,
        name: a.name,
        balance: a.balance.toString(),
        maxWager: a.maxWager.toString(),
        queuedAt: a.queuedAt,
        waitTime: Date.now() - a.queuedAt,
      })),
    };
  });

  // WebSocket for real-time updates
  fastify.register(async function (fastify) {
    fastify.get("/ws", { websocket: true }, (connection, _req) => {
      const socket = connection.socket;
      let clientId: string | null = null;
      let clientType: "agent" | "frontend" | "external_agent" | null = null;

      logger.info("New WebSocket connection");

      socket.on("message", (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());

          // Track client type based on first message
          if (!clientType) {
            // Phase 6: Handle external agent API authentication via WebSocket
            if (data.type === "api_auth") {
              const apiKey = data.apiKey;
              const agent = validateApiKey(apiKey);

              if (!agent) {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    code: "INVALID_API_KEY",
                    message: "Invalid or expired API key",
                  }),
                );
                socket.close();
                return;
              }

              clientType = "external_agent";
              clientId = apiKey;

              // Store connected external agent
              connectedExternalAgents.set(apiKey, {
                apiKey,
                walletAddress: agent.walletAddress,
                agentName: agent.agentName,
                socket,
                connectedAt: Date.now(),
                lastActivity: Date.now(),
                inQueue: false,
                inGame: false,
                currentGameId: null,
              });

              logger.info(
                {
                  agentName: agent.agentName,
                  walletAddress: agent.walletAddress,
                },
                "External agent authenticated via WebSocket",
              );

              socket.send(
                JSON.stringify({
                  type: "api_authenticated",
                  agentName: agent.agentName,
                  walletAddress: agent.walletAddress,
                }),
              );

              // Send current queue state
              socket.send(
                JSON.stringify({
                  type: "queue_update",
                  position: getQueuePosition(agent.walletAddress),
                  queueSize: matchmakingQueue.length,
                  estimatedWait:
                    getQueuePosition(agent.walletAddress) > 0
                      ? "~30 seconds"
                      : "Not in queue",
                  timestamp: Date.now(),
                }),
              );

              return;
            }

            if (data.type === "register") {
              clientType = "agent";
              clientId = data.address;
            } else if (data.type === "frontend_connect") {
              clientType = "frontend";
              clientId = generateFrontendId();
              connectedFrontends.set(clientId, {
                socket,
                subscribedGames: new Set(),
                connectedAt: Date.now(),
              });
              logger.info({ clientId }, "Frontend connected");
              socket.send(JSON.stringify({ type: "frontend_connected", clientId }));

              // Send current queue state
              socket.send(
                JSON.stringify({
                  type: "queue_state",
                  queueSize: matchmakingQueue.length,
                  queuedAgents: matchmakingQueue.map((a) => ({
                    address: a.address,
                    name: a.name,
                  })),
                }),
              );

              // Send any active games so frontend can subscribe
              for (const [gameId, match] of matches) {
                if (match.status === "active" || match.status === "pending") {
                  socket.send(
                    JSON.stringify({
                      type: "match_created",
                      gameId: match.gameId,
                      creator: match.players[0],
                      creatorName: match.playerNames[0],
                      players: match.players.map((addr, i) => ({
                        address: addr,
                        name: match.playerNames[i],
                      })),
                      wagerAmount: match.wagerAmount.toString(),
                      status: match.status,
                    }),
                  );
                  logger.info({ clientId, gameId }, "Sent active game to new frontend");
                }
              }

              // Notify all agents that a spectator is now watching - games can start
              broadcast({
                type: "spectator_ready",
                frontendCount: connectedFrontends.size,
                message: "A spectator has connected. Matchmaking is now active.",
              });

              // // Immediately try to create a match now that a frontend is connected
              // if (matchmakingQueue.length >= MIN_PLAYERS_FOR_MATCH) {
              //   logger.info(
              //     { queueSize: matchmakingQueue.length },
              //     "Frontend connected - triggering matchmaking",
              //   );
              //   tryCreateMatch();
              // }

              return;
            }
          }

          handleMessage(socket, data, clientId, clientType);
        } catch (error) {
          logger.error({ error }, "Failed to parse message");
        }
      });

      socket.on("close", () => {
        // Remove from connected agents
        for (const [address, agent] of connectedAgents) {
          if (agent.socket === socket) {
            // Remove from matchmaking queue
            removeFromMatchmakingQueue(address);
            connectedAgents.delete(address);
            agentNameRegistry.delete(address.toLowerCase());
            logger.info({ address, name: agent.name }, "Agent disconnected");

            // Notify frontends
            broadcastToAllFrontends({
              type: "agent_disconnected",
              address,
              name: agent.name,
            });
            break;
          }
        }
        // Remove from connected frontends
        for (const [id, frontend] of connectedFrontends) {
          if (frontend.socket === socket) {
            connectedFrontends.delete(id);
            logger.info({ id }, "Frontend disconnected");

            // Notify agents if no more frontends are connected
            if (connectedFrontends.size === 0) {
              broadcast({
                type: "spectator_disconnected",
                frontendCount: 0,
                message:
                  "No spectators connected. Matchmaking paused until a spectator joins.",
              });
              logger.warn("All frontends disconnected - matchmaking paused");
            }
            break;
          }
        }
        // Phase 6: Remove from connected external agents
        for (const [apiKey, externalAgent] of connectedExternalAgents) {
          if (externalAgent.socket === socket) {
            // Remove from matchmaking queue if in it
            removeFromQueueByWallet(externalAgent.walletAddress);
            connectedExternalAgents.delete(apiKey);
            logger.info(
              {
                agentName: externalAgent.agentName,
                walletAddress: externalAgent.walletAddress,
              },
              "External agent disconnected",
            );

            // Notify frontends
            broadcastToAllFrontends({
              type: "external_agent_disconnected",
              walletAddress: externalAgent.walletAddress,
              agentName: externalAgent.agentName,
            });
            break;
          }
        }
      });
    });
  });

  function handleMessage(
    socket: any,
    data: any,
    clientId: string | null,
    clientType: "agent" | "frontend" | "external_agent" | null,
  ) {
    switch (data.type) {
      case "register":
        // Agent registration with name
        const agentName = data.name || data.personality || "Unknown";
        const agentAddress = data.address.toLowerCase();

        connectedAgents.set(data.address, {
          address: data.address,
          name: agentName,
          socket,
          lastPing: Date.now(),
          balance: BigInt(data.balance || "0"),
          ready: false,
          inGame: false,
          currentGameId: null,
        });

        // Store name in registry for lookups
        agentNameRegistry.set(agentAddress, agentName);

        logger.info({ address: data.address, name: agentName }, "Agent registered");
        socket.send(JSON.stringify({ type: "registered", success: true }));

        // Broadcast agent list update to frontends
        broadcastToAllFrontends({
          type: "agent_connected",
          address: data.address,
          name: agentName,
        });
        break;

      case "ready_to_play":
        // Agent signals ready for matchmaking
        const readyAgent = connectedAgents.get(data.address);
        if (readyAgent) {
          const balance = BigInt(data.balance || "0");
          const maxWager = BigInt(data.maxWager || "0");
          readyAgent.balance = balance;
          addToMatchmakingQueue(readyAgent, balance, maxWager);
          socket.send(
            JSON.stringify({ type: "queued", queueSize: matchmakingQueue.length }),
          );
        }
        break;

      case "cancel_ready":
        // Agent wants to leave the queue
        removeFromMatchmakingQueue(data.address);
        const cancelAgent = connectedAgents.get(data.address);
        if (cancelAgent) {
          cancelAgent.ready = false;
        }
        socket.send(JSON.stringify({ type: "dequeued" }));
        break;

      case "game_created_by_command":
        // Agent created a game as instructed - now tell others to join
        const gameId = data.gameId;
        const creatorAddr = data.creator.toLowerCase();
        const wager = BigInt(data.wagerAmount);

        logger.info(
          {
            gameId,
            creator: agentNameRegistry.get(creatorAddr),
            wager: wager.toString(),
            pendingJoiners: data.pendingJoiners?.length || 0,
          },
          "Game created by coordinator command",
        );

        // Update creator's currentGameId with real game ID
        const creatorAgent = connectedAgents.get(data.creator);
        if (creatorAgent) {
          creatorAgent.currentGameId = gameId;
        }

        // Update joiners' currentGameId
        for (const joinerInfo of data.pendingJoiners || []) {
          const joinerAgent = connectedAgents.get(joinerInfo.address);
          if (joinerAgent) {
            joinerAgent.currentGameId = gameId;
            joinerAgent.inGame = true;
          }
        }

        // Track this match
        const matchCreatorName = agentNameRegistry.get(creatorAddr) || "Unknown";
        const matchJoinerNames = (data.pendingJoiners || []).map(
          (j: { address: string }) =>
            agentNameRegistry.get(j.address.toLowerCase()) || "Unknown",
        );
        matches.set(gameId, {
          gameId,
          players: [
            data.creator,
            ...(data.pendingJoiners || []).map((j: { address: string }) => j.address),
          ],
          playerNames: [matchCreatorName, ...matchJoinerNames],
          wagerAmount: wager,
          status: "active",
          minPlayers: MIN_PLAYERS_FOR_MATCH,
          maxPlayers: MAX_PLAYERS_FOR_MATCH,
          createdAt: Date.now(),
        });

        // Tell pending joiners to join this game
        if (data.pendingJoiners && data.pendingJoiners.length > 0) {
          for (const joinerInfo of data.pendingJoiners) {
            const joinerAgent = connectedAgents.get(joinerInfo.address);
            if (joinerAgent && joinerAgent.socket) {
              try {
                joinerAgent.socket.send(
                  JSON.stringify({
                    type: "join_game_command",
                    gameId,
                    wagerAmount: wager.toString(),
                    creatorAddress: data.creator,
                    creatorName: agentNameRegistry.get(creatorAddr) || "Unknown",
                  }),
                );
                logger.info(
                  {
                    agent: joinerAgent.name,
                    gameId,
                  },
                  "Sent join_game_command",
                );
              } catch (error) {
                logger.error(
                  { error, agent: joinerAgent.name },
                  "Failed to send join command",
                );
              }
            }
          }
        }

        // Notify frontends with full player list
        const allPlayers = [
          data.creator,
          ...(data.pendingJoiners || []).map((j: { address: string }) => j.address),
        ];
        const allPlayerNames = [matchCreatorName, ...matchJoinerNames];

        broadcastToAllFrontends({
          type: "match_created",
          gameId,
          creator: data.creator,
          creatorName: matchCreatorName,
          players: allPlayers,
          playerNames: allPlayerNames,
          wagerAmount: wager.toString(),
        });

        // Also send game_started so frontends set up activePlayers properly
        broadcastToAllFrontends({
          type: "game_started",
          gameId,
          players: allPlayers,
          playerNames: allPlayerNames,
          startedAt: Date.now(),
        });
        break;

      case "game_finished":
        // Agent finished a game - mark as available
        const finishedAgent = connectedAgents.get(data.address);
        if (finishedAgent) {
          finishedAgent.inGame = false;
          finishedAgent.currentGameId = null;
          finishedAgent.ready = true;
          logger.info(
            { agent: finishedAgent.name, won: data.won, gameId: data.gameId },
            "Agent finished game",
          );

          // Clean up match if this game exists
          if (data.gameId && matches.has(data.gameId)) {
            const match = matches.get(data.gameId);
            // Mark all players in this match as no longer in game
            if (match) {
              for (const playerAddr of match.players) {
                const playerAgent = connectedAgents.get(playerAddr);
                if (playerAgent && playerAgent.currentGameId === data.gameId) {
                  playerAgent.inGame = false;
                  playerAgent.currentGameId = null;
                }

                // Phase 6: Also clean up external agents in this game
                for (const [apiKey, extAgent] of connectedExternalAgents) {
                  if (
                    extAgent.walletAddress.toLowerCase() === playerAddr.toLowerCase() &&
                    extAgent.currentGameId === data.gameId
                  ) {
                    extAgent.inGame = false;
                    extAgent.currentGameId = null;

                    // Update external agent stats
                    const extAgentWon =
                      data.won &&
                      data.address.toLowerCase() === extAgent.walletAddress.toLowerCase();
                    updateAgentStats(apiKey, extAgentWon);

                    // Send game_result to external agent
                    sendToExternalAgent(extAgent.walletAddress, {
                      type: "game_result",
                      gameId: data.gameId,
                      winner: data.won ? data.address : "opponent",
                      winnerName: data.won ? finishedAgent?.name : "Opponent",
                      pot: data.pot || "0",
                      yourResult: extAgentWon ? "won" : "lost",
                      amountWon: extAgentWon ? data.pot : undefined,
                      amountLost: !extAgentWon ? match.wagerAmount.toString() : undefined,
                      timestamp: Date.now(),
                    });
                  }
                }
              }

              // Send game_ended ONCE - only if not already sent
              if (!completedGameIds.has(data.gameId)) {
                broadcastToAllFrontends({
                  type: "game_ended",
                  gameId: data.gameId,
                  winner: data.won ? data.address : "opponent",
                  winnerName: data.won ? finishedAgent?.name : "Opponent",
                });
                logger.info(
                  { gameId: data.gameId, agent: finishedAgent?.name },
                  "Sent game_ended to frontends (first agent report)",
                );

                // Mark as completed so second agent doesn't broadcast again
                completedGameIds.add(data.gameId);

                // Clean up completed game ID after 30 seconds
                setTimeout(() => {
                  completedGameIds.delete(data.gameId);
                }, 30000);
              } else {
                logger.debug(
                  { gameId: data.gameId, agent: finishedAgent?.name },
                  "Skipping duplicate game_ended broadcast (second agent report)",
                );
              }
            }
            matches.delete(data.gameId);
            logger.info({ gameId: data.gameId }, "Match cleaned up from tracked games");
          }

          // STRICT: Clear active game
          if (currentActiveGameId === data.gameId) {
            currentActiveGameId = null;
            logger.info({ gameId: data.gameId }, "Active game finished and cleared");
          }

          // Re-add agents to queue after game (manual start required)
          if (data.balance && data.maxWager) {
            setTimeout(() => {
              const agent = connectedAgents.get(data.address);
              if (agent && !agent.inGame && !agent.currentGameId) {
                addToMatchmakingQueue(agent, BigInt(data.balance), BigInt(data.maxWager));
              }
            }, 3000);
          }
        }
        break;

      case "ping":
        const agent = connectedAgents.get(data.address);
        if (agent) {
          agent.lastPing = Date.now();
        }
        socket.send(JSON.stringify({ type: "pong" }));
        break;

      case "match_created":
        const creatorAddress = data.player.toLowerCase();
        const creatorName = agentNameRegistry.get(creatorAddress) || "Unknown";

        // Clear pending flag - game creation confirmed
        gameCreationPending = false;

        // STRICT: Set this as the active game
        currentActiveGameId = data.gameId;
        logger.info(
          { gameId: data.gameId, creator: creatorName },
          "New active game created",
        );

        matches.set(data.gameId, {
          gameId: data.gameId,
          players: [data.player],
          playerNames: [creatorName],
          wagerAmount: BigInt(data.wagerAmount),
          status: "pending",
          minPlayers: data.minPlayers || 2,
          maxPlayers: data.maxPlayers || 2, // STRICT: Always 2 players
          createdAt: Date.now(),
        });

        broadcast({ type: "new_match", match: { ...data, creatorName } });

        // Notify frontends
        broadcastToAllFrontends({
          type: "game_created",
          gameId: data.gameId,
          player: data.player,
          playerName: creatorName,
          wagerAmount: data.wagerAmount,
          minPlayers: data.minPlayers || MIN_PLAYERS_FOR_MATCH,
          maxPlayers: data.maxPlayers || MAX_PLAYERS_FOR_MATCH,
        });
        break;

      case "match_joined":
        const match = matches.get(data.gameId);
        if (match) {
          const joinerAddress = data.player.toLowerCase();
          const joinerName = agentNameRegistry.get(joinerAddress) || "Unknown";

          // IMPORTANT: Check if player is already in the match to prevent duplicates
          const alreadyInMatch = match.players.some(
            (p) => p.toLowerCase() === joinerAddress,
          );
          if (alreadyInMatch) {
            logger.debug(
              { agent: joinerName, gameId: data.gameId },
              "Player already in match, ignoring duplicate join",
            );
            break;
          }

          match.players.push(data.player);
          match.playerNames.push(joinerName);

          // Check if game should start
          if (match.players.length >= match.maxPlayers) {
            match.status = "active";
            match.startedAt = Date.now();
          }

          broadcast({
            type: "match_started",
            gameId: data.gameId,
            players: match.players,
            playerNames: match.playerNames,
          });

          // Notify frontends watching this game
          broadcastToFrontends(data.gameId, {
            type: "player_joined",
            gameId: data.gameId,
            player: data.player,
            playerName: joinerName,
            playerCount: match.players.length,
            players: match.players,
            playerNames: match.playerNames,
          });

          if (match.status === "active") {
            broadcastToFrontends(data.gameId, {
              type: "game_started",
              gameId: data.gameId,
              players: match.players,
              playerNames: match.playerNames,
              startedAt: match.startedAt,
            });
          }
        }
        break;

      case "match_complete":
        const completedMatch = matches.get(data.gameId);
        if (completedMatch) {
          completedMatch.status = "complete";
          completedMatch.completedAt = Date.now();

          // STRICT: Clear active game so next match can start
          if (currentActiveGameId === data.gameId) {
            currentActiveGameId = null;
            logger.info(
              { gameId: data.gameId },
              "Active game completed, ready for next match",
            );
          }

          const winnerAddress = data.winner?.toLowerCase();
          const winnerName = winnerAddress
            ? agentNameRegistry.get(winnerAddress)
            : undefined;

          broadcast({ type: "match_ended", ...data, winnerName });

          // Notify frontends watching this game
          broadcastToFrontends(data.gameId, {
            type: "game_ended",
            gameId: data.gameId,
            winner: data.winner,
            winnerName: winnerName || "Unknown",
            reason: data.reason,
            startedAt: completedMatch.startedAt,
            completedAt: completedMatch.completedAt,
            duration: completedMatch.startedAt
              ? completedMatch.completedAt - completedMatch.startedAt
              : undefined,
          });
        }
        break;

      // Frontend subscribes to a specific game
      case "frontend_subscribe":
        if (clientType === "frontend" && clientId) {
          const frontend = connectedFrontends.get(clientId);
          if (frontend) {
            frontend.subscribedGames.add(data.gameId);
            logger.info({ clientId, gameId: data.gameId }, "Frontend subscribed to game");

            // Send current game state if available
            const gameMatch = matches.get(data.gameId);
            socket.send(
              JSON.stringify({
                type: "subscribed",
                gameId: data.gameId,
                match: gameMatch
                  ? {
                      ...gameMatch,
                      wagerAmount: gameMatch.wagerAmount.toString(),
                    }
                  : null,
              }),
            );
          }
        }
        break;

      // Frontend unsubscribes from a game
      case "frontend_unsubscribe":
        if (clientType === "frontend" && clientId) {
          const frontend = connectedFrontends.get(clientId);
          if (frontend) {
            frontend.subscribedGames.delete(data.gameId);
            logger.info(
              { clientId, gameId: data.gameId },
              "Frontend unsubscribed from game",
            );
          }
        }
        break;

      // Agent sends thought/reasoning to relay to frontends
      case "agent_thought":
        const thoughtAgentAddress = data.agentAddress?.toLowerCase();
        const thoughtAgentName =
          data.agentName || agentNameRegistry.get(thoughtAgentAddress) || "Agent";

        logger.info(
          {
            gameId: data.gameId,
            agent: thoughtAgentName,
            action: data.action,
            subscribedFrontends: connectedFrontends.size,
          },
          "Relaying agent thought to frontends",
        );

        broadcastToFrontends(data.gameId, {
          type: "agent_thought",
          gameId: data.gameId,
          agentAddress: data.agentAddress,
          agentName: thoughtAgentName,
          action: data.action,
          amount: data.amount,
          reasoning: data.reasoning,
          rawReasoning: data.rawReasoning,
          confidence: data.confidence,
          equity: data.equity,
          potOdds: data.potOdds,
          holeCards: data.holeCards, // Pass through hole cards for frontend display
          timestamp: Date.now(),
        });

        // Also broadcast to all frontends (for game list display)
        broadcastToAllFrontends({
          type: "agent_action",
          gameId: data.gameId,
          agentName: thoughtAgentName,
          action: data.action,
        });

        // Spectator notification: All-in action
        if (data.action === "all_in" || data.action === "allin") {
          broadcastToFrontends(data.gameId, {
            type: "spectator_notification",
            notificationType: "all_in",
            gameId: data.gameId,
            message: `${thoughtAgentName} goes ALL IN!`,
            agentName: thoughtAgentName,
            amount: data.amount,
            timestamp: Date.now(),
          });
          logger.info(
            { gameId: data.gameId, agent: thoughtAgentName },
            "Spectator notification: ALL IN",
          );
        }
        break;

      // Agent's turn has started - relay to frontends for timer display
      case "turn_started":
        const turnAgentName =
          data.agentName ||
          agentNameRegistry.get(data.agentAddress?.toLowerCase()) ||
          "Agent";

        logger.info(
          {
            gameId: data.gameId,
            agent: turnAgentName,
            turnDurationMs: data.turnDurationMs,
          },
          "Relaying turn_started to frontends",
        );

        broadcastToFrontends(data.gameId, {
          type: "turn_started",
          gameId: data.gameId,
          agentAddress: data.agentAddress,
          agentName: turnAgentName,
          turnDurationMs: data.turnDurationMs,
          timestamp: data.timestamp || Date.now(),
        });

        // Phase 6: Send 'your_turn' to external agent if it's their turn
        if (data.agentAddress) {
          const turnAddress = data.agentAddress.toLowerCase();
          for (const [_apiKey, extAgent] of connectedExternalAgents) {
            if (extAgent.walletAddress.toLowerCase() === turnAddress) {
              sendToExternalAgent(extAgent.walletAddress, {
                type: "your_turn",
                gameId: data.gameId,
                gameState: data.gameState || [],
                pot: data.pot || "0",
                phase: data.phase || "preflop",
                communityCards: data.communityCards || [],
                holeCards: data.holeCards || [],
                validActions: data.validActions || [
                  { action: "fold" },
                  { action: "check" },
                  { action: "call" },
                  { action: "raise" },
                  { action: "all_in" },
                ],
                timeoutMs: data.turnDurationMs || 30000,
                timestamp: Date.now(),
              });
              logger.info(
                {
                  gameId: data.gameId,
                  agent: extAgent.agentName,
                },
                "Sent your_turn to external agent",
              );
              break;
            }
          }
        }
        break;

      // Agent sends initial hole cards for spectator display
      case "agent_cards":
        const cardsAgentName =
          data.agentName ||
          agentNameRegistry.get(data.agentAddress?.toLowerCase()) ||
          "Agent";

        logger.info(
          {
            gameId: data.gameId,
            agent: cardsAgentName,
            cards: data.holeCards,
          },
          "Relaying agent_cards to frontends",
        );

        broadcastToFrontends(data.gameId, {
          type: "agent_cards",
          gameId: data.gameId,
          agentAddress: data.agentAddress,
          agentName: cardsAgentName,
          holeCards: data.holeCards,
          timestamp: data.timestamp || Date.now(),
        });
        break;

      // Phase changed - relay to frontends for pause display
      case "phase_changed":
        logger.info(
          {
            gameId: data.gameId,
            phase: data.phase,
            pauseDurationMs: data.pauseDurationMs,
          },
          "Relaying phase_changed to frontends",
        );

        broadcastToFrontends(data.gameId, {
          type: "phase_changed",
          gameId: data.gameId,
          phase: data.phase,
          pauseDurationMs: data.pauseDurationMs,
          timestamp: Date.now(),
        });

        // Phase 6: Send game_state update to external agents in this game
        const phaseMatch = matches.get(data.gameId);
        if (phaseMatch) {
          for (const playerAddr of phaseMatch.players) {
            for (const [_apiKey, extAgent] of connectedExternalAgents) {
              if (extAgent.walletAddress.toLowerCase() === playerAddr.toLowerCase()) {
                sendToExternalAgent(extAgent.walletAddress, {
                  type: "game_state",
                  gameId: data.gameId,
                  players: data.players || [],
                  pot: data.pot || "0",
                  phase: data.phase,
                  communityCards: data.communityCards || [],
                  currentTurn: data.currentTurn || "",
                  minBet: data.minBet || "0",
                  timestamp: Date.now(),
                });
              }
            }
          }
        }

        // Spectator notification: Showdown reached with multiple players
        if (data.phase === "showdown" && data.activePlayers && data.activePlayers > 1) {
          broadcastToFrontends(data.gameId, {
            type: "spectator_notification",
            notificationType: "showdown",
            gameId: data.gameId,
            message: `Showdown! ${data.activePlayers} players reveal their cards!`,
            activePlayers: data.activePlayers,
            timestamp: Date.now(),
          });
          logger.info(
            { gameId: data.gameId, activePlayers: data.activePlayers },
            "Spectator notification: SHOWDOWN",
          );
        }
        break;

      // Pot update - check for big pot notifications
      case "pot_update":
        const BIG_POT_THRESHOLD = BigInt("50000000000000000"); // 0.05 MON
        const potAmount = BigInt(data.pot || "0");

        if (potAmount >= BIG_POT_THRESHOLD) {
          const potMon = Number(potAmount) / 1e18;
          broadcastToFrontends(data.gameId, {
            type: "spectator_notification",
            notificationType: "big_pot",
            gameId: data.gameId,
            message: `Big pot alert! ${potMon.toFixed(3)} MON at stake!`,
            pot: data.pot,
            timestamp: Date.now(),
          });
          logger.info(
            { gameId: data.gameId, pot: data.pot },
            "Spectator notification: BIG POT",
          );
        }
        break;

      // Winner celebration - relay to frontends
      case "winner_celebration":
        const winnerCelebName =
          data.winnerName ||
          agentNameRegistry.get(data.winnerAddress?.toLowerCase()) ||
          "Winner";

        logger.info(
          {
            gameId: data.gameId,
            winner: winnerCelebName,
            pot: data.pot,
          },
          "Relaying winner_celebration to frontends",
        );

        broadcastToFrontends(data.gameId, {
          type: "winner_celebration",
          gameId: data.gameId,
          winnerAddress: data.winnerAddress,
          winnerName: winnerCelebName,
          pot: data.pot,
          celebrationDurationMs: data.celebrationDurationMs || 5000,
          timestamp: Date.now(),
        });
        break;

      default:
        logger.warn({ type: data.type }, "Unknown message type");
    }
  }

  // Start server
  const port = parseInt(process.env.PORT || "8080");
  const host = process.env.HOST || "0.0.0.0";

  try {
    await fastify.listen({ port, host });
    logger.info(`Coordinator running on ${host}:${port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
