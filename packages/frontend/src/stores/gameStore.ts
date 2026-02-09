import { create } from 'zustand';
import type { Card, AgentId, GamePhase } from '../lib/constants';
import { AI_AGENTS, STARTING_CHIPS, LIVE_AGENT_IDS, DEMO_AGENT_IDS } from '../lib/constants';

export interface AgentThought {
  text: string;
  analysis?: string;
  confidence?: 'low' | 'medium' | 'high';
  emoji?: string;
}

export interface AgentState {
  id: AgentId;
  chips: number;
  holeCards: [Card, Card] | null;
  currentBet: number;
  totalBet: number;
  folded: boolean;
  isAllIn: boolean;
  isActive: boolean;
  winProbability: number;
  lastAction: string | null;
  currentThought: AgentThought | null;
}

export interface GameEvent {
  id: string;
  timestamp: Date;
  type: 'action' | 'phase' | 'winner' | 'system' | 'thought' | 'big_pot' | 'all_in' | 'showdown';
  agentId?: AgentId;
  agentName?: string;
  message: string;
  details?: string;
}

export interface GameState {
  // Game status
  isRunning: boolean;
  isPaused: boolean;
  phase: GamePhase;
  handNumber: number;
  mode: 'demo' | 'live';

  // Agents - supports all 12 possible agents (8 live + 4 demo)
  agents: Partial<Record<AgentId, AgentState>>;
  activeAgentId: AgentId | null;
  dealerIndex: number;

  // Active players in current game (for live mode)
  activePlayers: AgentId[];

  // Table state
  pot: number;
  currentBet: number;
  communityCards: Card[];

  // Events feed
  events: GameEvent[];

  // Winner
  winnerId: AgentId | null;
  winningHand: string | null;

  // Turn timer state (for spectator experience)
  turnStartTime: number | null;
  turnDuration: number | null;
  turnAgentId: AgentId | null;

  // Game lifecycle timestamps
  gameStartedAt: number | null;
  gameCompletedAt: number | null;

  // Phase pause state
  phasePauseUntil: number | null;
}

interface GameStore extends GameState {
  // Actions
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  setMode: (mode: 'demo' | 'live') => void;

  // Game logic
  setPhase: (phase: GamePhase) => void;
  setActiveAgent: (agentId: AgentId | null) => void;
  updateAgent: (agentId: AgentId, updates: Partial<AgentState>) => void;
  dealHoleCards: (agentId: AgentId, cards: [Card, Card]) => void;
  addCommunityCards: (cards: Card[]) => void;
  setActivePlayers: (players: AgentId[]) => void;

  // Betting
  placeBet: (agentId: AgentId, amount: number) => void;
  fold: (agentId: AgentId) => void;
  collectPot: (winnerId: AgentId) => void;

  // Events
  addEvent: (event: Omit<GameEvent, 'id' | 'timestamp'>) => void;
  clearEvents: () => void;

  // End hand
  endHand: (winnerId: AgentId, winningHand?: string) => void;
  startNewHand: () => void;

  // Initialize agent (for live mode dynamic agents)
  initializeAgent: (agentId: AgentId, chips?: number) => void;

  // Turn timer actions
  setTurnTimer: (agentId: AgentId, startTime: number, duration: number) => void;
  clearTurnTimer: () => void;

  // Game lifecycle timestamps
  setGameTimestamps: (started?: number, completed?: number) => void;

  // Phase pause
  setPhasePause: (pauseUntil: number | null) => void;
}

const createInitialAgentState = (id: AgentId, chips = STARTING_CHIPS): AgentState => ({
  id,
  chips,
  holeCards: null,
  currentBet: 0,
  totalBet: 0,
  folded: false,
  isAllIn: false,
  isActive: true,
  winProbability: 25,
  lastAction: null,
  currentThought: null,
});

// Create initial agents for demo mode (4 demo agents)
const createDemoAgents = (): Partial<Record<AgentId, AgentState>> => {
  const agents: Partial<Record<AgentId, AgentState>> = {};
  for (const id of DEMO_AGENT_IDS) {
    agents[id] = createInitialAgentState(id);
  }
  return agents;
};

