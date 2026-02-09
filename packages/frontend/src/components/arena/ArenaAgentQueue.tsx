import { AI_AGENTS, type AgentId } from '../../lib/constants';
import { AgentAvatar } from '../AgentAvatar';

interface QueuedAgent {
  address: string;
  name: string;
  balance?: string;
}

interface ArenaAgentQueueProps {
  queuedAgents: QueuedAgent[];
  currentPlayers?: { name: string; address: string }[];
  isMatchmaking: boolean;
}

export function ArenaAgentQueue({ queuedAgents, currentPlayers, isMatchmaking }: ArenaAgentQueueProps) {
  const getAgentId = (name: string): AgentId => {
    const normalized = name.toLowerCase();
    const found = Object.entries(AI_AGENTS).find(
      ([_, info]) => info.name.toLowerCase() === normalized
    );
    return (found?.[0] as AgentId) || 'blaze';
  };

  const formatBalance = (balance?: string): string => {
    if (!balance) return '?';
    const mon = Number(BigInt(balance)) / 1e18;
    return `${mon.toFixed(2)} MON`;
  };

  return (
    <div className="bg-gray-900/90 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600/20 to-teal-600/20 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎮</span> Arena Queue
          </h2>
          {isMatchmaking && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full animate-pulse">
              Matching...
            </span>
          )}
        </div>
      </div>

      {/* Current Game */}
      {currentPlayers && currentPlayers.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800 bg-green-500/5">
          <div className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-2">
            🔴 Now Playing
          </div>
          <div className="flex items-center justify-center gap-4">
            {currentPlayers.map((player, index) => {
              const agentId = getAgentId(player.name);
              const agentInfo = AI_AGENTS[agentId];

              return (
                <div key={player.address} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-500 font-bold">VS</span>}
                  <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-2 rounded-lg">
                    <AgentAvatar agentId={agentId} size="sm" />
                    <span
                      className="font-semibold text-sm"
                      style={{ color: agentInfo?.color || '#9CA3AF' }}
                    >
                      {player.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="px-4 py-3">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
          Waiting ({queuedAgents.length})
        </div>

        {queuedAgents.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">No agents in queue</p>
            <p className="text-gray-600 text-xs mt-1">Agents will appear when ready</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queuedAgents.map((agent, index) => {
              const agentId = getAgentId(agent.name);
              const agentInfo = AI_AGENTS[agentId];

              return (
                <div
                  key={agent.address}
                  className="flex items-center gap-3 bg-gray-800/30 px-3 py-2 rounded-lg"
                >
                  <div className="text-gray-500 text-sm font-mono w-4">
                    {index + 1}
                  </div>
                  <AgentAvatar agentId={agentId} size="xs" />
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-medium text-sm"
                      style={{ color: agentInfo?.color || '#9CA3AF' }}
                    >
                      {agent.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatBalance(agent.balance)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-800/20">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Entry Fee: 0.01 MON</span>
          <span>2-4 Players / Game</span>
        </div>
        {/* Player count indicator */}
        {queuedAgents.length >= 2 && !isMatchmaking && (
          <div className="mt-1 text-xs text-green-400 text-center">
            ✓ Ready to start ({queuedAgents.length} players)
          </div>
        )}
        {queuedAgents.length === 1 && (
          <div className="mt-1 text-xs text-yellow-400/70 text-center">
            Need 1 more player to start
          </div>
        )}
      </div>
    </div>
  );
}
