import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { PokerTable } from '../components/PokerTable';
import { Sidebar } from '../components/Sidebar';
import { GameControls } from '../components/GameControls';
import { useLiveGame } from '../hooks/useRealGame';
import { stopGameLoop } from '../services/gameEngine';
import { useGameStore } from '../stores/gameStore';
import { WalletConnect } from '../components/WalletConnect';
import { monadTestnet } from '../config/chains';

export type GameMode = 'demo' | 'live';

export function HomePage() {
  const [mode, setMode] = useState<GameMode>('live');
  const { isConnected: isWalletConnected, chain } = useAccount();
  const isCorrectNetwork = chain?.id === monadTestnet.id;
  const canWatchLive = isWalletConnected && isCorrectNetwork;

  // Sync store mode on initial mount to ensure thoughts are processed
  useEffect(() => {
    useGameStore.getState().setMode('live');
  }, []);

  // Connect to live game when in live mode AND wallet is connected
  const liveGame = useLiveGame(mode === 'live' && canWatchLive);

  const handleModeChange = (newMode: GameMode) => {
    // Stop demo game loop if switching away from demo
    if (mode === 'demo' && newMode === 'live') {
      stopGameLoop();
    }

    // Update the store mode first to ensure proper state separation
    useGameStore.getState().setMode(newMode);

    setMode(newMode);
  };

  return (
    <div className="h-screen flex bg-[#0a0e13]">
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Controls */}
        <GameControls
          mode={mode}
          onModeChange={handleModeChange}
          isConnected={liveGame.isConnected}
          isLoading={liveGame.isLoading}
          connectionError={liveGame.error}
          currentGameId={liveGame.currentGameId}
        />

        {/* Table Area */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          {mode === 'live' && !canWatchLive ? (
            /* Wallet connection required for live mode */
            <div className="flex flex-col items-center justify-center gap-6 p-8 bg-gray-900/80 rounded-2xl border border-gray-700 max-w-md">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet to Watch</h2>
                <p className="text-gray-400">
                  Connect your wallet to Monad Testnet to watch live AI poker games.
                  Games will start once a spectator is connected.
                </p>
              </div>
              <WalletConnect />
              <p className="text-xs text-gray-500 text-center">
                Your wallet is used to verify you're a real spectator.
                No transactions are required to watch games.
              </p>
            </div>
          ) : (
            <PokerTable
              mode={mode}
              activePlayers={mode === 'live' ? liveGame.activePlayers : undefined}
              currentGameId={mode === 'live' ? liveGame.currentGameId : null}
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <Sidebar
          mode={mode}
          gameId={liveGame.currentGameId}
          gamePhase={liveGame.phase}
          isConnected={liveGame.isConnected}
        />
      </div>
    </div>
  );
}
