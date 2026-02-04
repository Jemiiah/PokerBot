import { create } from 'zustand';
import type { AgentId } from '../lib/constants';

export interface Bet {
  id: string;
  agentId: AgentId;
  amount: number;
  timestamp: Date;
  resolved: boolean;
  won: boolean;
  payout: number;
}

interface BettingStore {
  // User balance
  balance: number;

  // Current hand bets
  currentBets: Bet[];

  // Betting history
  betHistory: Bet[];

  // Odds for each agent (dynamic based on game state)
  odds: Record<AgentId, number>;

  // Actions
  placeBet: (agentId: AgentId, amount: number) => boolean;
  resolveBets: (winnerId: AgentId) => void;
  clearCurrentBets: () => void;
  updateOdds: (odds: Record<AgentId, number>) => void;
  addBalance: (amount: number) => void;
}

let betCounter = 0;

export const useBettingStore = create<BettingStore>((set, get) => ({
  balance: 1000, // Starting balance for spectators
  currentBets: [],
  betHistory: [],
  odds: {
    claude: 2.5,
    chatgpt: 2.5,
    grok: 3.0,
    deepseek: 2.8,
  },

  placeBet: (agentId, amount) => {
    const { balance, currentBets } = get();

    if (amount > balance || amount <= 0) {
      return false;
    }

    // Check if already bet on this agent this hand
    const existingBet = currentBets.find((b) => b.agentId === agentId);
    if (existingBet) {
      return false;
    }

    const newBet: Bet = {
      id: `bet-${++betCounter}`,
      agentId,
      amount,
      timestamp: new Date(),
      resolved: false,
      won: false,
      payout: 0,
    };

    set((state) => ({
      balance: state.balance - amount,
      currentBets: [...state.currentBets, newBet],
    }));

    return true;
  },

  resolveBets: (winnerId) => {
    const { currentBets, odds } = get();

    const resolvedBets = currentBets.map((bet) => {
      const won = bet.agentId === winnerId;
      const payout = won ? bet.amount * odds[bet.agentId] : 0;

      return {
        ...bet,
        resolved: true,
        won,
        payout,
      };
    });

    const totalWinnings = resolvedBets.reduce((sum, bet) => sum + bet.payout, 0);

    set((state) => ({
      balance: state.balance + totalWinnings,
      currentBets: [],
      betHistory: [...resolvedBets, ...state.betHistory].slice(0, 100),
    }));
  },

  clearCurrentBets: () => set({ currentBets: [] }),

  updateOdds: (odds) => set({ odds }),

  addBalance: (amount) => set((state) => ({ balance: state.balance + amount })),
}));
