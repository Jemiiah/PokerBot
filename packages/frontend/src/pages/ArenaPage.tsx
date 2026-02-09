import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { PokerTable } from '../components/PokerTable';
import { ArenaHeader, ArenaLeaderboard, ArenaGameFeed, ArenaAgentQueue } from '../components/arena';
import { useLiveGame } from '../hooks/useRealGame';
import { stopGameLoop } from '../services/gameEngine';
import { useGameStore } from '../stores/gameStore';
import { WalletConnect } from '../components/WalletConnect';
import { monadTestnet } from '../config/chains';

export type GameMode = 'demo' | 'live';

export function ArenaPage() {
  const [mode, setMode] = useState<GameMode>('live');
  const { isConnected: isWalletConnected, chain } = useAccount();
  const isCorrectNetwork = chain?.id === monadTestnet.id;
  const canWatchLive = isWalletConnected && isCorrectNetwork;

  // Sync store mode on initial mount
  useEffect(() => {
    useGameStore.getState().setMode('live');
  }, []);

  // Connect to live game
  const liveGame = useLiveGame(mode === 'live' && canWatchLive);

  const handleModeChange = (newMode: GameMode) => {
    if (mode === 'demo' && newMode === 'live') {
      stopGameLoop();
    }
    useGameStore.getState().setMode(newMode);
    setMode(newMode);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0e13] overflow-hidden">
      {/* Arena Header */}
      <ArenaHeader
        isConnected={liveGame.isConnected}
        networkName={isCorrectNetwork ? 'Monad Testnet' : undefined}
      />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Queue & Info */}
        <div className="w-72 flex-shrink-0 p-4 flex flex-col gap-4 overflow-y-auto border-r border-gray-800">
          <ArenaAgentQueue
            queuedAgents={liveGame.queuedAgents || []}
            currentPlayers={liveGame.activePlayers?.map(id => ({
              name: id,
              address: ''
            }))}
            isMatchmaking={liveGame.isMatchmaking || false}
          />

          {/* Mode Toggle */}
          <div className="bg-gray-900/90 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
              Game Mode
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange('live')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'live'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800'
                }`}
              >
                🔴 Live
              </button>
              <button
                onClick={() => handleModeChange('demo')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'demo'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800'
                }`}
              >
                🎮 Demo
              </button>
            </div>
          </div>
        </div>

        {/* Center - Poker Table */}
        <div className="flex-1 flex items-center justify-center p-6 min-w-0">
          {mode === 'live' && !canWatchLive ? (
            <div className="flex flex-col items-center justify-center gap-6 p-8 bg-gray-900/90 rounded-2xl border border-gray-700 max-w-md">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <span className="text-4xl">🎰</span>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Enter the Arena</h2>
                <p className="text-gray-400">
                  Connect your wallet to Monad Testnet to watch live AI poker battles.
                </p>
              </div>
              <WalletConnect />
              <p className="text-xs text-gray-500 text-center">
                Free to watch. No transactions required.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-4xl">
              <PokerTable
                mode={mode}
                activePlayers={mode === 'live' ? liveGame.activePlayers : undefined}
                currentGameId={mode === 'live' ? liveGame.currentGameId : null}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Leaderboard & Feed */}
        <div className="w-80 flex-shrink-0 p-4 flex flex-col gap-4 overflow-hidden border-l border-gray-800">
          <ArenaLeaderboard />
          <div className="flex-1 min-h-0">
            <ArenaGameFeed />
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="flex-shrink-0 bg-gray-900/80 border-t border-gray-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>AI Poker Arena v1.0</span>
            <span className="text-gray-700">|</span>
            <span>Built on Monad</span>
          </div>
          <div className="flex items-center gap-4">
            {liveGame.currentGameId && (
              <span className="text-gray-400">
                Game: {liveGame.currentGameId.slice(0, 10)}...
              </span>
            )}
            <span className={liveGame.isConnected ? 'text-green-400' : 'text-red-400'}>
              {liveGame.isConnected ? '● Connected' : '○ Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
