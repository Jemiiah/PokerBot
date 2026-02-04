import { useState } from 'react';
import { useBettingStore } from '../stores/bettingStore';
import { useGameStore } from '../stores/gameStore';
import { AI_AGENTS, type AgentId } from '../lib/constants';
import { AgentAvatar } from './AgentAvatar';

export function BettingPanel() {
  const { balance, currentBets, odds, placeBet } = useBettingStore();
  const { phase, agents, isRunning } = useGameStore();
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [betAmount, setBetAmount] = useState(50);

  const canBet = isRunning && phase !== 'showdown' && phase !== 'waiting';

  const handlePlaceBet = () => {
    if (!selectedAgent || !canBet) return;

    const success = placeBet(selectedAgent, betAmount);
    if (success) {
      setSelectedAgent(null);
      setBetAmount(50);
    }
  };

  const agentIds: AgentId[] = ['claude', 'chatgpt', 'grok', 'deepseek'];

  return (
    <div className="bg-gray-900/80 border-t border-gray-700 p-4">
      {/* Balance */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Place Your Bets</h3>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Balance:</span>
          <span className="text-xl font-bold text-green-400">{balance} chips</span>
        </div>
      </div>

      {/* Current Bets */}
      {currentBets.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400 font-medium">Active Bets:</p>
          <div className="flex gap-2 mt-2">
            {currentBets.map((bet) => (
              <div key={bet.id} className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded">
                <AgentAvatar agentId={bet.agentId} size="sm" />
                <span className="text-sm font-medium">{bet.amount} chips</span>
                <span className="text-xs text-gray-400">@ {odds[bet.agentId]}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Selection */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {agentIds.map((agentId) => {
          const agent = agents[agentId];
          const agentInfo = AI_AGENTS[agentId];
          const isSelected = selectedAgent === agentId;
          const hasBet = currentBets.some((b) => b.agentId === agentId);
          const isOut = agent.chips <= 0 || agent.folded;

          return (
            <button
              key={agentId}
              onClick={() => !hasBet && !isOut && canBet && setSelectedAgent(agentId)}
              disabled={hasBet || isOut || !canBet}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${isSelected ? 'border-yellow-400 bg-yellow-400/10' : 'border-gray-700 hover:border-gray-500'}
                ${hasBet ? 'opacity-50 cursor-not-allowed' : ''}
                ${isOut ? 'opacity-30 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex flex-col items-center gap-2">
                <AgentAvatar agentId={agentId} size="sm" />
                <span className="text-sm font-medium">{agentInfo.name}</span>
                <span className="text-xs text-green-400 font-bold">{odds[agentId]}x</span>
                {isOut && <span className="text-xs text-red-400">OUT</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bet Amount */}
      {selectedAgent && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="range"
              min={10}
              max={Math.min(500, balance)}
              step={10}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10</span>
              <span>{betAmount} chips</span>
              <span>{Math.min(500, balance)}</span>
            </div>
          </div>
          <button
            onClick={handlePlaceBet}
            disabled={betAmount > balance}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bet {betAmount} on {AI_AGENTS[selectedAgent].name}
          </button>
        </div>
      )}

      {/* Potential Payout */}
      {selectedAgent && (
        <div className="mt-3 text-center text-sm text-gray-400">
          Potential payout:{' '}
          <span className="text-green-400 font-bold">
            {Math.floor(betAmount * odds[selectedAgent])} chips
          </span>
        </div>
      )}

      {!canBet && !isRunning && (
        <p className="text-center text-gray-500 text-sm py-4">
          Start the game to place bets!
        </p>
      )}
    </div>
  );
}
