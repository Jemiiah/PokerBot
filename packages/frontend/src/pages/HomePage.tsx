import { useState } from 'react';
import { PokerTable } from '../components/PokerTable';
import { Sidebar } from '../components/Sidebar';
import { GameControls } from '../components/GameControls';
import { useLiveGame } from '../hooks/useRealGame';
import { stopGameLoop } from '../services/gameEngine';
import { useGameStore } from '../stores/gameStore';

export type GameMode = 'demo' | 'live';

export function HomePage() {
  const [mode, setMode] = useState<GameMode>('live');

  // Connect to live game when in live mode (auto-discovers active game)
  const liveGame = useLiveGame(mode === 'live');

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
          <PokerTable
            mode={mode}
            activePlayers={mode === 'live' ? liveGame.activePlayers : undefined}
            currentGameId={mode === 'live' ? liveGame.currentGameId : null}
          />
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
