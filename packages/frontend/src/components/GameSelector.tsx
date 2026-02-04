import { useState, useEffect } from 'react';
import { useActiveGames, useGameState } from '../hooks/usePokerContract';
import { formatEther } from 'viem';

interface GameSelectorProps {
  onSelectGame: (gameId: string) => void;
  selectedGameId: string | null;
}

// Phase names for display
const PHASE_NAMES: Record<number, string> = {
  0: 'Waiting',
  1: 'Pre-flop',
  2: 'Flop',
  3: 'Turn',
  4: 'River',
  5: 'Showdown',
  6: 'Complete',
};

export function GameSelector({ onSelectGame, selectedGameId }: GameSelectorProps) {
  const { data: activeGames, isLoading, error, refetch } = useActiveGames();
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="bg-[#141a22] rounded-lg p-6 border border-[#2a3441]">
        <div className="flex items-center justify-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          Loading games...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#141a22] rounded-lg p-6 border border-red-900/50">
        <div className="text-red-400 text-center">
          <p className="font-medium">Failed to load games</p>
          <p className="text-sm text-red-500 mt-1">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const games = (activeGames as `0x${string}`[]) || [];

  if (games.length === 0) {
    return (
      <div className="bg-[#141a22] rounded-lg p-6 border border-[#2a3441]">
        <div className="text-center">
          <div className="text-4xl mb-3">🎰</div>
          <p className="text-gray-300 font-medium">No active games</p>
          <p className="text-gray-500 text-sm mt-1">
            Waiting for agents to create or join games...
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-[#2a3441] hover:bg-[#3a4451] rounded-lg text-sm text-gray-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#141a22] rounded-lg border border-[#2a3441] overflow-hidden">
      <div className="p-4 border-b border-[#2a3441] flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Active Games</h3>
        <span className="text-sm text-gray-400">{games.length} game{games.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="divide-y divide-[#2a3441] max-h-[400px] overflow-y-auto">
        {games.map((gameId) => (
          <GameItem
            key={gameId}
            gameId={gameId}
            isSelected={selectedGameId === gameId}
            isExpanded={expandedGame === gameId}
            onSelect={() => onSelectGame(gameId)}
            onToggleExpand={() =>
              setExpandedGame(expandedGame === gameId ? null : gameId)
            }
          />
        ))}
      </div>
    </div>
  );
}

interface GameItemProps {
  gameId: `0x${string}`;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}

function GameItem({
  gameId,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: GameItemProps) {
  const { data: gameState, isLoading } = useGameState(gameId);

  const shortId = `${gameId.slice(0, 6)}...${gameId.slice(-4)}`;

  if (isLoading || !gameState) {
    return (
      <div className="p-4 flex items-center gap-3 text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-sm">{shortId}</span>
      </div>
    );
  }

  const phase = PHASE_NAMES[gameState.phase] || 'Unknown';
  const pot = formatEther(gameState.pot);
  const player1 = gameState.players[0].wallet;
  const player2 = gameState.players[1].wallet;
  const hasPlayer2 = player2 !== '0x0000000000000000000000000000000000000000';

  // Status badge color
  const getStatusColor = () => {
    if (gameState.phase === 0) return 'bg-yellow-900/50 text-yellow-400';
    if (gameState.phase === 6) return 'bg-gray-700 text-gray-400';
    return 'bg-green-900/50 text-green-400';
  };

  return (
    <div
      className={`
        transition-colors cursor-pointer
        ${isSelected ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-[#1a222c]'}
      `}
    >
      <div className="p-4 flex items-center justify-between" onClick={onSelect}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-mono text-sm text-gray-300">{shortId}</span>
            <span className="text-xs text-gray-500">
              {hasPlayer2 ? '2 players' : '1 player (waiting)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-gray-300">{pot} ETH</div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor()}`}>
              {phase}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 text-sm">
          <div className="bg-[#0a0e13] rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Game ID:</span>
              <span className="font-mono text-xs text-gray-400">{gameId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Player 1:</span>
              <span className="font-mono text-xs text-gray-400">
                {player1.slice(0, 8)}...{player1.slice(-6)}
              </span>
            </div>
            {hasPlayer2 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Player 2:</span>
                <span className="font-mono text-xs text-gray-400">
                  {player2.slice(0, 8)}...{player2.slice(-6)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Current Bet:</span>
              <span className="text-gray-400">{formatEther(gameState.currentBet)} ETH</span>
            </div>
            <div className="pt-2">
              <button
                onClick={onSelect}
                className={`
                  w-full py-2 rounded-lg text-sm font-medium transition-colors
                  ${isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a3441] text-gray-300 hover:bg-[#3a4451]'
                  }
                `}
              >
                {isSelected ? 'Watching' : 'Watch Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
