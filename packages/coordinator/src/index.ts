import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { pino } from 'pino';

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
}

interface ConnectedAgent {
  address: string;
  name: string; // Agent personality name
  socket: any;
  lastPing: number;
  balance: bigint; // Agent's wallet balance
  ready: boolean; // Ready to be matched
  inGame: boolean; // Currently in a game
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
const connectedAgents = new Map<string, ConnectedAgent>();
const connectedFrontends = new Map<string, ConnectedFrontend>();
const matchmakingQueue: QueuedAgent[] = [];

// Matchmaking configuration
const MATCHMAKING_INTERVAL = 3000; // Check queue every 3 seconds
const MIN_PLAYERS_FOR_MATCH = 3; // Start with 3 players if 4 not available
const MAX_PLAYERS_FOR_MATCH = 4;
const DEFAULT_WAGER = BigInt('1000000000000000'); // 0.001 ETH default (lowered for testing)

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

// Matchmaking logic
function startMatchmaking() {
  setInterval(() => {
    tryCreateMatch();
  }, MATCHMAKING_INTERVAL);
  logger.info({ interval: MATCHMAKING_INTERVAL }, 'Matchmaking system started');
}

function tryCreateMatch() {
  // Need at least MIN_PLAYERS_FOR_MATCH agents in queue
  if (matchmakingQueue.length < MIN_PLAYERS_FOR_MATCH) {
    return;
  }

  // Get agents that can afford to play (sorted by queue time)
  const eligibleAgents = matchmakingQueue
    .filter(a => a.balance >= DEFAULT_WAGER)
    .slice(0, MAX_PLAYERS_FOR_MATCH);

  if (eligibleAgents.length < MIN_PLAYERS_FOR_MATCH) {
    logger.debug({
      queueSize: matchmakingQueue.length,
      eligible: eligibleAgents.length
    }, 'Not enough eligible agents for match');
    return;
  }

  // Calculate wager - use the minimum maxWager among all players
  const wagerAmount = eligibleAgents.reduce(
    (min, agent) => agent.maxWager < min ? agent.maxWager : min,
    eligibleAgents[0].maxWager
  );

  // Remove matched agents from queue
  for (const agent of eligibleAgents) {
    const idx = matchmakingQueue.findIndex(a => a.address === agent.address);
    if (idx !== -1) {
      matchmakingQueue.splice(idx, 1);
    }
    // Mark agent as in game
    const connectedAgent = connectedAgents.get(agent.address);
    if (connectedAgent) {
      connectedAgent.inGame = true;
      connectedAgent.ready = false;
    }
  }

  // First agent creates the game
  const creator = eligibleAgents[0];
  const joiners = eligibleAgents.slice(1);

  logger.info({
    creator: creator.name,
    joiners: joiners.map(j => j.name),
    wagerAmount: wagerAmount.toString(),
    playerCount: eligibleAgents.length,
  }, 'Creating match via coordinator');

  // Notify frontends about upcoming match
  broadcastToAllFrontends({
    type: 'matchmaking_started',
    creator: creator.address,
    creatorName: creator.name,
    players: eligibleAgents.map(a => ({ address: a.address, name: a.name })),
    wagerAmount: wagerAmount.toString(),
  });

  // Send create command to first agent
  try {
    creator.socket.send(JSON.stringify({
      type: 'create_game_command',
      wagerAmount: wagerAmount.toString(),
      minPlayers: MIN_PLAYERS_FOR_MATCH,
      maxPlayers: eligibleAgents.length, // Match with exact number of queued players
      expectedPlayers: joiners.map(j => ({ address: j.address, name: j.name })),
    }));
    logger.info({ agent: creator.name, wager: wagerAmount.toString() }, 'Sent create_game_command');
  } catch (error) {
    logger.error({ error, agent: creator.name }, 'Failed to send create command');
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

  // Don't add if already in a game
  if (agent.inGame) {
    logger.debug({ agent: agent.name }, 'Agent already in game, not adding to queue');
    return;
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
  tryCreateMatch();
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

async function start() {
  const fastify = Fastify({ logger: true });

  // Add CORS headers
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
      reply.send();
    }
  });

  await fastify.register(websocket);

  // Start matchmaking system
  startMatchmaking();

  // REST endpoints
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      matches: matches.size,
      agents: connectedAgents.size,
      frontends: connectedFrontends.size,
      queueSize: matchmakingQueue.length,
    };
  });

  fastify.get('/matches', async () => {
    return Array.from(matches.values()).map(m => ({
      ...m,
      wagerAmount: m.wagerAmount.toString(),
    }));
  });

  fastify.get('/matches/pending', async () => {
    return Array.from(matches.values())
      .filter(m => m.status === 'pending')
      .map(m => ({
        ...m,
        wagerAmount: m.wagerAmount.toString(),
      }));
  });

  fastify.get('/leaderboard', async () => {
    // TODO: Fetch from Tournament contract
    return [];
  });

  // Get single game state
  fastify.get<{ Params: { gameId: string } }>('/games/:gameId', async (request) => {
    const { gameId } = request.params;
    const match = matches.get(gameId);
    if (!match) {
      return { error: 'Game not found' };
    }
    return {
      ...match,
      wagerAmount: match.wagerAmount.toString(),
    };
  });

  // Get connected agents
  fastify.get('/agents', async () => {
    return Array.from(connectedAgents.values()).map(a => ({
      address: a.address,
      name: a.name,
      lastPing: a.lastPing,
      ready: a.ready,
      inGame: a.inGame,
      balance: a.balance?.toString(),
    }));
  });

  // Get matchmaking queue
  fastify.get('/queue', async () => {
    return {
      queueSize: matchmakingQueue.length,
      agents: matchmakingQueue.map(a => ({
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
    fastify.get('/ws', { websocket: true }, (connection, _req) => {
      const socket = connection.socket;
      let clientId: string | null = null;
      let clientType: 'agent' | 'frontend' | null = null;

      logger.info('New WebSocket connection');

      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());

          // Track client type based on first message
          if (!clientType) {
            if (data.type === 'register') {
              clientType = 'agent';
              clientId = data.address;
            } else if (data.type === 'frontend_connect') {
              clientType = 'frontend';
              clientId = generateFrontendId();
              connectedFrontends.set(clientId, {
                socket,
                subscribedGames: new Set(),
                connectedAt: Date.now(),
              });
              logger.info({ clientId }, 'Frontend connected');
              socket.send(JSON.stringify({ type: 'frontend_connected', clientId }));

              // Send current queue state
              socket.send(JSON.stringify({
                type: 'queue_state',
                queueSize: matchmakingQueue.length,
                queuedAgents: matchmakingQueue.map(a => ({ address: a.address, name: a.name })),
              }));

              // Send any active games so frontend can subscribe
              for (const [gameId, match] of matches) {
                if (match.status === 'active' || match.status === 'pending') {
                  socket.send(JSON.stringify({
                    type: 'match_created',
                    gameId: match.gameId,
                    creator: match.players[0],
                    creatorName: match.playerNames[0],
                    players: match.players.map((addr, i) => ({
                      address: addr,
                      name: match.playerNames[i]
                    })),
                    wagerAmount: match.wagerAmount.toString(),
                    status: match.status,
                  }));
                  logger.info({ clientId, gameId }, 'Sent active game to new frontend');
                }
              }
              return;
            }
          }

          handleMessage(socket, data, clientId, clientType);
        } catch (error) {
          logger.error({ error }, 'Failed to parse message');
        }
      });

      socket.on('close', () => {
        // Remove from connected agents
        for (const [address, agent] of connectedAgents) {
          if (agent.socket === socket) {
            // Remove from matchmaking queue
            removeFromMatchmakingQueue(address);
            connectedAgents.delete(address);
            agentNameRegistry.delete(address.toLowerCase());
            logger.info({ address, name: agent.name }, 'Agent disconnected');

            // Notify frontends
            broadcastToAllFrontends({
              type: 'agent_disconnected',
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
            logger.info({ id }, 'Frontend disconnected');
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
    clientType: 'agent' | 'frontend' | null
  ) {
    switch (data.type) {
      case 'register':
        // Agent registration with name
        const agentName = data.name || data.personality || 'Unknown';
        const agentAddress = data.address.toLowerCase();

        connectedAgents.set(data.address, {
          address: data.address,
          name: agentName,
          socket,
          lastPing: Date.now(),
          balance: BigInt(data.balance || '0'),
          ready: false,
          inGame: false,
        });

        // Store name in registry for lookups
        agentNameRegistry.set(agentAddress, agentName);

        logger.info({ address: data.address, name: agentName }, 'Agent registered');
        socket.send(JSON.stringify({ type: 'registered', success: true }));

        // Broadcast agent list update to frontends
        broadcastToAllFrontends({
          type: 'agent_connected',
          address: data.address,
          name: agentName,
        });
        break;

      case 'ready_to_play':
        // Agent signals ready for matchmaking
        const readyAgent = connectedAgents.get(data.address);
        if (readyAgent) {
          const balance = BigInt(data.balance || '0');
          const maxWager = BigInt(data.maxWager || '0');
          addToMatchmakingQueue(readyAgent, balance, maxWager);
          socket.send(JSON.stringify({ type: 'queued', queueSize: matchmakingQueue.length }));
        }
        break;

      case 'cancel_ready':
        // Agent wants to leave the queue
        removeFromMatchmakingQueue(data.address);
        const cancelAgent = connectedAgents.get(data.address);
        if (cancelAgent) {
          cancelAgent.ready = false;
        }
        socket.send(JSON.stringify({ type: 'dequeued' }));
        break;

      case 'game_created_by_command':
        // Agent created a game as instructed - now tell others to join
        const gameId = data.gameId;
        const creatorAddr = data.creator.toLowerCase();
        const wager = BigInt(data.wagerAmount);

        logger.info({
          gameId,
          creator: agentNameRegistry.get(creatorAddr),
          wager: wager.toString(),
          pendingJoiners: data.pendingJoiners?.length || 0,
        }, 'Game created by coordinator command');

        // Track this match
        const matchCreatorName = agentNameRegistry.get(creatorAddr) || 'Unknown';
        const matchJoinerNames = (data.pendingJoiners || []).map((j: { address: string }) =>
          agentNameRegistry.get(j.address.toLowerCase()) || 'Unknown'
        );
        matches.set(gameId, {
          gameId,
          players: [data.creator, ...(data.pendingJoiners || []).map((j: { address: string }) => j.address)],
          playerNames: [matchCreatorName, ...matchJoinerNames],
          wagerAmount: wager,
          status: 'active',
          minPlayers: 3,
          maxPlayers: 4,
          createdAt: Date.now(),
        });

        // Tell pending joiners to join this game
        if (data.pendingJoiners && data.pendingJoiners.length > 0) {
          for (const joinerInfo of data.pendingJoiners) {
            const joinerAgent = connectedAgents.get(joinerInfo.address);
            if (joinerAgent && joinerAgent.socket) {
              try {
                joinerAgent.socket.send(JSON.stringify({
                  type: 'join_game_command',
                  gameId,
                  wagerAmount: wager.toString(),
                  creatorAddress: data.creator,
                  creatorName: agentNameRegistry.get(creatorAddr) || 'Unknown',
                }));
                logger.info({
                  agent: joinerAgent.name,
                  gameId,
                }, 'Sent join_game_command');
              } catch (error) {
                logger.error({ error, agent: joinerAgent.name }, 'Failed to send join command');
              }
            }
          }
        }

        // Notify frontends
        broadcastToAllFrontends({
          type: 'match_created',
          gameId,
          creator: data.creator,
          creatorName: agentNameRegistry.get(creatorAddr) || 'Unknown',
          wagerAmount: wager.toString(),
        });
        break;

      case 'game_finished':
        // Agent finished a game - mark as available
        const finishedAgent = connectedAgents.get(data.address);
        if (finishedAgent) {
          finishedAgent.inGame = false;
          logger.info({ agent: finishedAgent.name, won: data.won }, 'Agent finished game');

          // Clean up match if this game exists
          if (data.gameId && matches.has(data.gameId)) {
            matches.delete(data.gameId);
            broadcastToAllFrontends({ type: 'game_ended', gameId: data.gameId });
          }

          // Auto-queue agent again if they want to continue playing
          if (data.autoRequeue && data.balance && data.maxWager) {
            setTimeout(() => {
              // Small delay before requeuing
              const agent = connectedAgents.get(data.address);
              if (agent && !agent.inGame) {
                addToMatchmakingQueue(agent, BigInt(data.balance), BigInt(data.maxWager));
              }
            }, 2000);
          }
        }
        break;

      case 'ping':
        const agent = connectedAgents.get(data.address);
        if (agent) {
          agent.lastPing = Date.now();
        }
        socket.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'match_created':
        const creatorAddress = data.player.toLowerCase();
        const creatorName = agentNameRegistry.get(creatorAddress) || 'Unknown';

        matches.set(data.gameId, {
          gameId: data.gameId,
          players: [data.player],
          playerNames: [creatorName],
          wagerAmount: BigInt(data.wagerAmount),
          status: 'pending',
          minPlayers: data.minPlayers || 2,
          maxPlayers: data.maxPlayers || 4,
          createdAt: Date.now(),
        });

        broadcast({ type: 'new_match', match: { ...data, creatorName } });

        // Notify frontends
        broadcastToAllFrontends({
          type: 'game_created',
          gameId: data.gameId,
          player: data.player,
          playerName: creatorName,
          wagerAmount: data.wagerAmount,
          minPlayers: data.minPlayers || 2,
          maxPlayers: data.maxPlayers || 4,
        });
        break;

      case 'match_joined':
        const match = matches.get(data.gameId);
        if (match) {
          const joinerAddress = data.player.toLowerCase();
          const joinerName = agentNameRegistry.get(joinerAddress) || 'Unknown';

          match.players.push(data.player);
          match.playerNames.push(joinerName);

          // Check if game should start
          if (match.players.length >= match.maxPlayers) {
            match.status = 'active';
          }

          broadcast({
            type: 'match_started',
            gameId: data.gameId,
            players: match.players,
            playerNames: match.playerNames,
          });

          // Notify frontends watching this game
          broadcastToFrontends(data.gameId, {
            type: 'player_joined',
            gameId: data.gameId,
            player: data.player,
            playerName: joinerName,
            playerCount: match.players.length,
            players: match.players,
            playerNames: match.playerNames,
          });

          if (match.status === 'active') {
            broadcastToFrontends(data.gameId, {
              type: 'game_started',
              gameId: data.gameId,
              players: match.players,
              playerNames: match.playerNames,
            });
          }
        }
        break;

      case 'match_complete':
        const completedMatch = matches.get(data.gameId);
        if (completedMatch) {
          completedMatch.status = 'complete';

          const winnerAddress = data.winner?.toLowerCase();
          const winnerName = winnerAddress ? agentNameRegistry.get(winnerAddress) : undefined;

          broadcast({ type: 'match_ended', ...data, winnerName });

          // Notify frontends watching this game
          broadcastToFrontends(data.gameId, {
            type: 'game_ended',
            gameId: data.gameId,
            winner: data.winner,
            winnerName: winnerName || 'Unknown',
            reason: data.reason,
          });
        }
        break;

      // Frontend subscribes to a specific game
      case 'frontend_subscribe':
        if (clientType === 'frontend' && clientId) {
          const frontend = connectedFrontends.get(clientId);
          if (frontend) {
            frontend.subscribedGames.add(data.gameId);
            logger.info({ clientId, gameId: data.gameId }, 'Frontend subscribed to game');

            // Send current game state if available
            const gameMatch = matches.get(data.gameId);
            socket.send(
              JSON.stringify({
                type: 'subscribed',
                gameId: data.gameId,
                match: gameMatch ? {
                  ...gameMatch,
                  wagerAmount: gameMatch.wagerAmount.toString(),
                } : null,
              })
            );
          }
        }
        break;

      // Frontend unsubscribes from a game
      case 'frontend_unsubscribe':
        if (clientType === 'frontend' && clientId) {
          const frontend = connectedFrontends.get(clientId);
          if (frontend) {
            frontend.subscribedGames.delete(data.gameId);
            logger.info({ clientId, gameId: data.gameId }, 'Frontend unsubscribed from game');
          }
        }
        break;

      // Agent sends thought/reasoning to relay to frontends
      case 'agent_thought':
        const thoughtAgentAddress = data.agentAddress?.toLowerCase();
        const thoughtAgentName = data.agentName || agentNameRegistry.get(thoughtAgentAddress) || 'Agent';

        logger.debug(
          { gameId: data.gameId, agent: thoughtAgentName, action: data.action },
          'Relaying agent thought'
        );

        broadcastToFrontends(data.gameId, {
          type: 'agent_thought',
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
          type: 'agent_action',
          gameId: data.gameId,
          agentName: thoughtAgentName,
          action: data.action,
        });
        break;

      default:
        logger.warn({ type: data.type }, 'Unknown message type');
    }
  }

  // Start server
  const port = parseInt(process.env.PORT || '8080');
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    logger.info(`Coordinator running on ${host}:${port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
