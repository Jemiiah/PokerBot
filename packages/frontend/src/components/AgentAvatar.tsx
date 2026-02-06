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
const AgentIcons: Partial<Record<AgentId, React.ReactNode>> = {
  // Demo agents
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
  // Live agents
  blaze: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Fire/Flame icon */}
      <path
        d="M50 15 C50 15 70 35 70 55 C70 75 50 85 50 85 C50 85 30 75 30 55 C30 35 50 15 50 15"
        fill="currentColor"
        opacity="0.8"
      />
      <path
        d="M50 35 C50 35 60 45 60 55 C60 70 50 75 50 75 C50 75 40 70 40 55 C40 45 50 35 50 35"
        fill="currentColor"
      />
    </svg>
  ),
  frost: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Snowflake icon */}
      <line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" strokeWidth="4" />
      <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="4" />
      <line x1="25" y1="25" x2="75" y2="75" stroke="currentColor" strokeWidth="3" />
      <line x1="75" y1="25" x2="25" y2="75" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="50" r="8" fill="currentColor" />
    </svg>
  ),
  shadow: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Shadow/Moon icon */}
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="4" />
      <path
        d="M45 25 A25 25 0 0 0 45 75 A20 20 0 0 1 45 25"
        fill="currentColor"
      />
    </svg>
  ),
  storm: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Lightning bolt icon */}
      <polygon
        points="55,15 35,45 50,45 45,85 65,50 50,50"
        fill="currentColor"
      />
    </svg>
  ),
  sage: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Leaf/Nature icon */}
      <path
        d="M50 15 C30 25 20 50 30 70 C40 85 50 85 50 85 C50 85 60 85 70 70 C80 50 70 25 50 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M50 35 L50 75" stroke="currentColor" strokeWidth="3" />
      <path d="M40 50 L50 60 L60 50" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  ember: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Ember/Warm glow icon */}
      <circle cx="50" cy="50" r="25" fill="currentColor" opacity="0.4" />
      <circle cx="50" cy="50" r="15" fill="currentColor" opacity="0.7" />
      <circle cx="50" cy="50" r="8" fill="currentColor" />
    </svg>
  ),
  viper: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Snake/Viper icon */}
      <path
        d="M25 40 Q35 25 50 30 Q70 35 75 50 Q80 70 60 75 Q40 80 35 65 Q30 50 45 50"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="55" cy="35" r="4" fill="currentColor" />
    </svg>
  ),
  titan: (
    <svg viewBox="0 0 100 100" className="w-full h-full p-2">
      {/* Rock/Mountain icon */}
      <polygon
        points="50,20 80,80 20,80"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <polygon
        points="50,35 65,65 35,65"
        fill="currentColor"
        opacity="0.5"
      />
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
      {AgentIcons[agentId] || (
        <svg viewBox="0 0 100 100" className="w-full h-full p-2">
          <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="50" cy="50" r="8" fill="currentColor" />
        </svg>
      )}
    </div>
  );
}
