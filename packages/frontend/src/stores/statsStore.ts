import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentId } from '../lib/constants';

export interface AgentStats {
  agentId: AgentId;
  gamesPlayed: number;
  wins: number;
  losses: number;
  totalWinnings: bigint; // in wei
  totalLosses: bigint; // in wei
  biggestWin: bigint;
  biggestLoss: bigint;
  lastPlayed: number | null; // timestamp
  currentStreak: number; // positive = wins, negative = losses
}

export interface GameResult {
  id: string;
  gameId: string;
  timestamp: number;
  players: AgentId[];
  winnerId: AgentId;
  pot: string; // wei as string for serialization
  duration: number; // in seconds
  phases: string[]; // ['preflop', 'flop', 'turn', 'river', 'showdown']
  finalPhase: string;
}

interface StatsStore {
  // Agent stats
  agentStats: Partial<Record<AgentId, AgentStats>>;

  // Game history
  gameHistory: GameResult[];

  // Session stats
  sessionStartTime: number;
  sessionGamesCount: number;

  // Actions
  recordGameResult: (result: Omit<GameResult, 'id'>) => void;
  getAgentStats: (agentId: AgentId) => AgentStats | null;
  getLeaderboard: () => AgentStats[];
  getRecentGames: (limit?: number) => GameResult[];
  resetSession: () => void;
  clearAllStats: () => void;
}

const createDefaultStats = (agentId: AgentId): AgentStats => ({
  agentId,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  totalWinnings: BigInt(0),
  totalLosses: BigInt(0),
  biggestWin: BigInt(0),
  biggestLoss: BigInt(0),
  lastPlayed: null,
  currentStreak: 0,
});

export const useStatsStore = create<StatsStore>()(
  persist(
    (set, get) => ({
      agentStats: {},
      gameHistory: [],
      sessionStartTime: Date.now(),
      sessionGamesCount: 0,

      recordGameResult: (result) => {
        const fullResult: GameResult = {
          ...result,
          id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        set((state) => {
          const newStats = { ...state.agentStats };
          const potBigInt = BigInt(result.pot);

          // Update stats for each player
          result.players.forEach((playerId) => {
            const isWinner = playerId === result.winnerId;
            const existingStats = newStats[playerId] || createDefaultStats(playerId);

            const updatedStats: AgentStats = {
              ...existingStats,
              gamesPlayed: existingStats.gamesPlayed + 1,
              wins: existingStats.wins + (isWinner ? 1 : 0),
              losses: existingStats.losses + (isWinner ? 0 : 1),
              totalWinnings: isWinner
                ? existingStats.totalWinnings + potBigInt
                : existingStats.totalWinnings,
              totalLosses: !isWinner
                ? existingStats.totalLosses + (potBigInt / BigInt(result.players.length))
                : existingStats.totalLosses,
              biggestWin: isWinner && potBigInt > existingStats.biggestWin
                ? potBigInt
                : existingStats.biggestWin,
              biggestLoss: !isWinner && (potBigInt / BigInt(result.players.length)) > existingStats.biggestLoss
                ? potBigInt / BigInt(result.players.length)
                : existingStats.biggestLoss,
              lastPlayed: result.timestamp,
              currentStreak: isWinner
                ? (existingStats.currentStreak > 0 ? existingStats.currentStreak + 1 : 1)
                : (existingStats.currentStreak < 0 ? existingStats.currentStreak - 1 : -1),
            };

            newStats[playerId] = updatedStats;
          });

          return {
            agentStats: newStats,
            gameHistory: [fullResult, ...state.gameHistory].slice(0, 100), // Keep last 100 games
            sessionGamesCount: state.sessionGamesCount + 1,
          };
        });
      },

      getAgentStats: (agentId) => {
        return get().agentStats[agentId] || null;
      },

      getLeaderboard: () => {
        const stats = get().agentStats;
        return Object.values(stats)
          .filter((s): s is AgentStats => s !== undefined)
          .sort((a, b) => {
            // Sort by win rate, then by total games
            const aWinRate = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
            const bWinRate = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
            if (bWinRate !== aWinRate) return bWinRate - aWinRate;
            return b.gamesPlayed - a.gamesPlayed;
          });
      },

      getRecentGames: (limit = 10) => {
        return get().gameHistory.slice(0, limit);
      },

      resetSession: () => {
        set({
          sessionStartTime: Date.now(),
          sessionGamesCount: 0,
        });
      },

      clearAllStats: () => {
        set({
          agentStats: {},
          gameHistory: [],
          sessionStartTime: Date.now(),
          sessionGamesCount: 0,
        });
      },
    }),
    {
      name: 'poker-stats',
      // Custom serialization for BigInt
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Convert string back to BigInt for stats
          if (parsed.state?.agentStats) {
            Object.values(parsed.state.agentStats).forEach((stats: any) => {
              if (stats) {
                stats.totalWinnings = BigInt(stats.totalWinnings || '0');
                stats.totalLosses = BigInt(stats.totalLosses || '0');
                stats.biggestWin = BigInt(stats.biggestWin || '0');
                stats.biggestLoss = BigInt(stats.biggestLoss || '0');
              }
            });
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Convert BigInt to string for serialization
          const toSerialize = JSON.parse(JSON.stringify(value, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          ));
          localStorage.setItem(name, JSON.stringify(toSerialize));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
