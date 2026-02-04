import { useState } from 'react';
import { useGameStore, type GameEvent } from '../stores/gameStore';
import { useBettingStore } from '../stores/bettingStore';
import { AI_AGENTS, type AgentId } from '../lib/constants';
import { AgentAvatar } from './AgentAvatar';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<'thoughts' | 'betting'>('thoughts');

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-l border-gray-800">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('thoughts')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'thoughts'
              ? 'text-white border-b-2 border-blue-500 bg-gray-800/50'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          AI Thoughts
        </button>
        <button
          onClick={() => setActiveTab('betting')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'betting'
              ? 'text-white border-b-2 border-yellow-500 bg-gray-800/50'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Bet
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'thoughts' ? <ThoughtsPanel /> : <BettingPanel />}
      </div>
    </div>
  );
}

function ThoughtsPanel() {
  const { events, pot } = useGameStore();

  return (
    <div className="h-full flex flex-col">
      {/* Pot Display */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Total Pot</span>
          <span className="text-xl font-bold text-green-400">{pot}</span>
        </div>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Start the game to see AI thoughts...
          </p>
        ) : (
          events.map((event) => <EventItem key={event.id} event={event} />)
        )}
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
  const agentIds: AgentId[] = ['claude', 'chatgpt', 'grok', 'deepseek'];

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
          const isOut = agent.chips <= 0 || agent.folded;

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
            Win: <span className="text-green-400">{Math.floor(betAmount * odds[selectedAgent])}</span>
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
