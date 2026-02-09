import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

interface TurnTimerProps {
  className?: string;
  compact?: boolean;
}

export function TurnTimer({ className = '', compact = false }: TurnTimerProps) {
  const { turnStartTime, turnDuration, turnAgentId } = useGameStore();
  const [remaining, setRemaining] = useState<number>(0);
  const [progress, setProgress] = useState<number>(100);

  useEffect(() => {
    if (!turnStartTime || !turnDuration) {
      setRemaining(0);
      setProgress(100);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - turnStartTime;
      const remainingMs = Math.max(0, turnDuration - elapsed);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const progressPercent = (remainingMs / turnDuration) * 100;

      setRemaining(remainingSeconds);
      setProgress(progressPercent);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [turnStartTime, turnDuration]);

  if (!turnAgentId || !turnStartTime || remaining <= 0) {
    return null;
  }

  // Color based on time remaining
  let colorClass = 'text-white';
  let bgClass = 'bg-gray-600';
  let borderClass = 'border-gray-500';

  if (remaining <= 3) {
    colorClass = 'text-red-400';
    bgClass = 'bg-red-500/30';
    borderClass = 'border-red-500';
  } else if (remaining <= 5) {
    colorClass = 'text-yellow-400';
    bgClass = 'bg-yellow-500/30';
    borderClass = 'border-yellow-500';
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className={`w-6 h-6 rounded-full ${bgClass} border ${borderClass} flex items-center justify-center`}>
          <span className={`text-xs font-bold tabular-nums ${colorClass}`}>
            {remaining}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {/* Timer display */}
      <div className={`px-3 py-1.5 rounded-lg ${bgClass} border ${borderClass} flex items-center gap-2`}>
        {/* Hourglass icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 ${colorClass} ${remaining <= 3 ? 'animate-pulse' : ''}`}
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
        <span className={`font-mono text-lg font-bold tabular-nums ${colorClass}`}>
          {remaining}s
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${
            remaining <= 3 ? 'bg-red-500' : remaining <= 5 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
