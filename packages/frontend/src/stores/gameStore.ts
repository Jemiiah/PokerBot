import { create } from 'zustand';
import type { Card, AgentId, GamePhase } from '../lib/constants';
import { AI_AGENTS, STARTING_CHIPS } from '../lib/constants';

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
  type: 'action' | 'phase' | 'winner' | 'system' | 'thought';
  agentId?: AgentId;
  message: string;
  details?: string;
}

export interface GameState {
  // Game status
  isRunning: boolean;
  isPaused: boolean;
  phase: GamePhase;
  handNumber: number;

  // Agents
  agents: Record<AgentId, AgentState>;
  activeAgentId: AgentId | null;
  dealerIndex: number;

  // Table state
  pot: number;
  currentBet: number;
  communityCards: Card[];

  // Events feed
  events: GameEvent[];

  // Winner
  winnerId: AgentId | null;
  winningHand: string | null;
}

interface GameStore extends GameState {
  // Actions
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;

  // Game logic
  setPhase: (phase: GamePhase) => void;
  setActiveAgent: (agentId: AgentId | null) => void;
  updateAgent: (agentId: AgentId, updates: Partial<AgentState>) => void;
  dealHoleCards: (agentId: AgentId, cards: [Card, Card]) => void;
  addCommunityCards: (cards: Card[]) => void;

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
}

const createInitialAgentState = (id: AgentId): AgentState => ({
  id,
  chips: STARTING_CHIPS,
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

const initialState: GameState = {
  isRunning: false,
  isPaused: false,
  phase: 'waiting',
  handNumber: 0,
  agents: {
    claude: createInitialAgentState('claude'),
    chatgpt: createInitialAgentState('chatgpt'),
    grok: createInitialAgentState('grok'),
    deepseek: createInitialAgentState('deepseek'),
  },
  activeAgentId: null,
  dealerIndex: 0,
  pot: 0,
  currentBet: 0,
  communityCards: [],
  events: [],
  winnerId: null,
  winningHand: null,
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
    set({
      ...initialState,
      agents: {
        claude: createInitialAgentState('claude'),
        chatgpt: createInitialAgentState('chatgpt'),
        grok: createInitialAgentState('grok'),
        deepseek: createInitialAgentState('deepseek'),
      },
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
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: { ...state.agents[agentId], ...updates },
      },
    }));
  },

  dealHoleCards: (agentId, cards) => {
    get().updateAgent(agentId, { holeCards: cards, folded: false, currentBet: 0, totalBet: 0 });
  },

  addCommunityCards: (cards) => {
    set((state) => ({
      communityCards: [...state.communityCards, ...cards],
    }));
  },

  placeBet: (agentId, amount) => {
    const state = get();
    const agent = state.agents[agentId];
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

    get().addEvent({
      type: 'action',
      agentId,
      message: `${AI_AGENTS[agentId].name} ${actionName}s ${actualBet} chips`,
    });
  },

  fold: (agentId) => {
    get().updateAgent(agentId, { folded: true, lastAction: 'fold' });
    get().addEvent({
      type: 'action',
      agentId,
      message: `${AI_AGENTS[agentId].name} folds`,
    });
  },

  collectPot: (winnerId) => {
    const { pot, agents } = get();
    set((state) => ({
      pot: 0,
      agents: {
        ...state.agents,
        [winnerId]: {
          ...agents[winnerId],
          chips: agents[winnerId].chips + pot,
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
    get().addEvent({
      type: 'winner',
      agentId: winnerId,
      message: `${AI_AGENTS[winnerId].name} wins the pot!`,
      details: winningHand,
    });
  },

  startNewHand: () => {
    const { agents, dealerIndex, handNumber } = get();

    // Reset agent states for new hand
    const resetAgents = Object.fromEntries(
      Object.entries(agents).map(([id, agent]) => [
        id,
        {
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
        },
      ])
    ) as Record<AgentId, AgentState>;

    set({
      agents: resetAgents,
      phase: 'preflop',
      pot: 0,
      currentBet: 0,
      communityCards: [],
      winnerId: null,
      winningHand: null,
      handNumber: handNumber + 1,
      dealerIndex: (dealerIndex + 1) % 4,
    });

    get().addEvent({ type: 'system', message: `Hand #${handNumber + 1} starting...` });
  },
}));
