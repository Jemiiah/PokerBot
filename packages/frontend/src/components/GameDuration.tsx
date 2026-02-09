import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

interface GameDurationProps {
  className?: string;
}

export function GameDuration({ className = '' }: GameDurationProps) {
  const { gameStartedAt, gameCompletedAt } = useGameStore();
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!gameStartedAt) {
      setElapsed(0);
      return;
    }

    // If game is completed, show final duration
    if (gameCompletedAt) {
      setElapsed(gameCompletedAt - gameStartedAt);
      return;
    }

    // Update every second for running game
    const updateElapsed = () => {
      setElapsed(Date.now() - gameStartedAt);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [gameStartedAt, gameCompletedAt]);

  if (!gameStartedAt) {
    return null;
  }

  // Format as MM:SS
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const isComplete = gameCompletedAt !== null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg">
        {/* Clock icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 ${isComplete ? 'text-green-400' : 'text-gray-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className={`font-mono text-sm font-medium tabular-nums ${isComplete ? 'text-green-400' : 'text-white'}`}>
          {formattedTime}
        </span>
        {isComplete && (
          <span className="text-xs text-green-400 ml-1">FINAL</span>
        )}
      </div>
    </div>
  );
}
