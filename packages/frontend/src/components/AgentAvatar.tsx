import { AI_AGENTS, type AgentId } from '../lib/constants';

interface AgentAvatarProps {
  agentId: AgentId;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
};

// SVG icons for each AI
const AgentIcons: Record<AgentId, React.ReactNode> = {
  claude: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Claude sunburst/sparkle */}
      <circle cx="50" cy="50" r="8" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <line
          key={i}
          x1="50"
          y1="50"
          x2={50 + Math.cos((angle * Math.PI) / 180) * 35}
          y2={50 + Math.sin((angle * Math.PI) / 180) * 35}
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  ),
  chatgpt: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* ChatGPT hexagon pattern */}
      <path
        d="M50 15 L80 32 L80 68 L50 85 L20 68 L20 32 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  ),
  grok: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-3">
      {/* X/Grok logo */}
      <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  ),
  deepseek: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* DeepSeek abstract brain/deep pattern */}
      <circle cx="50" cy="35" r="20" fill="none" stroke="currentColor" strokeWidth="4" />
      <path
        d="M30 55 Q50 75 70 55"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="40" cy="35" r="4" fill="currentColor" />
      <circle cx="60" cy="35" r="4" fill="currentColor" />
    </svg>
  ),
};

export function AgentAvatar({ agentId, isActive = false, size = 'md' }: AgentAvatarProps) {
  const agent = AI_AGENTS[agentId];

  return (
    <div
      className={`
        ${sizes[size]} rounded-full flex items-center justify-center
        transition-all duration-300
        ${isActive ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-gray-900' : ''}
      `}
      style={{
        backgroundColor: `${agent.color}20`,
        borderColor: agent.color,
        borderWidth: '3px',
        color: agent.color,
      }}
    >
      {AgentIcons[agentId]}
    </div>
  );
}
