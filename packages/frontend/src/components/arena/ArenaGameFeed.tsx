import { useGameStore } from '../../stores/gameStore';
import { useStatsStore } from '../../stores/statsStore';
import { AI_AGENTS } from '../../lib/constants';
import { AgentAvatar } from '../AgentAvatar';

export function ArenaGameFeed() {
  const events = useGameStore((state) => state.events);
  const recentGames = useStatsStore((state) => state.getRecentGames(5));

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getEventIcon = (type: string): string => {
    switch (type) {
      case 'winner': return '🏆';
      case 'action': return '🎯';
      case 'thought': return '💭';
      case 'phase': return '📍';
      case 'system': return '⚡';
      case 'big_pot': return '💰';
      case 'all_in': return '🔥';
      case 'showdown': return '🃏';
      default: return '•';
    }
  };

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'winner': return 'border-l-yellow-500 bg-yellow-500/5';
      case 'action': return 'border-l-blue-500 bg-blue-500/5';
      case 'thought': return 'border-l-purple-500 bg-purple-500/5';
      case 'phase': return 'border-l-green-500 bg-green-500/5';
      case 'system': return 'border-l-gray-500 bg-gray-500/5';
      // Spectator notification highlights
      case 'big_pot': return 'border-l-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30';
      case 'all_in': return 'border-l-red-500 bg-red-500/10 ring-1 ring-red-500/30 animate-pulse';
      case 'showdown': return 'border-l-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30';
      default: return 'border-l-gray-700';
    }
  };

  // Check if an event is a highlighted notification
  const isHighlightedEvent = (type: string): boolean => {
    return ['big_pot', 'all_in', 'showdown', 'winner'].includes(type);
  };

  return (
    <div className="bg-gray-900/90 rounded-xl border border-gray-800 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📡</span> Live Feed
        </h2>
      </div>

      {/* Live Events */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-2 space-y-1">
          {events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Waiting for action...</p>
              <p className="text-gray-600 text-xs mt-1">Events will appear here</p>
            </div>
          ) : (
            events.slice(0, 15).map((event, index) => {
              const highlighted = isHighlightedEvent(event.type);
              return (
                <div
                  key={`${event.timestamp}-${index}`}
                  className={`px-3 py-2 rounded-lg border-l-2 ${getEventColor(event.type)} transition-all ${
                    highlighted ? 'shadow-lg' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-sm flex-shrink-0 ${highlighted ? 'text-lg' : ''}`}>
                      {getEventIcon(event.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${
                        highlighted ? 'text-white font-semibold' : 'text-gray-200'
                      }`}>
                        {event.message}
                      </p>
                      {event.details && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {event.details}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent Games Section */}
      {recentGames.length > 0 && (
        <div className="border-t border-gray-800 flex-shrink-0">
          <div className="px-4 py-2 bg-gray-800/30">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Recent Games
            </h3>
          </div>
          <div className="divide-y divide-gray-800/50">
            {recentGames.slice(0, 3).map((game) => {
              const winnerInfo = AI_AGENTS[game.winnerId];
              const potMon = Number(BigInt(game.pot)) / 1e18;

              return (
                <div key={game.id} className="px-4 py-2 flex items-center gap-3">
                  <AgentAvatar agentId={game.winnerId} size="xs" />
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-medium"
                      style={{ color: winnerInfo?.color || '#9CA3AF' }}
                    >
                      {winnerInfo?.name || game.winnerId}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">won</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-400 font-medium">
                      +{potMon.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(game.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
