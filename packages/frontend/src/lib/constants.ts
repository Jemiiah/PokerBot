// AI Agent definitions - 8 unique poker agents
export const AI_AGENTS = {
  // Original agents
  blaze: {
    id: 'blaze',
    name: 'Blaze',
    provider: 'Fire',
    avatar: '/avatars/blaze.svg',
    color: '#FF6B35', // Fiery orange
    description: 'Aggressive and fiery',
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    provider: 'Ice',
    avatar: '/avatars/frost.svg',
    color: '#4FC3F7', // Ice blue
    description: 'Cool and calculated',
  },
  // New agents
  shadow: {
    id: 'shadow',
    name: 'Shadow',
    provider: 'Dark',
    avatar: '/avatars/shadow.svg',
    color: '#9C27B0', // Purple
    description: 'Mysterious and deceptive',
  },
  storm: {
    id: 'storm',
    name: 'Storm',
    provider: 'Electric',
    avatar: '/avatars/storm.svg',
    color: '#00BCD4', // Cyan
    description: 'Unpredictable and volatile',
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    provider: 'Nature',
    avatar: '/avatars/sage.svg',
    color: '#4CAF50', // Green
    description: 'Wise and patient',
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    provider: 'Warmth',
    avatar: '/avatars/ember.svg',
    color: '#FFC107', // Amber
    description: 'Warm and steady',
  },
  viper: {
    id: 'viper',
    name: 'Viper',
    provider: 'Venom',
    avatar: '/avatars/viper.svg',
    color: '#8BC34A', // Light green
    description: 'Quick and venomous',
  },
  titan: {
    id: 'titan',
    name: 'Titan',
    provider: 'Stone',
    avatar: '/avatars/titan.svg',
    color: '#607D8B', // Blue grey
    description: 'Strong and immovable',
  },
  // Demo mode agents (for backwards compatibility)
  claude: {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    avatar: '/avatars/claude.svg',
    color: '#D97757', // Coral/orange
    description: 'Thoughtful and strategic',
  },
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    avatar: '/avatars/chatgpt.svg',
    color: '#10A37F', // OpenAI green
    description: 'Analytical and adaptive',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    avatar: '/avatars/grok.svg',
    color: '#1DA1F2', // X/Twitter blue
    description: 'Bold and unpredictable',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'DeepSeek',
    avatar: '/avatars/deepseek.svg',
    color: '#4F46E5', // Indigo
    description: 'Calculated and patient',
  },
} as const;

export type AgentId = keyof typeof AI_AGENTS;

// Type for demo agent IDs only
export type DemoAgentId = 'claude' | 'chatgpt' | 'grok' | 'deepseek';

// Type for live agent IDs only
export type LiveAgentId = 'shadow' | 'storm' | 'sage' | 'blaze' | 'ember' | 'frost' | 'viper' | 'titan';

// Live mode agents (for real games) - 4 agents with funds
export const LIVE_AGENT_IDS: LiveAgentId[] = ['shadow', 'storm', 'sage', 'blaze'];

// Demo mode agents (for simulation)
export const DEMO_AGENT_IDS: DemoAgentId[] = ['claude', 'chatgpt', 'grok', 'deepseek'];

// Agent positions for different player counts
export type SeatPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const SEAT_POSITIONS_2: SeatPosition[] = ['top-left', 'bottom-right'];
export const SEAT_POSITIONS_3: SeatPosition[] = ['top-left', 'top-right', 'bottom-left'];
export const SEAT_POSITIONS_4: SeatPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export function getSeatPositions(playerCount: number): SeatPosition[] {
  if (playerCount === 2) return SEAT_POSITIONS_2;
  if (playerCount === 3) return SEAT_POSITIONS_3;
  return SEAT_POSITIONS_4;
}

// Legacy position mapping for demo mode
export const AGENT_POSITIONS: Record<string, SeatPosition> = {
  deepseek: 'top-left',
  chatgpt: 'top-right',
  grok: 'bottom-left',
  claude: 'bottom-right',
  blaze: 'top-left',
  frost: 'bottom-right',
  shadow: 'top-right',
  storm: 'bottom-left',
  sage: 'top-left',
  ember: 'top-right',
  viper: 'bottom-left',
  titan: 'bottom-right',
};

// Game phases
export const PHASES = ['waiting', 'preflop', 'flop', 'turn', 'river', 'showdown'] as const;
export type GamePhase = typeof PHASES[number];

// Actions
export const ACTIONS = ['fold', 'check', 'call', 'raise', 'all_in'] as const;
export type ActionType = typeof ACTIONS[number];

// Card suits and ranks
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

// Starting chips
export const STARTING_CHIPS = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

// Timing - Spectator-friendly delays
export const ACTION_DELAY_MS = 2500; // Time between AI actions (increased for spectating)
export const THINKING_DELAY_MS = 2000; // Time AI "thinks" (increased)
export const CARD_DEAL_DELAY_MS = 500; // Delay per card dealt
export const PHASE_TRANSITION_MS = 1500; // Delay between phases
