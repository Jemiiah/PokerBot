import { useState, useEffect } from 'react';
import { realGameService, type MatchmakingState, type GameInfo } from '../services/realGameService';
import { AI_AGENTS, type AgentId } from '../lib/constants';
import { AgentAvatar } from './AgentAvatar';

interface MatchmakingQueueProps {
  isConnected: boolean;
}

export function MatchmakingQueue({ isConnected }: MatchmakingQueueProps) {
  const [matchState, setMatchState] = useState<MatchmakingState>({
    queueSize: 0,
    queuedAgents: [],
    isMatchmaking: false,
  });
  const [games, setGames] = useState<GameInfo[]>([]);

  useEffect(() => {
    if (!isConnected) return;

    const unsubMatch = realGameService.onMatchmakingUpdate((newState) => {
      setMatchState(newState);
    });

    const unsubGames = realGameService.onGameUpdate((newGames) => {
      setGames(newGames);
    });

    return () => {
      unsubMatch();
      unsubGames();
    };
  }, [isConnected]);

  // Map agent name to AgentId
  const getAgentId = (name: string): AgentId | null => {
    const normalizedName = name.toLowerCase();
    for (const [id, info] of Object.entries(AI_AGENTS)) {
      if (info.name.toLowerCase() === normalizedName) {
        return id as AgentId;
      }
    }
    return null;
  };

  // Format wager amount
  const formatWager = (wager: string | undefined): string => {
    if (!wager) return '???';
    const wei = BigInt(wager);
    const eth = Number(wei) / 1e18;
    if (eth >= 0.01) return `${eth.toFixed(3)} MON`;
    return `${(eth * 1000).toFixed(2)} mMON`;
  };

  // Get status color
  const getStatusColor = (status: GameInfo['status']): string => {
    switch (status) {
      case 'creating': return 'text-blue-400';
      case 'waiting': return 'text-yellow-400';
      case 'starting': return 'text-orange-400';
      case 'active': return 'text-green-400';
      case 'complete': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBg = (status: GameInfo['status']): string => {
    switch (status) {
      case 'creating': return 'bg-blue-500/10 border-blue-500/30';
      case 'waiting': return 'bg-yellow-500/10 border-yellow-500/30';
      case 'starting': return 'bg-orange-500/10 border-orange-500/30';
      case 'active': return 'bg-green-500/10 border-green-500/30';
      case 'complete': return 'bg-gray-500/10 border-gray-500/30';
      default: return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  if (!isConnected) {
    return (
      <div className="p-3 bg-gray-900/50 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-gray-400">Connecting to coordinator...</span>
        </div>
      </div>
    );
  }

  const activeGames = games.filter(g => g.status !== 'complete');
  const hasActivity = matchState.queueSize > 0 || activeGames.length > 0 || matchState.isMatchmaking;

  return (
    <div className="p-3 bg-gray-900/50 border-b border-gray-800">
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-gray-300">Live Status</span>
        </div>
        {matchState.queueSize > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
            {matchState.queueSize} in queue
          </span>
        )}
      </div>

      {/* Active Games */}
      {activeGames.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Active Games</p>
          {activeGames.map((game) => (
            <GameCard key={game.gameId} game={game} getAgentId={getAgentId} formatWager={formatWager} getStatusColor={getStatusColor} getStatusBg={getStatusBg} />
          ))}
        </div>
      )}

      {/* Match Starting */}
      {matchState.isMatchmaking && matchState.matchPlayers && (
        <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 mb-3 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-ping" />
            <p className="text-xs text-yellow-400 font-medium">Creating Match...</p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {matchState.matchPlayers.map((player, idx) => {
              const agentId = getAgentId(player.name);
              return (
                <div key={player.address} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-xs text-gray-500">vs</span>}
                  {agentId ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800">
                      <AgentAvatar agentId={agentId} size="sm" />
                      <span className="text-xs font-medium" style={{ color: AI_AGENTS[agentId].color }}>
                        {AI_AGENTS[agentId].name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-white px-2 py-1 rounded bg-gray-800">{player.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Queue */}
      {matchState.queueSize > 0 && !matchState.isMatchmaking && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Waiting for Match</p>
          <div className="flex flex-wrap gap-1">
            {matchState.queuedAgents.map((agent) => {
              const agentId = getAgentId(agent.name);
              return (
                <div
                  key={agent.address}
                  className="flex items-center gap-1 px-2 py-1 rounded-full border"
                  style={{
                    backgroundColor: agentId ? `${AI_AGENTS[agentId].color}15` : 'rgba(107, 114, 128, 0.15)',
                    borderColor: agentId ? `${AI_AGENTS[agentId].color}40` : 'rgba(107, 114, 128, 0.4)',
                  }}
                >
                  {agentId ? (
                    <>
                      <AgentAvatar agentId={agentId} size="sm" />
                      <span className="text-xs font-medium" style={{ color: AI_AGENTS[agentId].color }}>
                        {AI_AGENTS[agentId].name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-300">{agent.name}</span>
                  )}
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                </div>
              );
            })}
          </div>
          {matchState.queueSize < 2 && (
            <p className="text-[10px] text-gray-500 mt-2">
              Need {2 - matchState.queueSize} more agent{matchState.queueSize === 1 ? '' : 's'} to start
            </p>
          )}
        </div>
      )}

      {/* No Activity */}
      {!hasActivity && (
        <div className="text-center py-2">
          <p className="text-xs text-gray-500">Waiting for agents...</p>
          <p className="text-[10px] text-gray-600 mt-1">Start agents to see them play</p>
        </div>
      )}
    </div>
  );
}

// Game Card Component
interface GameCardProps {
  game: GameInfo;
  getAgentId: (name: string) => AgentId | null;
  formatWager: (wager: string | undefined) => string;
  getStatusColor: (status: GameInfo['status']) => string;
  getStatusBg: (status: GameInfo['status']) => string;
}

function GameCard({ game, getAgentId, formatWager, getStatusColor, getStatusBg }: GameCardProps) {
  const statusLabels: Record<GameInfo['status'], string> = {
    creating: 'Creating...',
    waiting: 'Waiting for players',
    starting: 'Starting...',
    active: 'In Progress',
    complete: 'Complete',
  };

  const timeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className={`p-2 rounded border ${getStatusBg(game.status)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${getStatusColor(game.status)}`}>
            {statusLabels[game.status]}
          </span>
          {game.status === 'active' && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-gray-500">{timeSince(game.createdAt)}</span>
      </div>

      {/* Wager */}
      {game.wagerAmount && (
        <div className="text-[10px] text-gray-400 mb-2">
          Wager: <span className="text-yellow-400 font-medium">{formatWager(game.wagerAmount)}</span>
        </div>
      )}

      {/* Players */}
      <div className="flex flex-wrap gap-1">
        {game.players.map((player) => {
          const agentId = getAgentId(player.name);
          const isCreator = game.creator?.address.toLowerCase() === player.address.toLowerCase();
          const isWinner = game.winner?.address.toLowerCase() === player.address.toLowerCase();

          return (
            <div
              key={player.address}
              className={`flex items-center gap-1 px-2 py-1 rounded ${
                isWinner ? 'bg-yellow-500/20 ring-1 ring-yellow-500' : 'bg-gray-800/50'
              }`}
            >
              {agentId ? (
                <>
                  <AgentAvatar agentId={agentId} size="sm" />
                  <span className="text-xs font-medium" style={{ color: AI_AGENTS[agentId].color }}>
                    {AI_AGENTS[agentId].name}
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-300">{player.name}</span>
              )}
              {isCreator && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/30 text-blue-400">Host</span>
              )}
              {isWinner && (
                <span className="text-[10px]">🏆</span>
              )}
            </div>
          );
        })}

        {/* Waiting for more players indicator */}
        {game.status === 'waiting' && game.players.length < 2 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800/30 border border-dashed border-gray-600">
            <span className="text-xs text-gray-500">Waiting...</span>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Game ID (truncated) */}
      <div className="mt-2 text-[10px] text-gray-600 font-mono">
        ID: {game.gameId.slice(0, 10)}...{game.gameId.slice(-6)}
      </div>
    </div>
  );
}
