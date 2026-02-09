import { useStatsStore } from '../stores/statsStore';
import { AI_AGENTS } from '../lib/constants';
import { AgentAvatar } from './AgentAvatar';

interface HandHistoryProps {
  className?: string;
  limit?: number;
}

export function HandHistory({ className = '', limit = 5 }: HandHistoryProps) {
  const recentGames = useStatsStore((state) => state.getRecentGames(limit));

  const formatPot = (potWei: string): string => {
    const mon = Number(BigInt(potWei)) / 1e18;
    if (mon >= 1) return `${mon.toFixed(2)} MON`;
    if (mon >= 0.01) return `${mon.toFixed(3)} MON`;
    return `${(mon * 1000).toFixed(2)} mMON`;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getPhaseEmoji = (phase: string): string => {
    switch (phase) {
      case 'preflop': return '🃏';
      case 'flop': return '🎴';
      case 'turn': return '🎯';
      case 'river': return '🌊';
      case 'showdown': return '🏆';
      default: return '🃏';
    }
  };

  if (recentGames.length === 0) {
    return (
      <div className={`bg-gray-900/80 rounded-xl border border-gray-800 p-4 ${className}`}>
        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
          <span>📜</span> Hand History
        </h3>
        <p className="text-xs text-gray-500 text-center py-4">
          No games recorded yet. Games will appear here as they complete.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900/80 rounded-xl border border-gray-800 ${className}`}>
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <span>📜</span> Hand History
        </h3>
      </div>

      <div className="divide-y divide-gray-800">
        {recentGames.map((game) => {
          const winnerInfo = AI_AGENTS[game.winnerId];

          return (
            <div key={game.id} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AgentAvatar agentId={game.winnerId} size="xs" />
                  <span
                    className="text-sm font-medium"
                    style={{ color: winnerInfo?.color || '#9CA3AF' }}
                  >
                    {winnerInfo?.name || game.winnerId}
                  </span>
                  <span className="text-yellow-400 text-xs">won</span>
                </div>
                <span className="text-xs text-gray-500">{formatTimeAgo(game.timestamp)}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">{formatPot(game.pot)}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-500">
                    {getPhaseEmoji(game.finalPhase)} {game.finalPhase}
                  </span>
                </div>
                <span className="text-gray-500">{game.duration}s</span>
              </div>

              <div className="flex items-center gap-1 mt-2">
                {game.players.map((playerId) => (
                  <div
                    key={playerId}
                    className={`w-5 h-5 rounded-full border-2 ${
                      playerId === game.winnerId
                        ? 'border-yellow-400'
                        : 'border-gray-600'
                    }`}
                    title={AI_AGENTS[playerId]?.name || playerId}
                  >
                    <AgentAvatar agentId={playerId} size="xs" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
