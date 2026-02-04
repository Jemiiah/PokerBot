import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useGameStore } from '../stores/gameStore';
import { startGameLoop, stopGameLoop, pauseGame, resumeGame } from '../services/gameEngine';

export function GameControls() {
  const { isRunning, isPaused, handNumber } = useGameStore();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const handleStartGame = () => {
    if (!isConnected) return;
    startGameLoop();
  };

  const handleConnect = () => {
    // Use the first available connector (injected - OKX/MetaMask)
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-900/80 border-b border-gray-700">
      {/* Left: Game Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Status:</span>
          <span
            className={`px-2 py-1 rounded text-sm font-medium ${
              isRunning
                ? isPaused
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-green-500/20 text-green-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped'}
          </span>
        </div>
        {handNumber > 0 && (
          <div className="text-gray-400">
            Hand #{handNumber}
          </div>
        )}
      </div>

      {/* Center: Controls */}
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <div className="text-gray-500 text-sm">
            Connect wallet to start game
          </div>
        ) : !isRunning ? (
          <button
            onClick={handleStartGame}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <span>▶</span>
            Start Game
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={resumeGame}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <span>▶</span>
                Resume
              </button>
            ) : (
              <button
                onClick={pauseGame}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <span>⏸</span>
                Pause
              </button>
            )}
            <button
              onClick={stopGameLoop}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <span>⏹</span>
              Stop
            </button>
          </>
        )}
      </div>

      {/* Right: Wallet */}
      {isConnected ? (
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-white text-sm font-mono">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </button>
      ) : (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isPending || connectors.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            {isPending ? 'Connecting...' : connectors.length === 0 ? 'No Wallet Found' : 'Connect Wallet'}
          </button>
          {error && (
            <span className="text-red-400 text-xs max-w-48 truncate">{error.message}</span>
          )}
        </div>
      )}
    </div>
  );
}
