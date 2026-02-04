import type { GamePhase } from '../lib/constants';

interface PotDisplayProps {
  pot: number;
  phase: GamePhase;
}

const phaseLabels: Record<GamePhase, string> = {
  waiting: 'WAITING',
  preflop: 'PREFLOP',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
  showdown: 'SHOWDOWN',
};

export function PotDisplay({ pot, phase }: PotDisplayProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Pot */}
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/90 rounded-lg text-black font-bold">
        <span>🪙</span>
        <span>Pot: {pot}</span>
      </div>

      {/* Phase */}
      <div className="px-4 py-2 bg-blue-600/90 rounded-lg text-white font-bold uppercase tracking-wider">
        {phaseLabels[phase]}
      </div>
    </div>
  );
}
