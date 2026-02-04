import { useGameStore } from '../stores/gameStore';
import type { AgentId, GamePhase, Card, Rank } from '../lib/constants';

// Flexible type to handle readonly contract state from wagmi
interface ContractPlayer {
  readonly wallet: `0x${string}`;
  readonly chips: bigint;
  readonly cardCommitment: `0x${string}`;
  readonly holeCards: readonly [number, number];
  readonly folded: boolean;
  readonly revealed: boolean;
  readonly currentBet: bigint;
}

interface ContractGameState {
  readonly gameId: `0x${string}`;
  readonly players: readonly [ContractPlayer, ContractPlayer];
  readonly pot: bigint;
  readonly currentBet: bigint;
  readonly dealerIndex: number;
  readonly phase: number;
  readonly communityCards: readonly [number, number, number, number, number];
  readonly communityCardCount: number;
  readonly lastActionTime: bigint;
  readonly timeoutDuration: bigint;
  readonly activePlayerIndex: number;
  readonly isActive: boolean;
}

// Agent registry - simple local implementation
// In a full implementation, this could be imported from a shared config
const AGENT_REGISTRY: Record<string, { id: string; name: string; color: string }> = {};

function getAgentInfo(address: string): { id: string; name: string; color: string } {
  const normalizedAddress = address.toLowerCase();

  // Check registry
  if (AGENT_REGISTRY[normalizedAddress]) {
    return AGENT_REGISTRY[normalizedAddress];
  }

  // Return default for unknown addresses
  return {
    id: `agent-${address.slice(0, 8)}`,
    name: `Agent ${address.slice(0, 6)}...${address.slice(-4)}`,
    color: '#6B7280',
  };
}

// Coordinator WebSocket URL
const COORDINATOR_WS_URL = import.meta.env.VITE_COORDINATOR_WS_URL || 'ws://localhost:8080/ws';

// Phase mapping from contract to frontend
const PHASE_MAP: Record<number, GamePhase> = {
  0: 'waiting',
  1: 'preflop',
  2: 'flop',
  3: 'turn',
  4: 'river',
  5: 'showdown',
};

// Action mapping from contract (for logging/debugging)
const _ACTION_MAP: Record<number, string> = {
  0: 'fold',
  1: 'check',
  2: 'call',
  3: 'raise',
};
void _ACTION_MAP; // Suppress unused variable warning

export interface AgentThoughtMessage {
  type: 'agent_thought';
  gameId: string;
  agentAddress: string;
  action: string;
  amount?: string;
  reasoning: string;
  confidence?: number;
  equity?: number;
  potOdds?: number;
  timestamp: number;
}

export type CoordinatorMessage =
  | { type: 'frontend_connected'; clientId: string }
  | { type: 'subscribed'; gameId: string }
  | { type: 'game_created'; gameId: string; player: string; wagerAmount: string }
  | { type: 'game_started'; gameId: string; player1: string; player2: string }
  | { type: 'game_ended'; gameId: string; winner: string; reason?: string }
  | AgentThoughtMessage;

// Map agent addresses to store AgentIds
const addressToAgentId = new Map<string, AgentId>();

function getOrCreateAgentId(address: string): AgentId {
  const normalizedAddress = address.toLowerCase();

  // Check cache
  let agentId = addressToAgentId.get(normalizedAddress);
  if (agentId) return agentId;

  // Look up in registry
  const agentInfo = getAgentInfo(address);
  agentId = agentInfo.id as AgentId;

  // For unknown agents, map to available slots
  const validIds: AgentId[] = ['claude', 'chatgpt', 'grok', 'deepseek'];
  if (!validIds.includes(agentId)) {
    // Assign to next available slot
    const usedIds = new Set(addressToAgentId.values());
    for (const id of validIds) {
      if (!usedIds.has(id)) {
        agentId = id;
        break;
      }
    }
  }

  addressToAgentId.set(normalizedAddress, agentId);
  return agentId;
}

class RealGameService {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private currentGameId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting: boolean = false;
  private messageHandlers: Set<(message: CoordinatorMessage) => void> = new Set();

