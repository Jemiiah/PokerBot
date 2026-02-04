import { useGameStore, type GameEvent } from '../stores/gameStore';
import { AgentAvatar } from './AgentAvatar';

export function AIThoughts() {
  const { events, pot } = useGameStore();

  return (
    <div className="h-full flex flex-col bg-gray-900/80 border-l border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="text-purple-400">🧠</span>
          AI Thoughts
        </h2>
      </div>

      {/* Pot Display */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Total Pot</span>
          <span className="text-xl font-bold text-green-400">{pot} chips</span>
        </div>
      </div>

      {/* Events Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            Game events will appear here...
          </p>
        ) : (
          events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

function EventItem({ event }: { event: GameEvent }) {
  const getEventStyle = () => {
    switch (event.type) {
      case 'winner':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300';
      case 'action':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
      case 'thought':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-300';
      case 'phase':
        return 'bg-green-500/10 border-green-500/30 text-green-300';
      case 'system':
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-300';
    }
  };

  const getEventIcon = () => {
    switch (event.type) {
      case 'winner':
        return '🏆';
      case 'action':
        return '🎯';
      case 'thought':
        return '💭';
      case 'phase':
        return '📍';
      case 'system':
      default:
        return '📢';
    }
  };

  const timestamp = event.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={`p-3 rounded-lg border ${getEventStyle()}`}>
      <div className="flex items-start gap-2">
        {event.agentId ? (
          <AgentAvatar agentId={event.agentId} size="sm" />
        ) : (
          <span className="text-lg">{getEventIcon()}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm">{event.message}</p>
          {event.details && (
            <p className="text-xs text-gray-500 mt-1">{event.details}</p>
          )}
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">{timestamp}</span>
      </div>
    </div>
  );
}
