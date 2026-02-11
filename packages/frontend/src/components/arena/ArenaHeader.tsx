import { useGameStore } from "../../stores/gameStore";
import { useStatsStore } from "../../stores/statsStore";

interface ArenaHeaderProps {
  isConnected: boolean;
  networkName?: string;
  onHowToPlay?: () => void;
}

export function ArenaHeader({ isConnected, networkName, onHowToPlay }: ArenaHeaderProps) {
  const pot = useGameStore((state) => state.pot);
  const phase = useGameStore((state) => state.phase);
  const mode = useGameStore((state) => state.mode);
  const gameHistory = useStatsStore((state) => state.gameHistory);
  const sessionGamesCount = useStatsStore((state) => state.sessionGamesCount);

  // Calculate today's games
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();
  const gamesToday = gameHistory.filter((g) => g.timestamp >= todayTimestamp).length;
  const gamesTotal = sessionGamesCount;

  const formatPot = (amount: number): string => {
    if (mode === "live") {
      const mon = amount / 100000;
      return `${mon.toFixed(3)} MON`;
    }
    return `${amount.toLocaleString()}`;
  };

  const getPhaseColor = (p: string): string => {
    switch (p) {
      case "preflop":
        return "text-blue-400";
      case "flop":
        return "text-green-400";
      case "turn":
        return "text-yellow-400";
      case "river":
        return "text-orange-400";
      case "showdown":
        return "text-purple-400";
      default:
        return "text-gray-400";
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
                <h1 className="text-xl font-bold text-white tracking-tight">
                  AI POKER ARENA
                </h1>
                <p className="text-xs text-gray-400">Powered by Monad</p>
              </div>
            </div>
          </div>

          {/* Center: Game Stats */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider">
                Current Pot
              </div>
              <div className="text-2xl font-bold text-yellow-400 flex items-center gap-1">
                <span className="text-yellow-500">💰</span>
                {formatPot(pot)}
              </div>
            </div>

            <div className="h-10 w-px bg-gray-700" />

            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Phase</div>
              <div className={`text-lg font-bold uppercase ${getPhaseColor(phase)}`}>
                {phase || "Waiting"}
              </div>
            </div>

            <div className="h-10 w-px bg-gray-700" />

            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Games</div>
              <div className="text-lg font-bold text-white">
                {gamesToday}{" "}
                <span className="text-xs text-gray-500 font-normal">today</span>
                <span className="text-gray-600 mx-1">·</span>
                {gamesTotal}{" "}
                <span className="text-xs text-gray-500 font-normal">total</span>
              </div>
            </div>
          </div>

          {/* Right: How to Play */}
          <div className="flex items-center gap-3">
            <button
              onClick={onHowToPlay}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/80 border border-gray-700 hover:border-gray-600 hover:bg-gray-700/80 transition-all text-sm text-gray-300 hover:text-white"
            >
              <span>📖</span>
              <span>How to Play</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
