import { useGameStore } from '../stores/gameStore';
import { AI_AGENTS, type AgentId } from '../lib/constants';
import { PlayingCard } from './PlayingCard';
import { AgentAvatar } from './AgentAvatar';
import { ThoughtBubble } from './ThoughtBubble';

interface AgentSeatProps {
  agentId: AgentId;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  isActive: boolean;
}

export function AgentSeat({ agentId, position, isActive }: AgentSeatProps) {
  const agent = useGameStore((state) => state.agents[agentId]);
  const agentInfo = AI_AGENTS[agentId];

  const isLeft = position.includes('left');
  const isTop = position.includes('top');

  // Position styles for each corner - moved further out
  const positionStyles: Record<string, string> = {
    'top-left': 'top-0 left-0 -translate-x-[10%] -translate-y-[20%]',
    'top-right': 'top-0 right-0 translate-x-[10%] -translate-y-[20%]',
    'bottom-left': 'bottom-0 left-0 -translate-x-[10%] translate-y-[20%]',
    'bottom-right': 'bottom-0 right-0 translate-x-[10%] translate-y-[20%]',
  };

  return (
    <div
      className={`absolute ${positionStyles[position]} transition-all duration-300 ${isActive ? 'scale-105' : ''}`}
    >
      {/* Glow effect when active */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-2xl blur-xl opacity-50 -z-10"
          style={{ backgroundColor: agentInfo.color }}
        />
      )}

      <div
        className={`
          relative p-3 rounded-2xl border-2 transition-all duration-300
          ${isActive
            ? 'bg-gray-900/95 border-yellow-400 shadow-lg shadow-yellow-400/20'
            : 'bg-gray-900/80 border-gray-700'
          }
        `}
      >
        {/* Active Turn Indicator */}
        {isActive && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full">
            <div className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded animate-pulse">
              THINKING...
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className={`flex items-center gap-3 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
          {/* Avatar & Info */}
          <div className="flex flex-col items-center gap-1">
            <AgentAvatar agentId={agentId} isActive={isActive} size="md" />
            <span
              className="text-xs font-bold"
              style={{ color: agentInfo.color }}
            >
              {agentInfo.name}
            </span>
          </div>

          {/* Cards & Stats */}
          <div className="flex flex-col items-center gap-2">
            {/* Hole Cards */}
            {agent.holeCards ? (
              <div className="flex gap-1">
                <PlayingCard card={agent.holeCards[0]} />
                <PlayingCard card={agent.holeCards[1]} />
              </div>
            ) : (
              <div className="flex gap-1">
                <div className="w-10 h-14 rounded bg-gray-700/50 border border-gray-600" />
                <div className="w-10 h-14 rounded bg-gray-700/50 border border-gray-600" />
              </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-2">
              {/* Chips */}
              <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 text-xs font-bold">
                <span>{agent.chips}</span>
              </div>

              {/* Win Probability */}
              {!agent.folded && agent.holeCards && (
                <div className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-xs font-bold">
                  {agent.winProbability}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current Bet - Shown as chip outside */}
        {agent.currentBet > 0 && (
          <div
            className={`absolute ${isTop ? 'bottom-0 translate-y-full' : 'top-0 -translate-y-full'} ${isLeft ? 'right-2' : 'left-2'} mt-1`}
          >
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500 rounded-full text-white text-xs font-bold shadow-lg">
              <span>Bet: {agent.currentBet}</span>
            </div>
          </div>
        )}

        {/* Status Overlay */}
        {agent.folded && (
          <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
            <span className="text-red-400 font-bold text-sm">FOLDED</span>
          </div>
        )}

        {agent.isAllIn && !agent.folded && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 bg-red-500 rounded-full text-white text-xs font-bold animate-pulse shadow-lg">
              ALL IN
            </div>
          </div>
        )}

        {/* Last Action */}
        {agent.lastAction && !agent.folded && !isActive && (
          <div
            className={`absolute ${isTop ? '-bottom-6' : '-top-6'} left-1/2 -translate-x-1/2`}
          >
            <span className="text-gray-400 text-xs uppercase">{agent.lastAction}</span>
          </div>
        )}
      </div>

      {/* Thought Bubble - shown when agent is active and thinking */}
      {isActive && agent.currentThought && (
        <ThoughtBubble
          agentId={agentId}
          thought={agent.currentThought}
          position={position}
        />
      )}
    </div>
  );
}
