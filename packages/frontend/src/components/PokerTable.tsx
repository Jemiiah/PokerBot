import { useGameStore } from '../stores/gameStore';
import { AgentSeat } from './AgentSeat';
import { CommunityCards } from './CommunityCards';

export function PokerTable() {
  const { phase, pot, communityCards, activeAgentId, handNumber } = useGameStore();

  const phaseLabels: Record<string, string> = {
    waiting: 'WAITING',
    preflop: 'PRE-FLOP',
    flop: 'FLOP',
    turn: 'TURN',
    river: 'RIVER',
    showdown: 'SHOWDOWN',
  };

  const phaseColors: Record<string, string> = {
    waiting: 'bg-gray-600',
    preflop: 'bg-blue-600',
    flop: 'bg-green-600',
    turn: 'bg-yellow-600',
    river: 'bg-orange-600',
    showdown: 'bg-purple-600',
  };

  return (
    <div className="relative w-full max-w-6xl aspect-[16/10]">
      {/* Table Shadow */}
      <div className="absolute inset-[5%] rounded-[50%] bg-black/60 blur-3xl translate-y-4" />

      {/* Poker Table */}
      <div className="absolute inset-[5%] rounded-[50%] bg-gradient-to-b from-[#1a7a4c] to-[#145c3a] border-[16px] border-[#2d1810] shadow-[inset_0_0_80px_rgba(0,0,0,0.5)]">
        {/* Inner Felt Border */}
        <div className="absolute inset-4 rounded-[50%] border-2 border-[#2d9860]/30" />

        {/* Table Rail Highlight */}
        <div className="absolute inset-0 rounded-[50%] shadow-[inset_0_-4px_20px_rgba(255,255,255,0.1)]" />

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Logo/Title */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold tracking-[0.3em] text-white/70 drop-shadow-lg">
              AI POKER
            </h1>
            {handNumber > 0 && (
              <p className="text-center text-white/40 text-xs mt-1">
                Hand #{handNumber}
              </p>
            )}
          </div>

          {/* Community Cards */}
          <div className="mb-4">
            <CommunityCards cards={communityCards} />
          </div>

          {/* Pot and Phase */}
          <div className="flex items-center gap-3">
            {pot > 0 && (
              <div className="flex items-center gap-2 px-5 py-2 bg-black/40 backdrop-blur rounded-full border border-yellow-500/30 shadow-lg">
                <div className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600 flex items-center justify-center text-[10px] font-bold text-yellow-900">
                  $
                </div>
                <span className="text-yellow-400 font-bold text-lg">{pot}</span>
              </div>
            )}
            <div className={`px-4 py-2 ${phaseColors[phase]} rounded-full text-white font-bold text-sm shadow-lg`}>
              {phaseLabels[phase] || phase.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Seats - Positioned around the table */}
      <AgentSeat agentId="deepseek" position="top-left" isActive={activeAgentId === 'deepseek'} />
      <AgentSeat agentId="chatgpt" position="top-right" isActive={activeAgentId === 'chatgpt'} />
      <AgentSeat agentId="grok" position="bottom-left" isActive={activeAgentId === 'grok'} />
      <AgentSeat agentId="claude" position="bottom-right" isActive={activeAgentId === 'claude'} />
    </div>
  );
}
