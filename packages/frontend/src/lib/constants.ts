// AI Agent definitions
export const AI_AGENTS = {
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

export const AGENT_POSITIONS: Record<AgentId, 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = {
  deepseek: 'top-left',
  chatgpt: 'top-right',
  grok: 'bottom-left',
  claude: 'bottom-right',
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

// Timing
export const ACTION_DELAY_MS = 2000; // Time between AI actions
export const THINKING_DELAY_MS = 1500; // Time AI "thinks"
