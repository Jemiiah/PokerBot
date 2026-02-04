import type { AgentThought } from '../stores/gameStore';
import { AI_AGENTS, type AgentId } from '../lib/constants';

interface ThoughtBubbleProps {
  agentId: AgentId;
  thought: AgentThought;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function ThoughtBubble({ agentId, thought, position }: ThoughtBubbleProps) {
  const agentInfo = AI_AGENTS[agentId];
  const isLeft = position.includes('left');
  const isTop = position.includes('top');

  const confidenceColors = {
    low: 'border-yellow-500/50 bg-yellow-500/10',
    medium: 'border-blue-500/50 bg-blue-500/10',
    high: 'border-green-500/50 bg-green-500/10',
  };

  const confidenceLabels = {
    low: 'Uncertain',
    medium: 'Confident',
    high: 'Very Confident',
  };

  return (
    <div
      className={`
        absolute z-50 w-72 transition-all duration-300 animate-fadeIn
        ${isTop ? 'top-full mt-3' : 'bottom-full mb-3'}
        ${isLeft ? 'left-0' : 'right-0'}
      `}
    >
      {/* Speech bubble pointer */}
      <div
        className={`
          absolute w-3 h-3 rotate-45 border-2 bg-gray-900
          ${isTop ? '-top-1.5 border-b-0 border-r-0' : '-bottom-1.5 border-t-0 border-l-0'}
          ${isLeft ? 'left-8' : 'right-8'}
        `}
        style={{ borderColor: agentInfo.color }}
      />

      {/* Main bubble */}
      <div
        className="relative rounded-xl border-2 bg-gray-900/95 backdrop-blur-sm shadow-xl overflow-hidden"
        style={{ borderColor: agentInfo.color }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: agentInfo.color, backgroundColor: `${agentInfo.color}20` }}
        >
          <span className="text-xl">{thought.emoji}</span>
          <span className="text-white font-bold text-sm">{agentInfo.name}</span>
          {thought.confidence && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${confidenceColors[thought.confidence]}`}>
              {confidenceLabels[thought.confidence]}
            </span>
          )}
        </div>

        {/* Thought content */}
        <div className="p-3 space-y-2">
          {/* Main thought */}
          <p className="text-white text-sm leading-relaxed">
            "{thought.text}"
          </p>

          {/* Analysis */}
          {thought.analysis && (
            <div className="pt-2 border-t border-gray-700">
              <p className="text-gray-400 text-xs leading-relaxed">
                <span className="text-gray-500 font-semibold">Analysis: </span>
                {thought.analysis}
              </p>
            </div>
          )}
        </div>

        {/* Thinking animation dots */}
        <div className="absolute bottom-2 right-3 flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
