import { useStatsStore, type AgentStats } from '../../stores/statsStore';
import { AI_AGENTS } from '../../lib/constants';
import { AgentAvatar } from '../AgentAvatar';

export function ArenaLeaderboard() {
  const leaderboard = useStatsStore((state) => state.getLeaderboard());

  const getWinRate = (stats: AgentStats): number => {
    if (stats.gamesPlayed === 0) return 0;
    return (stats.wins / stats.gamesPlayed) * 100;
  };

  const formatWinnings = (wei: bigint): string => {
    const mon = Number(wei) / 1e18;
    if (mon >= 1) return `${mon.toFixed(2)}`;
    if (mon >= 0.01) return `${mon.toFixed(3)}`;
    return `${(mon * 1000).toFixed(1)}m`;
  };

  const getRankBadge = (index: number): React.ReactNode => {
    if (index === 0) return <span className="text-2xl">🥇</span>;
    if (index === 1) return <span className="text-2xl">🥈</span>;
    if (index === 2) return <span className="text-2xl">🥉</span>;
    return <span className="text-lg text-gray-500 font-bold w-8 text-center">{index + 1}</span>;
  };

  if (leaderboard.length === 0) {
    return (
      <div className="bg-gray-900/90 rounded-xl border border-gray-800 overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-4 py-3 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🏆</span> Leaderboard
          </h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-gray-500 text-sm">No games played yet</p>
          <p className="text-gray-600 text-xs mt-1">Watch some games to see rankings!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/90 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-4 py-3 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🏆</span> Leaderboard
        </h2>
      </div>

      {/* Rankings */}
      <div className="divide-y divide-gray-800/50">
        {leaderboard.slice(0, 8).map((stats, index) => {
          const agentInfo = AI_AGENTS[stats.agentId];
          const winRate = getWinRate(stats);

          return (
            <div
              key={stats.agentId}
              className={`px-4 py-3 flex items-center gap-3 transition-colors hover:bg-gray-800/30 ${
                index === 0 ? 'bg-yellow-500/5' : ''
              }`}
            >
              {/* Rank */}
              <div className="w-8 flex justify-center">
                {getRankBadge(index)}
              </div>

              {/* Avatar */}
              <AgentAvatar agentId={stats.agentId} size="sm" />

              {/* Name & Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold text-sm truncate"
                    style={{ color: agentInfo?.color || '#9CA3AF' }}
                  >
                    {agentInfo?.name || stats.agentId}
                  </span>
                  {stats.currentStreak > 2 && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                      🔥 {stats.currentStreak}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{stats.wins}W - {stats.losses}L</span>
                </div>
              </div>

              {/* Win Rate & Earnings */}
              <div className="text-right">
                <div className={`text-sm font-bold ${
                  winRate >= 60 ? 'text-green-400' :
                  winRate >= 40 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {winRate.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">
                  {formatWinnings(stats.totalWinnings)} MON
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {leaderboard.length > 8 && (
        <div className="px-4 py-2 border-t border-gray-800 text-center">
          <span className="text-xs text-gray-500">
            +{leaderboard.length - 8} more agents
          </span>
        </div>
      )}
    </div>
  );
}
