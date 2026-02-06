import { useGameStore } from '../stores/gameStore';
import { AI_AGENTS, type AgentId, type GamePhase, type Card, type Rank } from '../lib/constants';

// Flexible type to handle readonly contract state from wagmi
interface ContractPlayerBase {
  readonly wallet: `0x${string}`;
  readonly chips: bigint;
  readonly cardCommitment: `0x${string}`;
  readonly holeCards: readonly [number, number];
  readonly folded: boolean;
  readonly revealed: boolean;
  readonly currentBet: bigint;
}

interface ContractPlayer4Max extends ContractPlayerBase {
  readonly isAllIn?: boolean;
}

// Flexible interface to handle both 2-player and 4-player contracts
interface ContractGameState {
  readonly gameId: `0x${string}`;
  // Can be 2 or 4 players depending on contract
  readonly players: readonly ContractPlayer4Max[];
  // 4Max contract fields (optional for 2-player contract)
  readonly playerCount?: number;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
  readonly mainPot?: bigint;
  readonly smallBlindIndex?: number;
  readonly bigBlindIndex?: number;
  readonly lastRaiserIndex?: number;
  readonly actionsThisRound?: number;
  // Common fields
  readonly currentBet: bigint;
  readonly dealerIndex: number;
  readonly phase: number;
  readonly communityCards: readonly [number, number, number, number, number];
  readonly communityCardCount: number;
  readonly lastActionTime: bigint;
  readonly timeoutDuration: bigint;
  readonly activePlayerIndex: number;
  readonly isActive: boolean;
  // Legacy 2-player contract
  readonly pot?: bigint;
}

// Agent name to ID mapping - maps agent personality names to frontend AgentIds
const AGENT_NAME_TO_ID: Record<string, AgentId> = {
  'blaze': 'blaze',
  'frost': 'frost',
  'shadow': 'shadow',
  'storm': 'storm',
  'sage': 'sage',
  'ember': 'ember',
  'viper': 'viper',
  'titan': 'titan',
  'claude': 'claude',
  'chatgpt': 'chatgpt',
  'grok': 'grok',
  'deepseek': 'deepseek',
};

// Agent registry - maps addresses to agent info (populated at runtime)
const AGENT_REGISTRY: Record<string, { id: AgentId; name: string; color: string }> = {};

/**
 * Register an agent address with its name (called when coordinator sends agent info)
 */
export function registerAgentAddress(address: string, name: string): void {
  const normalizedAddress = address.toLowerCase();
  const normalizedName = name.toLowerCase();
  const agentId = AGENT_NAME_TO_ID[normalizedName] || 'blaze' as AgentId;

  // Get color from AI_AGENTS constant
  const agentInfo = AI_AGENTS[agentId];

  AGENT_REGISTRY[normalizedAddress] = {
    id: agentId,
    name: agentInfo?.name || name,
    color: agentInfo?.color || '#6B7280',
  };
}

