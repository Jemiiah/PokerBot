import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useGameStore } from '../stores/gameStore';
import { startGameLoop, stopGameLoop, pauseGame, resumeGame } from '../services/gameEngine';
import type { GameMode } from '../pages/HomePage';

interface GameControlsProps {
  mode?: GameMode;
  onModeChange?: (mode: GameMode) => void;
  selectedGameId?: string | null;
  onDeselectGame?: () => void;
  isConnected?: boolean;
  isLoading?: boolean;
  connectionError?: string | null;
}

export function GameControls({
  mode = 'demo',
  onModeChange,
  selectedGameId,
  onDeselectGame,
  isConnected: coordinatorConnected,
  isLoading: coordinatorLoading,
  connectionError,
}: GameControlsProps) {
  const { isRunning, isPaused, handNumber } = useGameStore();
  const { address, isConnected: walletConnected } = useAccount();
  const { connect, connectors, isPending, error: walletError } = useConnect();
  const { disconnect } = useDisconnect();

  const isLiveMode = mode === 'live';

  const handleStartGame = () => {
    if (!walletConnected) return;
    startGameLoop();
  };

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  const shortGameId = selectedGameId
    ? `${selectedGameId.slice(0, 6)}...${selectedGameId.slice(-4)}`
    : null;

  return (
    <div className="flex items-center justify-between p-4 bg-gray-900/80 border-b border-gray-700">
      {/* Left: Game Info / Mode Toggle */}
      <div className="flex items-center gap-4">
        {/* Mode Toggle */}
        <div className="flex items-center bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => onModeChange?.('demo')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !isLiveMode
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Demo
          </button>
          <button
            onClick={() => onModeChange?.('live')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isLiveMode
                ? 'bg-green-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Live
          </button>
        </div>

        {/* Status Indicator */}
        {isLiveMode ? (
          <div className="flex items-center gap-3">
            {/* Live Badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-900/30 border border-red-800">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-sm font-medium">LIVE</span>
            </div>

            {/* Connection Status */}
            {coordinatorLoading ? (
              <span className="text-gray-500 text-sm">Connecting...</span>
            ) : coordinatorConnected ? (
              <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Connected
              </div>
            ) : connectionError ? (
              <span className="text-red-400 text-sm" title={connectionError}>
                Connection error
              </span>
            ) : null}

            {/* Game ID */}
            {selectedGameId && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span>Game:</span>
                <span className="font-mono text-gray-300">{shortGameId}</span>
                <button
                  onClick={onDeselectGame}
                  className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Stop watching"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ) : (
          // Demo mode status
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
        )}
      </div>

      {/* Center: Controls (Demo mode only) */}
      <div className="flex items-center gap-2">
        {isLiveMode ? (
          // Live mode - just show watching indicator or prompt
          !selectedGameId && (
            <div className="text-gray-500 text-sm">
              Select a game to watch
            </div>
          )
        ) : !walletConnected ? (
          <div className="text-gray-500 text-sm">
            Connect wallet to start demo
          </div>
        ) : !isRunning ? (
          <button
            onClick={handleStartGame}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <span>▶</span>
            Start Demo
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
      {walletConnected ? (
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
          {walletError && (
            <span className="text-red-400 text-xs max-w-48 truncate">{walletError.message}</span>
          )}
        </div>
      )}
    </div>
  );
}
