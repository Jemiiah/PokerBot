import { useStatsStore, type AgentStats } from '../stores/statsStore';
import { AI_AGENTS } from '../lib/constants';
import { AgentAvatar } from './AgentAvatar';

interface LeaderboardProps {
  className?: string;
  compact?: boolean;
}

export function Leaderboard({ className = '', compact = false }: LeaderboardProps) {
  const leaderboard = useStatsStore((state) => state.getLeaderboard());
  const sessionGamesCount = useStatsStore((state) => state.sessionGamesCount);

  if (leaderboard.length === 0) {
    return (
      <div className={`bg-gray-900/80 rounded-xl border border-gray-800 p-4 ${className}`}>
        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
          <span>🏆</span> Leaderboard
        </h3>
        <p className="text-xs text-gray-500 text-center py-4">
          No games played yet. Start watching to see stats!
        </p>
      </div>
    );
  }

  const formatWinnings = (wei: bigint): string => {
    const mon = Number(wei) / 1e18;
    if (mon >= 1) return `${mon.toFixed(2)} MON`;
    if (mon >= 0.01) return `${mon.toFixed(3)} MON`;
    return `${(mon * 1000).toFixed(2)} mMON`;
  };

  const getWinRate = (stats: AgentStats): number => {
    if (stats.gamesPlayed === 0) return 0;
    return (stats.wins / stats.gamesPlayed) * 100;
  };

  const getStreakDisplay = (streak: number): { text: string; color: string } => {
    if (streak > 0) {
      return { text: `🔥 ${streak}W`, color: 'text-green-400' };
    } else if (streak < 0) {
      return { text: `❄️ ${Math.abs(streak)}L`, color: 'text-red-400' };
    }
    return { text: '-', color: 'text-gray-500' };
  };

  return (
    <div className={`bg-gray-900/80 rounded-xl border border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
            <span>🏆</span> Leaderboard
          </h3>
          <span className="text-xs text-gray-500">{sessionGamesCount} games</span>
        </div>
      </div>

      {/* Leaderboard entries */}
      <div className="divide-y divide-gray-800">
        {leaderboard.slice(0, compact ? 5 : 10).map((stats, index) => {
          const agentInfo = AI_AGENTS[stats.agentId];
          const winRate = getWinRate(stats);
          const streak = getStreakDisplay(stats.currentStreak);

          return (
            <div
              key={stats.agentId}
              className={`p-3 flex items-center gap-3 ${
                index === 0 ? 'bg-yellow-500/5' : ''
              }`}
            >
              {/* Rank */}
              <div className="w-6 text-center">
                {index === 0 ? (
                  <span className="text-yellow-400 text-lg">🥇</span>
                ) : index === 1 ? (
                  <span className="text-gray-300 text-lg">🥈</span>
                ) : index === 2 ? (
                  <span className="text-orange-400 text-lg">🥉</span>
                ) : (
                  <span className="text-gray-500 text-sm font-bold">{index + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <AgentAvatar agentId={stats.agentId} size="sm" />

              {/* Name and stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-medium text-sm truncate"
                    style={{ color: agentInfo?.color || '#9CA3AF' }}
                  >
                    {agentInfo?.name || stats.agentId}
                  </span>
                  <span className={`text-xs ${streak.color}`}>{streak.text}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{stats.wins}W - {stats.losses}L</span>
                  <span>•</span>
                  <span>{stats.gamesPlayed} games</span>
                </div>
              </div>

              {/* Win rate */}
              <div className="text-right">
                <div
                  className={`text-sm font-bold ${
                    winRate >= 60 ? 'text-green-400' :
                    winRate >= 40 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}
                >
                  {winRate.toFixed(0)}%
                </div>
                {!compact && (
                  <div className="text-xs text-gray-500">
                    {formatWinnings(stats.totalWinnings)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with more info */}
      {!compact && leaderboard.length > 10 && (
        <div className="p-2 border-t border-gray-800 text-center">
          <span className="text-xs text-gray-500">
            +{leaderboard.length - 10} more agents
          </span>
        </div>
      )}
    </div>
  );
}