function getAgentInfo(address: string): { id: AgentId; name: string; color: string } {
  const normalizedAddress = address.toLowerCase();

  // Check registry
  if (AGENT_REGISTRY[normalizedAddress]) {
    return AGENT_REGISTRY[normalizedAddress];
  }

  // Return default for unknown addresses
  return {
    id: 'blaze' as AgentId, // Default to blaze
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
  agentName?: string;
  action: string;
  amount?: string;
  reasoning: string;
  confidence?: number;
  equity?: number;
  potOdds?: number;
  holeCards?: string; // Format: "Ah Kd" (rank + suit initial)
  timestamp: number;
}

// Matchmaking queue types
export interface QueuedAgentInfo {
  address: string;
  name: string;
}

export interface MatchmakingState {
  queueSize: number;
  queuedAgents: QueuedAgentInfo[];
  isMatchmaking: boolean;
  matchPlayers?: QueuedAgentInfo[];
}

// Game tracking types
export interface GameInfo {
  gameId: string;
  status: 'creating' | 'waiting' | 'starting' | 'active' | 'complete';
  creator?: { address: string; name: string };
  players: { address: string; name: string }[];
  wagerAmount?: string;
  createdAt: number;
  startedAt?: number;
  winner?: { address: string; name: string };
}

export type CoordinatorMessage =
  | { type: 'frontend_connected'; clientId: string }
  | { type: 'subscribed'; gameId: string; match?: { players: string[]; playerNames: string[] } }
  | { type: 'game_created'; gameId: string; player: string; playerName?: string; wagerAmount: string }
  | { type: 'game_started'; gameId: string; players: string[]; playerNames: string[] }
  | { type: 'player_joined'; gameId: string; player: string; playerName: string; players: string[]; playerNames: string[] }
  | { type: 'game_ended'; gameId: string; winner: string; winnerName?: string; reason?: string }
  | { type: 'agent_connected'; address: string; name: string }
  | { type: 'agent_disconnected'; address: string; name: string }
  | { type: 'agent_queued'; address: string; name: string; queueSize: number; queuedAgents: QueuedAgentInfo[] }
  | { type: 'agent_dequeued'; address: string; name: string; queueSize: number; queuedAgents: QueuedAgentInfo[] }
  | { type: 'matchmaking_started'; creator: string; creatorName: string; players: QueuedAgentInfo[]; wagerAmount: string }
  | { type: 'match_created'; gameId: string; creator: string; creatorName: string; wagerAmount: string }
  | AgentThoughtMessage;

// Map agent addresses to store AgentIds
const addressToAgentId = new Map<string, AgentId>();

function getOrCreateAgentId(address: string): AgentId {
  const normalizedAddress = address.toLowerCase();

  // Check cache
  let agentId = addressToAgentId.get(normalizedAddress);
  if (agentId) return agentId;

  // Look up in registry (populated when coordinator sends agent_connected messages)
  const agentInfo = getAgentInfo(address);
  agentId = agentInfo.id as AgentId;

  // Cache and return
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

  // Matchmaking state
  private matchmakingState: MatchmakingState = {
    queueSize: 0,
    queuedAgents: [],
    isMatchmaking: false,
  };
  private matchmakingHandlers: Set<(state: MatchmakingState) => void> = new Set();

  // Active games tracking
  private activeGames: Map<string, GameInfo> = new Map();
  private gameHandlers: Set<(games: GameInfo[]) => void> = new Set();

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
          // Silent disconnect - only log in development
          if (import.meta.env.DEV) {
            console.log('[RealGameService] Disconnected from coordinator');
          }
          this.ws = null;
          this.clientId = null;
          this.isConnecting = false;

          // Auto-reconnect if we had an active game
          if (this.currentGameId) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = () => {
          // Silent error - coordinator may not be running
          this.isConnecting = false;
          reject(new Error('Coordinator not available'));
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
        // Register agent if we have name info
        if (message.agentAddress && message.agentName) {
          registerAgentAddress(message.agentAddress, message.agentName);
        }
        this.handleThoughtUpdate(message);
        break;

      case 'agent_connected':
        // Register agent address to name mapping
        registerAgentAddress(message.address, message.name);
        break;

      case 'subscribed':
        // Register players from match info
        if (message.match?.players && message.match?.playerNames) {
          for (let i = 0; i < message.match.players.length; i++) {
            registerAgentAddress(message.match.players[i], message.match.playerNames[i]);
          }
        }
        break;

      case 'agent_disconnected':
        // Only add events if we're in live mode
        if (store.mode === 'live') {
          store.addEvent({
            type: 'system',
            message: `${message.name} disconnected.`,
          });
        }
        break;

      case 'agent_queued':
        this.updateMatchmakingState({
          queueSize: message.queueSize,
          queuedAgents: message.queuedAgents,
        });
        // Only add events if we're in live mode
        if (store.mode === 'live') {
          store.addEvent({
            type: 'system',
            message: `${message.name} joined the queue (${message.queueSize} waiting)`,
          });
        }
        break;

      case 'agent_dequeued':
        this.updateMatchmakingState({
          queueSize: message.queueSize,
          queuedAgents: message.queuedAgents,
        });
        break;

      case 'matchmaking_started':
        this.updateMatchmakingState({
          isMatchmaking: true,
          matchPlayers: message.players,
        });
        // Only add events if we're in live mode
        if (store.mode === 'live') {
          store.addEvent({
            type: 'system',
            message: `Match starting! ${message.players.map(p => p.name).join(' vs ')}`,
          });
        }
        break;

      case 'match_created':
        registerAgentAddress(message.creator, message.creatorName);
        // Track the new game
        this.updateGame(message.gameId, {
          status: 'waiting',
          creator: { address: message.creator, name: message.creatorName },
          players: [{ address: message.creator, name: message.creatorName }],
          wagerAmount: message.wagerAmount,
          createdAt: Date.now(),
        });
        // Only add events if we're in live mode
        if (store.mode === 'live') {
          store.addEvent({
            type: 'system',
            message: `${message.creatorName} created a game (${message.wagerAmount} wei)`,
          });
        }
        break;

      case 'game_created':
        registerAgentAddress(message.player, message.playerName || 'Unknown');
        // Track the new game
        this.updateGame(message.gameId, {
          status: 'waiting',
          creator: { address: message.player, name: message.playerName || 'Unknown' },
          players: [{ address: message.player, name: message.playerName || 'Unknown' }],
          wagerAmount: message.wagerAmount,
          createdAt: Date.now(),
        });
        // Only add events if we're in live mode
        if (store.mode === 'live') {
          store.addEvent({
            type: 'system',
            message: `${message.playerName || 'Agent'} created a room with ${message.wagerAmount} wei wager`,
          });
        }
        // Reset matchmaking state since game is being created
        this.updateMatchmakingState({ isMatchmaking: false });
        break;

      case 'player_joined':
        // Update game with new player
        const existingGame = this.activeGames.get(message.gameId);
        if (existingGame) {
          const updatedPlayers = [...existingGame.players];
          if (!updatedPlayers.find(p => p.address.toLowerCase() === message.player.toLowerCase())) {
            updatedPlayers.push({ address: message.player, name: message.playerName });
          }
          this.updateGame(message.gameId, {
            players: updatedPlayers,
          });
        }
        break;

      case 'game_started':
        // Register all players
        if ('players' in message && 'playerNames' in message) {
          for (let i = 0; i < message.players.length; i++) {
            registerAgentAddress(message.players[i], message.playerNames[i]);
          }
          // Update game status
          this.updateGame(message.gameId, {
            status: 'active',
            players: message.players.map((addr: string, i: number) => ({
              address: addr,
              name: message.playerNames[i],
            })),
            startedAt: Date.now(),
          });
        }
        // Only add events if we're in live mode
        if (store.mode === 'live') {
          store.addEvent({
            type: 'system',
            message: 'Game started! Players connected.',
          });
        }
        break;

      case 'game_ended':
        const winnerNameStr = message.winnerName || message.winner.slice(0, 8) + '...';
        // Update game status
        this.updateGame(message.gameId, {
          status: 'complete',
          winner: { address: message.winner, name: winnerNameStr },
        });
        // Only add events if we're in live mode
        if (store.mode === 'live') {
          store.addEvent({
            type: 'system',
            message: `Game ended. Winner: ${winnerNameStr}`,
          });
        }
        // Reset matchmaking state
        this.updateMatchmakingState({ isMatchmaking: false, matchPlayers: undefined });
        // Remove completed game after a delay
        setTimeout(() => this.removeGame(message.gameId), 10000);
        break;
    }
  }

  /**
   * Handle agent thought update from coordinator
   */
  private handleThoughtUpdate(data: AgentThoughtMessage): void {
    const store = useGameStore.getState();

    // Only update store if we're in live mode to prevent contaminating demo state
    if (store.mode !== 'live') {
      return;
    }

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

    // Parse and set hole cards if provided (for spectator display)
    if (data.holeCards) {
      const cards = parseHoleCardsString(data.holeCards);
      if (cards) {
        store.dealHoleCards(agentId, cards);
      }
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

    // Get display name from agent info or coordinator message
    const agentInfo = getAgentInfo(data.agentAddress);
    const displayName = data.agentName || agentInfo.name;

    // Add to event feed
    store.addEvent({
      type: 'thought',
      agentId,
      agentName: displayName,
      message: `${displayName} thinking: ${data.reasoning.slice(0, 50)}...`,
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

    // Only sync contract state if we're in live mode
    if (store.mode !== 'live') {
      return;
    }

    // Update phase
    const phase = PHASE_MAP[contractState.phase] || 'waiting';
    if (store.phase !== phase) {
      store.setPhase(phase);
    }

    // Update pot (use mainPot from 4Max contract)
    const pot = contractState.mainPot || contractState.pot || 0n;
    if (BigInt(store.pot) !== pot) {
      // Pot is updated through actions, but we can sync it
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

    // Update player states (support up to 4 players)
    const playerCount = contractState.playerCount ?? contractState.players.length;
    for (let i = 0; i < playerCount; i++) {
      const player = contractState.players[i];
      if (player.wallet === '0x0000000000000000000000000000000000000000') continue;

      const agentId = getOrCreateAgentId(player.wallet);

      store.updateAgent(agentId, {
        chips: Number(player.chips),
        currentBet: Number(player.currentBet),
        folded: player.folded,
        isActive: true,
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

    // Only handle contract actions if we're in live mode
    if (store.mode !== 'live') {
      return;
    }

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

    // Only handle phase changes if we're in live mode
    if (store.mode !== 'live') {
      return;
    }

    const phase = PHASE_MAP[newPhase] || 'waiting';
    store.setPhase(phase);
  }

  /**
   * Handle game end event
   */
  handleGameEnd(winner: `0x${string}`, pot: bigint): void {
    const store = useGameStore.getState();

    // Only handle game end if we're in live mode
    if (store.mode !== 'live') {
      return;
    }

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
   * Subscribe to matchmaking state updates
   */
  onMatchmakingUpdate(handler: (state: MatchmakingState) => void): () => void {
    this.matchmakingHandlers.add(handler);
    // Immediately call with current state
    handler(this.matchmakingState);
    return () => this.matchmakingHandlers.delete(handler);
  }

  /**
   * Get current matchmaking state
   */
  getMatchmakingState(): MatchmakingState {
    return { ...this.matchmakingState };
  }

  /**
   * Update matchmaking state and notify handlers
   */
  private updateMatchmakingState(updates: Partial<MatchmakingState>): void {
    this.matchmakingState = { ...this.matchmakingState, ...updates };
    this.matchmakingHandlers.forEach(handler => handler(this.matchmakingState));
  }

  /**
   * Subscribe to game list updates
   */
  onGameUpdate(handler: (games: GameInfo[]) => void): () => void {
    this.gameHandlers.add(handler);
    // Immediately call with current games
    handler(Array.from(this.activeGames.values()));
    return () => this.gameHandlers.delete(handler);
  }

  /**
   * Get current active games
   */
  getActiveGames(): GameInfo[] {
    return Array.from(this.activeGames.values());
  }

  /**
   * Update a game and notify handlers
   */
  private updateGame(gameId: string, updates: Partial<GameInfo>): void {
    const existing = this.activeGames.get(gameId);
    if (existing) {
      this.activeGames.set(gameId, { ...existing, ...updates });
    } else {
      this.activeGames.set(gameId, {
        gameId,
        status: 'creating',
        players: [],
        createdAt: Date.now(),
        ...updates,
      } as GameInfo);
    }
    this.notifyGameHandlers();
  }

  /**
   * Remove a game
   */
  private removeGame(gameId: string): void {
    this.activeGames.delete(gameId);
    this.notifyGameHandlers();
  }

  /**
   * Notify all game handlers
   */
  private notifyGameHandlers(): void {
    const games = Array.from(this.activeGames.values());
    this.gameHandlers.forEach(handler => handler(games));
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

// Helper to parse hole cards string like "Ah Kd" into Card tuple
function parseHoleCardsString(holeCardsStr: string): [Card, Card] | null {
  const suitMap: Record<string, Card['suit']> = {
    'h': 'hearts',
    'd': 'diamonds',
    'c': 'clubs',
    's': 'spades',
  };

  // Split by space and parse each card
  const parts = holeCardsStr.trim().split(/\s+/);
  if (parts.length !== 2) return null;

  const cards: Card[] = [];
  for (const part of parts) {
    if (part.length < 2) return null;

    // Handle both "Ah" format and "10h" format
    const suitChar = part[part.length - 1].toLowerCase();
    const rankStr = part.slice(0, -1).toUpperCase();

    const suit = suitMap[suitChar];
    if (!suit) return null;

    // Normalize rank (10 -> T)
    const rank = rankStr === '10' ? 'T' : rankStr;
    if (!['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].includes(rank)) {
      return null;
    }

    cards.push({ rank: rank as Rank, suit });
  }

  return [cards[0], cards[1]];
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
