import { useStatsStore } from '../stores/statsStore';

interface SessionStatsProps {
  className?: string;
}

export function SessionStats({ className = '' }: SessionStatsProps) {
  const sessionGamesCount = useStatsStore((state) => state.sessionGamesCount);
  const sessionStartTime = useStatsStore((state) => state.sessionStartTime);
  const gameHistory = useStatsStore((state) => state.gameHistory);
  const resetSession = useStatsStore((state) => state.resetSession);

  const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
  const hours = Math.floor(sessionDuration / 3600);
  const minutes = Math.floor((sessionDuration % 3600) / 60);

  const formatDuration = (): string => {
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Calculate session pot total
  const sessionTotalPot = gameHistory
    .filter((game) => game.timestamp >= sessionStartTime)
    .reduce((sum, game) => {
      const potMon = Number(BigInt(game.pot)) / 1e18;
      return sum + potMon;
    }, 0);

  // Calculate average game duration
  const sessionGames = gameHistory.filter((game) => game.timestamp >= sessionStartTime);
  const avgGameDuration = sessionGames.length > 0
    ? sessionGames.reduce((sum, game) => sum + game.duration, 0) / sessionGames.length
    : 0;

  return (
    <div className={`bg-gray-900/80 rounded-xl border border-gray-800 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <span>📊</span> Session Stats
        </h3>
        <button
          onClick={resetSession}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          title="Reset session"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Games</div>
          <div className="text-lg font-bold text-white">{sessionGamesCount}</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Duration</div>
          <div className="text-lg font-bold text-white">{formatDuration()}</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Total Pot</div>
          <div className="text-lg font-bold text-green-400">
            {sessionTotalPot.toFixed(3)} MON
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Avg Duration</div>
          <div className="text-lg font-bold text-white">
            {avgGameDuration > 0 ? `${Math.floor(avgGameDuration)}s` : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
