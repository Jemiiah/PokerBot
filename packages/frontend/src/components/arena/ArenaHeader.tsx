import { useGameStore } from '../../stores/gameStore';
import { useStatsStore } from '../../stores/statsStore';

interface ArenaHeaderProps {
  isConnected: boolean;
  networkName?: string;
}

export function ArenaHeader({ isConnected, networkName }: ArenaHeaderProps) {
  const pot = useGameStore((state) => state.pot);
  const phase = useGameStore((state) => state.phase);
  const mode = useGameStore((state) => state.mode);
  const sessionGamesCount = useStatsStore((state) => state.sessionGamesCount);

  const formatPot = (amount: number): string => {
    if (mode === 'live') {
      // Convert from internal chips to MON display
      const mon = amount / 100000; // Adjust based on your chip-to-MON ratio
      return `${mon.toFixed(3)} MON`;
    }
    return `${amount.toLocaleString()}`;
  };

  const getPhaseColor = (p: string): string => {
    switch (p) {
      case 'preflop': return 'text-blue-400';
      case 'flop': return 'text-green-400';
      case 'turn': return 'text-yellow-400';
      case 'river': return 'text-orange-400';
      case 'showdown': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                <span className="text-xl">🎰</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">AI POKER ARENA</h1>
                <p className="text-xs text-gray-400">Powered by Monad</p>
              </div>
            </div>
          </div>

          {/* Center: Prize Pool */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Current Pot</div>
              <div className="text-2xl font-bold text-yellow-400 flex items-center gap-1">
                <span className="text-yellow-500">💰</span>
                {formatPot(pot)}
              </div>
            </div>

            <div className="h-10 w-px bg-gray-700" />

            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Phase</div>
              <div className={`text-lg font-bold uppercase ${getPhaseColor(phase)}`}>
                {phase || 'Waiting'}
              </div>
            </div>

            <div className="h-10 w-px bg-gray-700" />

            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Games Today</div>
              <div className="text-lg font-bold text-white">{sessionGamesCount}</div>
            </div>
          </div>

          {/* Right: Network Status */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              isConnected
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-red-500/20 border border-red-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span className={`text-sm font-medium ${
                isConnected ? 'text-green-400' : 'text-red-400'
              }`}>
                {isConnected ? networkName || 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30">
              <span className="text-sm font-medium text-purple-400">
                {mode === 'live' ? '🔴 LIVE' : '🎮 DEMO'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
