import { useState, useEffect } from 'react';
import { useGameStore, type GameEvent } from '../stores/gameStore';
import { useBettingStore } from '../stores/bettingStore';
import { AI_AGENTS, LIVE_AGENT_IDS, DEMO_AGENT_IDS, type AgentId } from '../lib/constants';
import { AgentAvatar } from './AgentAvatar';
import { LiveBettingPanel } from './LiveBettingPanel';
import { MatchmakingQueue } from './MatchmakingQueue';
import { Leaderboard } from './Leaderboard';
import { SessionStats } from './SessionStats';
import { HandHistory } from './HandHistory';
import { realGameService, type AgentThoughtMessage } from '../services/realGameService';

interface SidebarProps {
  mode?: 'demo' | 'live';
  gameId?: string | null;
  gamePhase?: number;
  isConnected?: boolean;
}

export function Sidebar({ mode = 'demo', gameId = null, gamePhase = 0, isConnected = false }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'thoughts' | 'betting' | 'stats'>('thoughts');

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-l border-gray-800">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('thoughts')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'thoughts'
              ? 'text-white border-b-2 border-blue-500 bg-gray-800/50'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Thoughts
        </button>
        <button
          onClick={() => setActiveTab('betting')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'betting'
              ? 'text-white border-b-2 border-yellow-500 bg-gray-800/50'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Bet
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-white border-b-2 border-green-500 bg-gray-800/50'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Stats
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'thoughts' ? (
          <ThoughtsPanel mode={mode} gameId={gameId} isConnected={isConnected} />
        ) : activeTab === 'stats' ? (
          <StatsPanel />
        ) : mode === 'live' ? (
          <div className="p-3 overflow-y-auto h-full">
            <LiveBettingPanel
              gameId={gameId}
              player0Name="Blaze"
              player1Name="Frost"
              gamePhase={gamePhase}
            />
          </div>
        ) : (
          <BettingPanel />
        )}
      </div>
    </div>
  );
}

function StatsPanel() {
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <SessionStats />
      <Leaderboard compact />
      <HandHistory limit={5} />
    </div>
  );
}

interface ThoughtsPanelProps {
  mode: 'demo' | 'live';
  gameId: string | null;
  isConnected: boolean;
}

