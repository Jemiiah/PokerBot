import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { pino } from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

interface Match {
  gameId: string;
  player1: string;
  player2: string | null;
  wagerAmount: bigint;
  status: 'pending' | 'active' | 'complete';
  createdAt: number;
}

interface ConnectedAgent {
  address: string;
  socket: any;
  lastPing: number;
}

interface ConnectedFrontend {
  socket: any;
  subscribedGames: Set<string>;
  connectedAt: number;
}

const matches = new Map<string, Match>();
const connectedAgents = new Map<string, ConnectedAgent>();
const connectedFrontends = new Map<string, ConnectedFrontend>();

// Generate unique ID for frontends
let frontendIdCounter = 0;
function generateFrontendId(): string {
  return `frontend-${Date.now()}-${++frontendIdCounter}`;
}

async function start() {
  const fastify = Fastify({ logger: true });

  await fastify.register(websocket);

  // REST endpoints
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      matches: matches.size,
      agents: connectedAgents.size,
      frontends: connectedFrontends.size,
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
            connectedAgents.delete(address);
            logger.info({ address }, 'Agent disconnected');
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
        connectedAgents.set(data.address, {
          address: data.address,
          socket,
          lastPing: Date.now(),
        });
        logger.info({ address: data.address }, 'Agent registered');
        socket.send(JSON.stringify({ type: 'registered', success: true }));
        break;

      case 'ping':
        const agent = connectedAgents.get(data.address);
        if (agent) {
          agent.lastPing = Date.now();
        }
        socket.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'match_created':
        matches.set(data.gameId, {
          gameId: data.gameId,
          player1: data.player,
          player2: null,
          wagerAmount: BigInt(data.wagerAmount),
          status: 'pending',
          createdAt: Date.now(),
        });
        broadcast({ type: 'new_match', match: data });
        // Also notify frontends
        broadcastToAllFrontends({
          type: 'game_created',
          gameId: data.gameId,
          player: data.player,
          wagerAmount: data.wagerAmount,
        });
        break;

      case 'match_joined':
        const match = matches.get(data.gameId);
        if (match) {
          match.player2 = data.player;
          match.status = 'active';
          broadcast({ type: 'match_started', match: data });
          // Notify frontends watching this game
          broadcastToFrontends(data.gameId, {
            type: 'game_started',
            gameId: data.gameId,
            player1: match.player1,
            player2: data.player,
          });
        }
        break;

      case 'match_complete':
        const completedMatch = matches.get(data.gameId);
        if (completedMatch) {
          completedMatch.status = 'complete';
          broadcast({ type: 'match_ended', ...data });
          // Notify frontends watching this game
          broadcastToFrontends(data.gameId, {
            type: 'game_ended',
            gameId: data.gameId,
            winner: data.winner,
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
            socket.send(
              JSON.stringify({
                type: 'subscribed',
                gameId: data.gameId,
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
        logger.debug(
          { gameId: data.gameId, agent: data.agentAddress },
          'Relaying agent thought'
        );
        broadcastToFrontends(data.gameId, {
          type: 'agent_thought',
          gameId: data.gameId,
          agentAddress: data.agentAddress,
          action: data.action,
          amount: data.amount,
          reasoning: data.reasoning,
          confidence: data.confidence,
          equity: data.equity,
          potOdds: data.potOdds,
          timestamp: Date.now(),
        });
        break;

      default:
        logger.warn({ type: data.type }, 'Unknown message type');
    }
  }

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

  // Broadcast to frontends watching a specific game
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

  // Broadcast to all connected frontends (for game list updates)
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