  /**
   * Connect to coordinator WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Connection timeout'));
        }, 5000);
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(COORDINATOR_WS_URL);

        this.ws.onopen = () => {
          console.log('[RealGameService] Connected to coordinator');
          this.isConnecting = false;
          // Identify as frontend client
          this.ws?.send(JSON.stringify({ type: 'frontend_connect' }));
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as CoordinatorMessage;
            this.handleMessage(message);

            if (message.type === 'frontend_connected') {
              this.clientId = message.clientId;
              console.log('[RealGameService] Registered as:', this.clientId);
              resolve();
            }
          } catch (error) {
            console.error('[RealGameService] Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('[RealGameService] Disconnected from coordinator');
          this.ws = null;
          this.clientId = null;
          this.isConnecting = false;

          // Auto-reconnect if we had an active game
          if (this.currentGameId) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[RealGameService] WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      console.log('[RealGameService] Attempting reconnect...');

      try {
        await this.connect();
        if (this.currentGameId) {
          await this.watchGame(this.currentGameId);
        }
      } catch (error) {
        console.error('[RealGameService] Reconnect failed:', error);
        this.scheduleReconnect();
      }
    }, 3000);
  }

  /**
   * Subscribe to updates for a specific game
   */
  async watchGame(gameId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    // Unsubscribe from previous game
    if (this.currentGameId && this.currentGameId !== gameId) {
      this.ws?.send(JSON.stringify({
        type: 'frontend_unsubscribe',
        gameId: this.currentGameId,
      }));
    }

    this.currentGameId = gameId;
    this.ws?.send(JSON.stringify({
      type: 'frontend_subscribe',
      gameId,
    }));

    console.log('[RealGameService] Watching game:', gameId);
  }