function ThoughtsPanel({ mode, gameId, isConnected }: ThoughtsPanelProps) {
  const { events, pot, agents, isRunning } = useGameStore();
  const [liveThoughts, setLiveThoughts] = useState<AgentThoughtMessage[]>([]);

  // Determine if there's an active game
  const hasActiveGame = mode === 'demo' ? isRunning : (gameId !== null && gameId !== undefined);

  // Clear live thoughts when switching away from live mode or when no active game
  useEffect(() => {
    if (mode !== 'live' || !hasActiveGame) {
      setLiveThoughts([]);
    }
  }, [mode, hasActiveGame]);

  // Subscribe to live thoughts from coordinator in live mode
  useEffect(() => {
    if (mode !== 'live') return;

    const unsubscribe = realGameService.onMessage((message) => {
      if (message.type === 'agent_thought') {
        setLiveThoughts((prev) => [message, ...prev].slice(0, 20));
      }
    });

    return () => unsubscribe();
  }, [mode]);

  // Filter events to only show events relevant to current mode AND active game
  const filteredEvents = hasActiveGame ? events.filter((event) => {
    // If event has no agentId, it's a system event - show it
    if (!event.agentId) return true;

    // Check if the agent belongs to the current mode
    // Cast to string array for comparison since agentId is broader type
    const liveAgents = LIVE_AGENT_IDS as readonly string[];
    const demoAgents = DEMO_AGENT_IDS as readonly string[];
    const isLiveAgent = liveAgents.includes(event.agentId);
    const isDemoAgent = demoAgents.includes(event.agentId);

    if (mode === 'live') {
      return isLiveAgent;
    } else {
      return isDemoAgent;
    }
  }) : []; // No events when no active game

  // Get active agents' thoughts based on mode
  const activeAgents = mode === 'live' ? LIVE_AGENT_IDS : DEMO_AGENT_IDS;

  return (
    <div className="h-full flex flex-col">
      {/* Matchmaking Queue (Live mode only) - fixed at top */}
      {mode === 'live' && (
        <MatchmakingQueue isConnected={isConnected} />
      )}

      {/* Pot Display - fixed at top */}
      <div className="p-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Total Pot</span>
          <span className="text-xl font-bold text-green-400">{hasActiveGame ? pot : 0}</span>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Agent Thoughts Summary (Live Mode with active game) */}
        {mode === 'live' && hasActiveGame && liveThoughts.length > 0 && (
          <div className="p-3 border-b border-gray-800 bg-gray-900/50">
            <p className="text-xs text-gray-500 mb-2">Latest Agent Thoughts</p>
            <div className="space-y-2">
              {liveThoughts.slice(0, 3).map((thought, idx) => (
                <LiveThoughtItem key={`${thought.gameId}-${thought.timestamp}-${idx}`} thought={thought} />
              ))}
            </div>
          </div>
        )}

        {/* Current Agent Thoughts from Store - only when active game */}
        {hasActiveGame && Object.values(agents).some(a => a?.currentThought) && (
          <div className="p-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Active Thoughts</p>
            <div className="space-y-2">
              {activeAgents.map((agentId) => {
                const agent = agents[agentId];
                if (!agent?.currentThought) return null;
                return (
                  <CurrentThoughtItem
                    key={agentId}
                    agentId={agentId}
                    thought={agent.currentThought}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Events */}
        <div className="p-3 space-y-2">
          {filteredEvents.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              {mode === 'live'
                ? 'Select a game to see AI thoughts...'
                : 'Start the game to see AI thoughts...'}
            </p>
          ) : (
            filteredEvents.map((event) => <EventItem key={event.id} event={event} />)
          )}
        </div>
      </div>
    </div>
  );
}

interface LiveThoughtItemProps {
  thought: AgentThoughtMessage;
}

function LiveThoughtItem({ thought }: LiveThoughtItemProps) {
  // Try to find matching agent by name
  let agentId: AgentId | undefined;
  const agentName = thought.agentName || 'Agent';

  // Match by agent name
  for (const [id, info] of Object.entries(AI_AGENTS)) {
    if (info.name.toLowerCase() === agentName.toLowerCase()) {
      agentId = id as AgentId;
      break;
    }
  }

  const displayName = agentId ? AI_AGENTS[agentId].name : agentName;
  const color = agentId ? AI_AGENTS[agentId].color : '#6B7280';

  return (
    <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30">
      <div className="flex items-start gap-2">
        {agentId ? (
          <AgentAvatar agentId={agentId} size="sm" />
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: color }}
          >
            {displayName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold" style={{ color }}>
              {displayName}
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">
              {thought.action}
            </span>
          </div>
          <p className="text-xs text-gray-300 line-clamp-2">{thought.reasoning}</p>
          {(thought.equity !== undefined || thought.potOdds !== undefined) && (
            <div className="flex gap-2 mt-1 text-[10px] text-gray-500">
              {thought.equity !== undefined && (
                <span>Equity: {(thought.equity * 100).toFixed(0)}%</span>
              )}
              {thought.potOdds !== undefined && (
                <span>Pot Odds: {(thought.potOdds * 100).toFixed(0)}%</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CurrentThoughtItemProps {
  agentId: AgentId;
  thought: {
    text: string;
    analysis?: string;
    confidence?: 'low' | 'medium' | 'high';
    emoji?: string;
  };
}

function CurrentThoughtItem({ agentId, thought }: CurrentThoughtItemProps) {
  const agentInfo = AI_AGENTS[agentId];

  const confidenceColors = {
    low: 'text-red-400',
    medium: 'text-yellow-400',
    high: 'text-green-400',
  };

  return (
    <div
      className="p-2 rounded border"
      style={{
        backgroundColor: `${agentInfo.color}10`,
        borderColor: `${agentInfo.color}30`,
      }}
    >
      <div className="flex items-start gap-2">
        <AgentAvatar agentId={agentId} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: agentInfo.color }}>
              {agentInfo.name}
            </span>
            {thought.confidence && (
              <span className={`text-[10px] ${confidenceColors[thought.confidence]}`}>
                {thought.confidence.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-300 mt-0.5">
            {thought.emoji && <span className="mr-1">{thought.emoji}</span>}
            {thought.text}
          </p>
          {thought.analysis && (
            <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{thought.analysis}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: GameEvent }) {
  const bgColors: Record<string, string> = {
    winner: 'bg-yellow-500/10 border-yellow-500/30',
    action: 'bg-blue-500/10 border-blue-500/30',
    thought: 'bg-purple-500/10 border-purple-500/30',
    phase: 'bg-green-500/10 border-green-500/30',
    system: 'bg-gray-500/10 border-gray-500/30',
  };

  const icons: Record<string, string> = {
    winner: '🏆',
    action: '🎯',
    thought: '💭',
    phase: '📍',
    system: '📢',
  };

  const time = event.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={`p-2 rounded border ${bgColors[event.type] || bgColors.system}`}>
      <div className="flex items-start gap-2">
        {event.agentId ? (
          <AgentAvatar agentId={event.agentId} size="sm" />
        ) : (
          <span className="text-sm">{icons[event.type] || '📢'}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-300">{event.message}</p>
          {event.details && (
            <p className="text-[10px] text-gray-500 mt-0.5">{event.details}</p>
          )}
        </div>
        <span className="text-[10px] text-gray-500">{time}</span>
      </div>
    </div>
  );
}

function BettingPanel() {
  const { balance, currentBets, odds, placeBet } = useBettingStore();
  const { phase, agents, isRunning } = useGameStore();
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [betAmount, setBetAmount] = useState(50);

  const canBet = isRunning && phase !== 'showdown' && phase !== 'waiting';
  const agentIds = DEMO_AGENT_IDS;

  const handlePlaceBet = () => {
    if (!selectedAgent || !canBet) return;
    if (placeBet(selectedAgent, betAmount)) {
      setSelectedAgent(null);
      setBetAmount(50);
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Balance */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
        <span className="text-gray-400 text-sm">Your Balance</span>
        <span className="text-xl font-bold text-green-400">{balance}</span>
      </div>

      {/* Current Bets */}
      {currentBets.length > 0 && (
        <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
          <p className="text-xs text-yellow-400 font-medium mb-2">Active Bets:</p>
          {currentBets.map((bet) => (
            <div key={bet.id} className="flex items-center gap-2 text-xs">
              <AgentAvatar agentId={bet.agentId} size="sm" />
              <span className="text-white">{bet.amount}</span>
              <span className="text-gray-400">@ {odds[bet.agentId]}x</span>
            </div>
          ))}
        </div>
      )}

      {/* Agent Selection */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {agentIds.map((agentId) => {
          const agent = agents[agentId];
          const isSelected = selectedAgent === agentId;
          const hasBet = currentBets.some((b) => b.agentId === agentId);
          const isOut = agent && (agent.chips <= 0 || agent.folded);

          return (
            <button
              key={agentId}
              onClick={() => !hasBet && !isOut && canBet && setSelectedAgent(agentId)}
              disabled={hasBet || isOut || !canBet}
              className={`p-2 rounded border transition-all ${
                isSelected
                  ? 'border-yellow-400 bg-yellow-400/10'
                  : 'border-gray-700 hover:border-gray-600'
              } ${(hasBet || isOut || !canBet) ? 'opacity-40' : ''}`}
            >
              <div className="flex flex-col items-center gap-1">
                <AgentAvatar agentId={agentId} size="sm" />
                <span className="text-xs font-medium text-white">{AI_AGENTS[agentId].name}</span>
                <span className="text-xs text-green-400 font-bold">{odds[agentId]}x</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bet Controls */}
      {selectedAgent && (
        <div className="space-y-3">
          <input
            type="range"
            min={10}
            max={Math.min(500, balance)}
            step={10}
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>10</span>
            <span className="text-white font-medium">{betAmount}</span>
            <span>{Math.min(500, balance)}</span>
          </div>
          <button
            onClick={handlePlaceBet}
            disabled={betAmount > balance}
            className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded transition-colors disabled:opacity-50"
          >
            Bet {betAmount} on {AI_AGENTS[selectedAgent].name}
          </button>
          <p className="text-center text-xs text-gray-400">
            Win: <span className="text-green-400">{Math.floor(betAmount * (odds[selectedAgent] ?? 2.5))}</span>
          </p>
        </div>
      )}

      {!canBet && (
        <p className="text-center text-gray-500 text-xs mt-4">
          {!isRunning ? 'Start game to bet' : 'Wait for next hand'}
        </p>
      )}
    </div>
  );
}
