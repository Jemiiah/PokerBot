import { useEffect, useState } from 'react';
import { AI_AGENTS, type AgentId } from '../../lib/constants';
import { AgentAvatar } from '../AgentAvatar';

const COORDINATOR_API_URL =
  import.meta.env.VITE_COORDINATOR_API_URL || 'http://localhost:8080';

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  agentName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalWinnings: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: number;
}

// Map agent names from backend to frontend AgentIds
function getAgentId(name: string): AgentId | null {
  const normalized = name.toLowerCase();
  const validAgents: AgentId[] = [
    'blaze', 'frost', 'shadow', 'storm', 'sage', 'ember', 'viper', 'titan'
  ];
  if (validAgents.includes(normalized as AgentId)) {
    return normalized as AgentId;
  }
  return null;
}

export function ArenaLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${COORDINATOR_API_URL}/api/leaderboard?limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      const data: LeaderboardResponse = await response.json();
      setLeaderboard(data.leaderboard);
      setLastUpdated(data.lastUpdated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and poll every 30 seconds
  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRankBadge = (rank: number): React.ReactNode => {
    if (rank === 1) return <span className="text-2xl drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">🥇</span>;
    if (rank === 2) return <span className="text-2xl drop-shadow-[0_0_8px_rgba(192,192,192,0.5)]">🥈</span>;
    if (rank === 3) return <span className="text-2xl drop-shadow-[0_0_8px_rgba(205,127,50,0.5)]">🥉</span>;
    return <span className="text-lg text-gray-500 font-bold w-8 text-center">{rank}</span>;
  };

  const formatWinnings = (weiStr: string): string => {
    try {
      const mon = Number(BigInt(weiStr)) / 1e18;
      if (mon >= 1) return `${mon.toFixed(2)}`;
      if (mon >= 0.01) return `${mon.toFixed(3)}`;
      if (mon > 0) return `${(mon * 1000).toFixed(1)}m`;
      return '0';
    } catch {
      return '0';
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card-glow overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">🏆</span>
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Leaderboard</span>
          </h2>
        </div>
        <div className="p-6 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-4 h-4 border-2 border-monad-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading rankings...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card-glow overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">🏆</span>
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Leaderboard</span>
          </h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchLeaderboard}
            className="mt-2 text-xs text-monad-primary hover:text-purple-400 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="glass-card-glow overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">🏆</span>
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Leaderboard</span>
          </h2>
        </div>
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-800/50 flex items-center justify-center">
            <span className="text-3xl opacity-50">🎮</span>
          </div>
          <p className="text-gray-400 text-sm">No games played yet</p>
          <p className="text-gray-600 text-xs mt-1">Start a match to see rankings!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card-glow overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">🏆</span>
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Leaderboard</span>
          </h2>
          {lastUpdated && (
            <span className="text-[10px] text-gray-500">
              Live
              <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full ml-1.5 animate-pulse" />
            </span>
          )}
        </div>
      </div>

      {/* Rankings */}
      <div className="divide-y divide-white/5">
        {leaderboard.slice(0, 8).map((entry) => {
          const agentId = getAgentId(entry.agentName);
          const agentInfo = agentId ? AI_AGENTS[agentId] : null;
          const winRate = entry.winRate * 100;

          return (
            <div
              key={entry.walletAddress}
              className={`px-4 py-3 flex items-center gap-3 transition-all duration-300 hover:bg-white/5 group ${
                entry.rank === 1 ? 'bg-yellow-500/5' : ''
              }`}
            >
              {/* Rank */}
              <div className="w-8 flex justify-center">
                {getRankBadge(entry.rank)}
              </div>

              {/* Avatar */}
              {agentId ? (
                <AgentAvatar agentId={agentId} size="sm" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                  ?
                </div>
              )}

              {/* Name & Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold text-sm truncate transition-all group-hover:translate-x-0.5"
                    style={{ color: agentInfo?.color || '#9CA3AF' }}
                  >
                    {agentInfo?.name || entry.agentName}
                  </span>
                  {entry.gamesWon >= 3 && (
                    <span className="text-xs bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">
                      🔥 {entry.gamesWon}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="tabular-nums">{entry.gamesWon}W - {entry.gamesPlayed - entry.gamesWon}L</span>
                  <span className="text-gray-700">•</span>
                  <span className="tabular-nums">{entry.gamesPlayed} games</span>
                </div>
              </div>

              {/* Win Rate & Earnings */}
              <div className="text-right">
                <div className={`text-sm font-bold tabular-nums ${
                  winRate >= 60 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' :
                  winRate >= 40 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {winRate.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 tabular-nums">
                  {formatWinnings(entry.totalWinnings)} MON
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {leaderboard.length > 8 && (
        <div className="px-4 py-2 border-t border-white/5 text-center bg-white/[0.02]">
          <span className="text-xs text-gray-500">
            +{leaderboard.length - 8} more agents
          </span>
        </div>
      )}
    </div>
  );
}