// Create initial agents for live mode (8 live agents)
const createLiveAgents = (): Partial<Record<AgentId, AgentState>> => {
  const agents: Partial<Record<AgentId, AgentState>> = {};
  for (const id of LIVE_AGENT_IDS) {
    agents[id] = createInitialAgentState(id);
  }
  return agents;
};

const initialState: GameState = {
  isRunning: false,
  isPaused: false,
  phase: 'waiting',
  handNumber: 0,
  mode: 'demo',
  agents: createDemoAgents(),
  activeAgentId: null,
  dealerIndex: 0,
  activePlayers: [],
  pot: 0,
  currentBet: 0,
  communityCards: [],
  events: [],
  winnerId: null,
  winningHand: null,
  // Turn timer
  turnStartTime: null,
  turnDuration: null,
  turnAgentId: null,
  // Game lifecycle
  gameStartedAt: null,
  gameCompletedAt: null,
  // Phase pause
  phasePauseUntil: null,
};

let eventCounter = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  startGame: () => {
    set({ isRunning: true, isPaused: false });
    get().addEvent({ type: 'system', message: 'Game started! AI agents are ready to play.' });
  },

  pauseGame: () => set({ isPaused: true }),
  resumeGame: () => set({ isPaused: false }),

  resetGame: () => {
    const mode = get().mode;
    set({
      ...initialState,
      mode,
      agents: mode === 'live' ? createLiveAgents() : createDemoAgents(),
    });
  },

  setMode: (mode) => {
    // Clear events when switching modes to prevent mixing demo/live data
    set({
      mode,
      agents: mode === 'live' ? createLiveAgents() : createDemoAgents(),
      activePlayers: [],
      events: [], // Clear events on mode switch
      pot: 0,
      currentBet: 0,
      communityCards: [],
      phase: 'waiting',
      isRunning: false,
      isPaused: false,
      winnerId: null,
      winningHand: null,
      // Reset timer state
      turnStartTime: null,
      turnDuration: null,
      turnAgentId: null,
      gameStartedAt: null,
      gameCompletedAt: null,
      phasePauseUntil: null,
    });
  },

  setPhase: (phase) => {
    set({ phase });
    const phaseNames: Record<GamePhase, string> = {
      waiting: 'Waiting',
      preflop: 'Pre-Flop',
      flop: 'Flop',
      turn: 'Turn',
      river: 'River',
      showdown: 'Showdown',
    };
    if (phase !== 'waiting') {
      get().addEvent({ type: 'phase', message: `${phaseNames[phase]} round begins` });
    }
  },

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  updateAgent: (agentId, updates) => {
    const state = get();
    const existingAgent = state.agents[agentId];

    if (!existingAgent) {
      // Auto-initialize agent if it doesn't exist
      const newAgent = createInitialAgentState(agentId);
      set({
        agents: {
          ...state.agents,
          [agentId]: { ...newAgent, ...updates },
        },
      });
    } else {
      set({
        agents: {
          ...state.agents,
          [agentId]: { ...existingAgent, ...updates },
        },
      });
    }
  },

  dealHoleCards: (agentId, cards) => {
    get().updateAgent(agentId, { holeCards: cards, folded: false, currentBet: 0, totalBet: 0 });
  },

  addCommunityCards: (cards) => {
    set((state) => ({
      communityCards: [...state.communityCards, ...cards],
    }));
  },

  setActivePlayers: (players) => {
    set({ activePlayers: players });
    // Ensure all active players have agent state
    for (const playerId of players) {
      const state = get();
      if (!state.agents[playerId]) {
        get().initializeAgent(playerId);
      }
    }
  },

  placeBet: (agentId, amount) => {
    const state = get();
    const agent = state.agents[agentId];
    if (!agent) return;

    const actualBet = Math.min(amount, agent.chips);
    const isAllIn = actualBet >= agent.chips;
    const actionName = isAllIn ? 'all in' : amount > state.currentBet - agent.currentBet ? 'raise' : 'call';

    set((s) => ({
      pot: s.pot + actualBet,
      currentBet: Math.max(s.currentBet, agent.currentBet + actualBet),
      agents: {
        ...s.agents,
        [agentId]: {
          ...agent,
          chips: agent.chips - actualBet,
          currentBet: agent.currentBet + actualBet,
          totalBet: agent.totalBet + actualBet,
          isAllIn,
          lastAction: actionName,
        },
      },
    }));

    const agentInfo = AI_AGENTS[agentId];
    get().addEvent({
      type: 'action',
      agentId,
      agentName: agentInfo?.name || agentId,
      message: `${agentInfo?.name || agentId} ${actionName}s ${actualBet} chips`,
    });
  },

  fold: (agentId) => {
    get().updateAgent(agentId, { folded: true, lastAction: 'fold' });
    const agentInfo = AI_AGENTS[agentId];
    get().addEvent({
      type: 'action',
      agentId,
      agentName: agentInfo?.name || agentId,
      message: `${agentInfo?.name || agentId} folds`,
    });
  },

  collectPot: (winnerId) => {
    const { pot, agents } = get();
    const winner = agents[winnerId];
    if (!winner) return;

    set((state) => ({
      pot: 0,
      agents: {
        ...state.agents,
        [winnerId]: {
          ...winner,
          chips: winner.chips + pot,
        },
      },
    }));
  },

  addEvent: (event) => {
    const newEvent: GameEvent = {
      ...event,
      id: `event-${++eventCounter}`,
      timestamp: new Date(),
    };
    set((state) => ({
      events: [newEvent, ...state.events].slice(0, 50), // Keep last 50 events
    }));
  },

  clearEvents: () => set({ events: [] }),

  endHand: (winnerId, winningHand) => {
    get().collectPot(winnerId);
    set({ winnerId, winningHand, phase: 'showdown' });
    const agentInfo = AI_AGENTS[winnerId];
    get().addEvent({
      type: 'winner',
      agentId: winnerId,
      agentName: agentInfo?.name || winnerId,
      message: `${agentInfo?.name || winnerId} wins the pot!`,
      details: winningHand,
    });
  },

  startNewHand: () => {
    const { agents, dealerIndex, handNumber, activePlayers } = get();

    // Reset agent states for new hand
    const resetAgents: Partial<Record<AgentId, AgentState>> = {};
    for (const [id, agent] of Object.entries(agents)) {
      if (agent) {
        resetAgents[id as AgentId] = {
          ...agent,
          holeCards: null,
          currentBet: 0,
          totalBet: 0,
          folded: false,
          isAllIn: false,
          isActive: agent.chips > 0,
          winProbability: 25,
          lastAction: null,
          currentThought: null,
        };
      }
    }

    const playerCount = activePlayers.length || 4;
    set({
      agents: resetAgents,
      phase: 'preflop',
      pot: 0,
      currentBet: 0,
      communityCards: [],
      winnerId: null,
      winningHand: null,
      handNumber: handNumber + 1,
      dealerIndex: (dealerIndex + 1) % playerCount,
    });

    get().addEvent({ type: 'system', message: `Hand #${handNumber + 1} starting...` });
  },

  initializeAgent: (agentId, chips = STARTING_CHIPS) => {
    const state = get();
    if (!state.agents[agentId]) {
      set({
        agents: {
          ...state.agents,
          [agentId]: createInitialAgentState(agentId, chips),
        },
      });
    }
  },

  setTurnTimer: (agentId, startTime, duration) => {
    set({
      turnAgentId: agentId,
      turnStartTime: startTime,
      turnDuration: duration,
    });
  },

  clearTurnTimer: () => {
    set({
      turnAgentId: null,
      turnStartTime: null,
      turnDuration: null,
    });
  },

  setGameTimestamps: (started, completed) => {
    set((state) => ({
      gameStartedAt: started !== undefined ? started : state.gameStartedAt,
      gameCompletedAt: completed !== undefined ? completed : state.gameCompletedAt,
    }));
  },

  setPhasePause: (pauseUntil) => {
    set({ phasePauseUntil: pauseUntil });
  },
}));
