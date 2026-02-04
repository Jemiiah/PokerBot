import { useState } from 'react';
import { PokerTable } from '../components/PokerTable';
import { Sidebar } from '../components/Sidebar';
import { GameControls } from '../components/GameControls';
import { GameSelector } from '../components/GameSelector';
import { useRealGame } from '../hooks/useRealGame';

export type GameMode = 'demo' | 'live';

export function HomePage() {
  const [mode, setMode] = useState<GameMode>('demo');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Connect to real game when in live mode with a selected game
  const realGame = useRealGame(mode === 'live' ? selectedGameId : null);

  const handleModeChange = (newMode: GameMode) => {
    setMode(newMode);
    if (newMode === 'demo') {
      setSelectedGameId(null);
    }
  };

  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
  };

  // Show game selector when in live mode with no game selected
  const showGameSelector = mode === 'live' && !selectedGameId;

  return (
    <div className="h-screen flex bg-[#0a0e13]">
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Controls */}
        <GameControls
          mode={mode}
          onModeChange={handleModeChange}
          selectedGameId={selectedGameId}
          onDeselectGame={() => setSelectedGameId(null)}
          isConnected={realGame.isConnected}
          isLoading={realGame.isLoading}
          connectionError={realGame.error}
        />

        {/* Table Area or Game Selector */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          {showGameSelector ? (
            <div className="w-full max-w-lg">
              <GameSelector
                onSelectGame={handleSelectGame}
                selectedGameId={selectedGameId}
              />
            </div>
          ) : (
            <PokerTable />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <Sidebar />
      </div>
    </div>
  );
}
