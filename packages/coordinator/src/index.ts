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

const matches = new Map<string, Match>();
const connectedAgents = new Map<string, ConnectedAgent>();

async function start() {
  const fastify = Fastify({ logger: true });

  await fastify.register(websocket);

  // REST endpoints
  fastify.get('/health', async () => {
    return { status: 'ok', matches: matches.size, agents: connectedAgents.size };
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

  // WebSocket for real-time updates
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, _req) => {
      const socket = connection.socket;

      logger.info('New WebSocket connection');

      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          handleMessage(socket, data);
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
      });
    });
  });

  function handleMessage(socket: any, data: any) {
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
        break;

      case 'match_joined':
        const match = matches.get(data.gameId);
        if (match) {
          match.player2 = data.player;
          match.status = 'active';
          broadcast({ type: 'match_started', match: data });
        }
        break;

      case 'match_complete':
        const completedMatch = matches.get(data.gameId);
        if (completedMatch) {
          completedMatch.status = 'complete';
          broadcast({ type: 'match_ended', ...data });
        }
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
