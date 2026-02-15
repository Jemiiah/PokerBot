import { useState } from "react";
import { AI_AGENTS, type AgentId, type LiveAgentId } from "../../lib/constants";
import { AgentAvatar } from "../AgentAvatar";

// All 8 live agents available for selection
const SELECTABLE_AGENTS: LiveAgentId[] = [
  "blaze",
  "frost",
  "shadow",
  "storm",
  "sage",
  "ember",
  "viper",
  "titan",
];

const MIN_AGENTS = 2;
const MAX_AGENTS = 4;

interface ArenaAgentSelectProps {
  /** Whether a game is currently in progress */
  gameInProgress: boolean;
  /** Agents currently playing (to show in "Now Playing" section) */
  currentPlayers?: AgentId[];
  /** Whether we're connected to the coordinator */
  isConnected: boolean;
  /** Names of agents currently connected to the coordinator */
  connectedAgents?: string[];
  /** Callback when spectator starts a match with selected agents */
  onStartMatch: (agents: LiveAgentId[]) => void;
  /** Whether a match start is in progress */
  isStarting?: boolean;
}

export function ArenaAgentSelect({
  gameInProgress,
  currentPlayers = [],
  isConnected,
  connectedAgents = [],
  onStartMatch,
  isStarting = false,
}: ArenaAgentSelectProps) {
  const [selectedAgents, setSelectedAgents] = useState<Set<LiveAgentId>>(new Set());

  // Check if an agent is online (connected to coordinator)
  const isAgentOnline = (agentId: LiveAgentId): boolean => {
    // If we have no connected agent data yet, don't mark anything as offline
    if (connectedAgents.length === 0) return true;
    return connectedAgents.some((name) => name.toLowerCase() === agentId);
  };

  const toggleAgent = (agentId: LiveAgentId) => {
    if (gameInProgress) return;
    if (!isAgentOnline(agentId)) return;

    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else if (next.size < MAX_AGENTS) {
        next.add(agentId);
      }
      return next;
    });
  };

  const handleStartMatch = () => {
    if (
      selectedAgents.size >= MIN_AGENTS &&
      selectedAgents.size <= MAX_AGENTS &&
      isConnected &&
      !gameInProgress
    ) {
      onStartMatch(Array.from(selectedAgents));
    }
  };

  const canStart =
    selectedAgents.size >= MIN_AGENTS &&
    selectedAgents.size <= MAX_AGENTS &&
    isConnected &&
    !gameInProgress &&
    !isStarting;

  return (
    <div className="bg-gray-900/90 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚔️</span> Pick Fighters
          </h2>
          {gameInProgress ? (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
              🔴 Live
            </span>
          ) : (
            <span className="text-xs bg-gray-700/50 text-gray-400 px-2 py-1 rounded-full">
              {selectedAgents.size}/{MAX_AGENTS} selected
            </span>
          )}
        </div>
      </div>

      {/* Now Playing - shown during a game */}
      {gameInProgress && currentPlayers.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800 bg-red-500/5">
          <div className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">
            🔴 Now Playing
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {currentPlayers.map((playerId, index) => {
              const agentInfo = AI_AGENTS[playerId];
              if (!agentInfo) return null;

              return (
                <div key={playerId} className="flex items-center gap-2">
                  {index > 0 && (
                    <span className="text-gray-500 font-bold text-sm">VS</span>
                  )}
                  <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-700/50">
                    <AgentAvatar agentId={playerId} size="sm" />
                    <span
                      className="font-semibold text-sm"
                      style={{ color: agentInfo.color }}
                    >
                      {agentInfo.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Roster */}
      <div className="px-3 py-3 max-h-[260px] overflow-y-auto">
        {!gameInProgress && (
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2 px-1">
            Choose {MIN_AGENTS}–{MAX_AGENTS} Agents
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {SELECTABLE_AGENTS.map((agentId) => {
            const agentInfo = AI_AGENTS[agentId];
            const isSelected = selectedAgents.has(agentId);
            const isPlaying = currentPlayers.includes(agentId);
            const online = isAgentOnline(agentId);
            const isDisabled =
              gameInProgress ||
              !online ||
              (!isSelected && selectedAgents.size >= MAX_AGENTS);

            return (
              <button
                key={agentId}
                onClick={() => toggleAgent(agentId)}
                disabled={isDisabled}
                className={`
                  relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-left
                  transition-all duration-150
                  ${
                    isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  }
                  ${
                    isSelected
                      ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2"
                      : "bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/60"
                  }
                  ${isPlaying ? "ring-2 ring-red-500/40 opacity-100" : ""}
                `}
                style={{
                  borderColor: isSelected ? agentInfo.color : undefined,
                }}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: agentInfo.color }}
                  >
                    ✓
                  </div>
                )}

                {/* Offline badge */}
                {!online && (
                  <div className="absolute top-1 right-1 text-[8px] text-red-400/80 font-semibold uppercase">
                    Offline
                  </div>
                )}

                <AgentAvatar agentId={agentId} size="sm" />
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm truncate"
                    style={{
                      color:
                        isSelected || isPlaying
                          ? agentInfo.color
                          : online
                            ? "#9CA3AF"
                            : "#4B5563",
                    }}
                  >
                    {agentInfo.name}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {agentInfo.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Match Button - only when not in game */}
      {!gameInProgress && (
        <div className="px-3 pb-3">
          <button
            onClick={handleStartMatch}
            disabled={!canStart}
            className={`
              w-full py-3 rounded-lg font-bold text-sm
              transition-all duration-200
              flex items-center justify-center gap-2
              ${
                canStart
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.01] active:scale-[0.99]"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {isStarting ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Starting Match...</span>
              </>
            ) : !isConnected ? (
              <>
                <span>⚡</span>
                <span>Connect to Start</span>
              </>
            ) : selectedAgents.size < MIN_AGENTS ? (
              <>
                <span>⚔️</span>
                <span>Select at least {MIN_AGENTS} Agents</span>
              </>
            ) : (
              <>
                <span>⚔️</span>
                <span>Start Match ({selectedAgents.size} players)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-800 bg-gray-800/20">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Entry: 0.01 MON</span>
          <span>
            {MIN_AGENTS}–{MAX_AGENTS} Players / Game
          </span>
        </div>
      </div>
    </div>
  );
}
