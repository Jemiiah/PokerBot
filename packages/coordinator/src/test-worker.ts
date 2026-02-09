/**
 * Test Worker - Simulates an external agent connecting via WebSocket API
 * Usage: npx tsx src/test-worker.ts [--register]
 *
 * --register: Register a new agent first (otherwise uses existing API key from env)
 */

import WebSocket from 'ws';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const WS_URL = process.env.WS_URL || 'ws://localhost:8080/ws';

interface GameState {
  gameId: string;
  pot: string;
  phase: string;
  communityCards: string[];
  holeCards: string[];
  validActions: Array<{ action: string; minAmount?: string; maxAmount?: string }>;
}

class TestWorker {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private walletAddress: string;
  private agentName: string;
  private connected = false;
  private authenticated = false;
  private inQueue = false;
  private currentGameId: string | null = null;

  constructor(apiKey: string, walletAddress: string, agentName: string) {
    this.apiKey = apiKey;
    this.walletAddress = walletAddress;
    this.agentName = agentName;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[${this.agentName}] Connecting to ${WS_URL}...`);
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log(`[${this.agentName}] Connected, authenticating...`);
        this.connected = true;
        this.authenticate();
      });

      this.ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
        if (msg.type === 'api_authenticated') {
          resolve();
        }
      });

      this.ws.on('error', (err) => {
        console.error(`[${this.agentName}] WebSocket error:`, err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log(`[${this.agentName}] Disconnected`);
        this.connected = false;
        this.authenticated = false;
      });

      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
  }

  private authenticate(): void {
    this.send({ type: 'api_auth', apiKey: this.apiKey });
  }

  private send(data: object): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(msg: any): void {
    console.log(`[${this.agentName}] Received: ${msg.type}`);

    switch (msg.type) {
      case 'api_authenticated':
        console.log(`[${this.agentName}] Authenticated as ${msg.agentName}`);
        this.authenticated = true;
        break;

      case 'error':
        console.error(`[${this.agentName}] Error: ${msg.code} - ${msg.message}`);
        break;

      case 'queue_update':
        console.log(`[${this.agentName}] Queue position: ${msg.position}/${msg.queueSize}`);
        break;

      case 'game_state':
        console.log(`[${this.agentName}] Game state update:`, {
          gameId: msg.gameId,
          phase: msg.phase,
          pot: msg.pot,
          communityCards: msg.communityCards,
        });
        this.currentGameId = msg.gameId;
        break;

      case 'your_turn':
        console.log(`[${this.agentName}] MY TURN!`, {
          gameId: msg.gameId,
          phase: msg.phase,
          pot: msg.pot,
          holeCards: msg.holeCards,
          communityCards: msg.communityCards,
          validActions: msg.validActions,
          timeoutMs: msg.timeoutMs,
        });
        this.currentGameId = msg.gameId;
        // Simulate decision making
        this.makeDecision(msg);
        break;

      case 'game_result':
        console.log(`[${this.agentName}] Game finished:`, {
          gameId: msg.gameId,
          result: msg.yourResult,
          winner: msg.winnerName,
          pot: msg.pot,
        });
        this.currentGameId = null;
        break;

      default:
        console.log(`[${this.agentName}] Unknown message:`, msg);
    }
  }

  private async makeDecision(gameState: GameState): Promise<void> {
    // Simple strategy: check/call if possible, otherwise fold
    const validActions = gameState.validActions || [];
    let chosenAction = 'fold';

    if (validActions.some(a => a.action === 'check')) {
      chosenAction = 'check';
    } else if (validActions.some(a => a.action === 'call')) {
      chosenAction = 'call';
    }

    console.log(`[${this.agentName}] Deciding: ${chosenAction}`);

    // In a real scenario, the agent would:
    // 1. Submit on-chain transaction
    // 2. Get txHash
    // 3. Notify coordinator via REST API

    // For testing, we'll just simulate the notification
    const fakeTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

    try {
      const response = await fetch(`${BASE_URL}/api/games/${gameState.gameId}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: chosenAction,
          txHash: fakeTxHash,
        }),
      });

      const result = await response.json();
      console.log(`[${this.agentName}] Action result:`, result);
    } catch (error) {
      console.error(`[${this.agentName}] Failed to submit action:`, error);
    }
  }

  async joinQueue(maxWager = '10000000000000000'): Promise<void> {
    console.log(`[${this.agentName}] Joining queue...`);

    const response = await fetch(`${BASE_URL}/api/queue/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ maxWager }),
    });

    const result = await response.json();
    console.log(`[${this.agentName}] Join queue result:`, result);

    if (result.position) {
      this.inQueue = true;
    }
  }

  async leaveQueue(): Promise<void> {
    console.log(`[${this.agentName}] Leaving queue...`);

    const response = await fetch(`${BASE_URL}/api/queue/leave`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    const result = await response.json();
    console.log(`[${this.agentName}] Leave queue result:`, result);
    this.inQueue = false;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Register a new agent
async function registerAgent(walletAddress: string, agentName: string): Promise<{ apiKey: string; walletAddress: string; agentName: string }> {
  console.log(`Registering agent ${agentName}...`);

  const response = await fetch(`${BASE_URL}/api/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, agentName }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(`Registration failed: ${result.error}`);
  }

  console.log(`Registered: API Key = ${result.apiKey}`);
  return result;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const shouldRegister = args.includes('--register');
  const numWorkers = parseInt(args.find(a => a.startsWith('--workers='))?.split('=')[1] || '1');

  console.log('=== Test Worker System ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  console.log(`Workers: ${numWorkers}`);
  console.log('');

  const workers: TestWorker[] = [];

  for (let i = 0; i < numWorkers; i++) {
    const walletAddress = `0x${(i + 1).toString().padStart(40, '0')}`;
    const agentName = `TestBot${i + 1}`;

    let apiKey: string;

    if (shouldRegister) {
      try {
        const result = await registerAgent(walletAddress, agentName);
        apiKey = result.apiKey;
      } catch (error: any) {
        console.error(`Failed to register ${agentName}:`, error.message);
        continue;
      }
    } else {
      // Use environment variable or generate a placeholder
      apiKey = process.env[`API_KEY_${i + 1}`] || '';
      if (!apiKey) {
        console.error(`No API key for worker ${i + 1}. Use --register or set API_KEY_${i + 1}`);
        continue;
      }
    }

    const worker = new TestWorker(apiKey, walletAddress, agentName);
    workers.push(worker);

    try {
      await worker.connect();
      await worker.joinQueue();
    } catch (error: any) {
      console.error(`Worker ${agentName} failed:`, error.message);
    }
  }

  console.log(`\n${workers.length} workers connected and queued.`);
  console.log('Press Ctrl+C to stop...\n');

  // Keep running
  process.on('SIGINT', () => {
    console.log('\nShutting down workers...');
    workers.forEach(w => w.disconnect());
    process.exit(0);
  });
}

main().catch(console.error);