  /**
   * Stop watching the current game
   */
  unwatchGame(): void {
    if (this.currentGameId && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'frontend_unsubscribe',
        gameId: this.currentGameId,
      }));
    }
    this.currentGameId = null;
  }

  /**
   * Disconnect from coordinator
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.unwatchGame();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.clientId = null;
    addressToAgentId.clear();
  }

  /**
   * Handle incoming messages from coordinator
   */
  private handleMessage(message: CoordinatorMessage): void {
    // Notify all handlers
    this.messageHandlers.forEach(handler => handler(message));

    const store = useGameStore.getState();

    switch (message.type) {
      case 'agent_thought':
        this.handleThoughtUpdate(message);
        break;

      case 'game_started':
        store.addEvent({
          type: 'system',
          message: 'Game started! Both players connected.',
        });
        break;

      case 'game_ended':
        store.addEvent({
          type: 'system',
          message: `Game ended. Winner: ${message.winner.slice(0, 8)}...`,
        });
        break;
    }
  }

  /**
   * Handle agent thought update from coordinator
   */
  private handleThoughtUpdate(data: AgentThoughtMessage): void {
    const store = useGameStore.getState();
    const agentId = getOrCreateAgentId(data.agentAddress);

    // Map confidence number to level
    let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
    if (data.confidence !== undefined) {
      if (data.confidence < 0.4) confidenceLevel = 'low';
      else if (data.confidence > 0.7) confidenceLevel = 'high';
    }

    // Build analysis string with equity and pot odds if available
    let analysis = data.reasoning;
    if (data.equity !== undefined || data.potOdds !== undefined) {
      const parts: string[] = [];
      if (data.equity !== undefined) {
        parts.push(`Equity: ${(data.equity * 100).toFixed(1)}%`);
      }
      if (data.potOdds !== undefined) {
        parts.push(`Pot odds: ${(data.potOdds * 100).toFixed(1)}%`);
      }
      analysis = `${parts.join(' | ')}\n${data.reasoning}`;
    }

    // Update agent thought in store
    store.updateAgent(agentId, {
      currentThought: {
        text: `${data.action}${data.amount ? ` ${data.amount}` : ''}`,
        analysis,
        confidence: confidenceLevel,
        emoji: getActionEmoji(data.action),
      },
    });

    // Add to event feed
    store.addEvent({
      type: 'thought',
      agentId,
      message: `${agentId} thinking: ${data.reasoning.slice(0, 50)}...`,
      details: data.reasoning,
    });
  }

  /**
   * Sync contract state to game store
   * Called when contract state updates from useGameState hook
   */
  syncContractState(
    _gameId: string,
    contractState: ContractGameState,
    _players: Map<string, AgentId>
  ): void {
    const store = useGameStore.getState();

    // Update phase
    const phase = PHASE_MAP[contractState.phase] || 'waiting';
    if (store.phase !== phase) {
      store.setPhase(phase);
    }

    // Update pot
    if (BigInt(store.pot) !== contractState.pot) {
      // Pot is updated through actions, but we can verify it matches
    }

    // Update community cards
    if (contractState.communityCardCount > 0) {
      const newCards = [];
      for (let i = store.communityCards.length; i < contractState.communityCardCount; i++) {
        newCards.push(indexToCard(contractState.communityCards[i]));
      }
      if (newCards.length > 0) {
        store.addCommunityCards(newCards);
      }
    }

    // Update active player
    const activePlayer = contractState.players[contractState.activePlayerIndex];
    if (activePlayer.wallet !== '0x0000000000000000000000000000000000000000') {
      const agentId = getOrCreateAgentId(activePlayer.wallet);
      store.setActiveAgent(agentId);
    }

    // Update player states
    for (let i = 0; i < 2; i++) {
      const player = contractState.players[i];
      if (player.wallet === '0x0000000000000000000000000000000000000000') continue;

      const agentId = getOrCreateAgentId(player.wallet);

      store.updateAgent(agentId, {
        chips: Number(player.chips),
        currentBet: Number(player.currentBet),
        folded: player.folded,
      });

      // If cards are revealed at showdown
      if (player.revealed && player.holeCards[0] !== 0) {
        store.dealHoleCards(agentId, [
          indexToCard(player.holeCards[0]),
          indexToCard(player.holeCards[1]),
        ]);
      }
    }
  }

  /**
   * Handle contract action event
   */
  handleContractAction(
    player: `0x${string}`,
    action: number,
    amount: bigint
  ): void {
    const store = useGameStore.getState();
    const agentId = getOrCreateAgentId(player);

    if (action === 0) {
      // Fold
      store.fold(agentId);
    } else if (action === 2 || action === 3) {
      // Call or Raise
      store.placeBet(agentId, Number(amount));
    } else {
      // Check
      store.updateAgent(agentId, { lastAction: 'check' });
      store.addEvent({
        type: 'action',
        agentId,
        message: `${agentId} checks`,
      });
    }
  }

  /**
   * Handle contract phase change event
   */
  handlePhaseChange(newPhase: number): void {
    const store = useGameStore.getState();
    const phase = PHASE_MAP[newPhase] || 'waiting';
    store.setPhase(phase);
  }

  /**
   * Handle game end event
   */
  handleGameEnd(winner: `0x${string}`, pot: bigint): void {
    const store = useGameStore.getState();
    const winnerId = getOrCreateAgentId(winner);
    store.endHand(winnerId, `Won ${Number(pot)} chips`);
  }

  /**
   * Add a message handler
   */
  onMessage(handler: (message: CoordinatorMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current watched game
   */
  getCurrentGameId(): string | null {
    return this.currentGameId;
  }
}

// Helper to convert card index to Card type
function indexToCard(index: number): Card {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

  return {
    suit: suits[Math.floor(index / 13)],
    rank: ranks[index % 13],
  };
}

// Helper to get emoji for action
function getActionEmoji(action: string): string {
  switch (action.toLowerCase()) {
    case 'fold': return '🏳️';
    case 'check': return '✓';
    case 'call': return '📞';
    case 'raise': return '⬆️';
    case 'all_in': return '🔥';
    default: return '🤔';
  }
}

// Singleton instance
export const realGameService = new RealGameService();
