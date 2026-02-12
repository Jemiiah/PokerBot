import { useGameStore } from "../../stores/gameStore";
import { useStatsStore } from "../../stores/statsStore";
import { useEffect, useState } from "react";

interface ArenaHeaderProps {
  isConnected: boolean;
  networkName?: string;
  onHowToPlay?: () => void;
}

export function ArenaHeader({ onHowToPlay }: ArenaHeaderProps) {
  const pot = useGameStore((state) => state.pot);
  const phase = useGameStore((state) => state.phase);
  const mode = useGameStore((state) => state.mode);
  const gameHistory = useStatsStore((state) => state.gameHistory);
  const sessionGamesCount = useStatsStore((state) => state.sessionGamesCount);

  const [displayPot, setDisplayPot] = useState(pot);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate pot changes
  useEffect(() => {
    if (pot !== displayPot) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayPot(pot);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pot, displayPot]);

  // Calculate today's games
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();
  const gamesToday = gameHistory.filter((g) => g.timestamp >= todayTimestamp).length;
  const gamesTotal = sessionGamesCount;

  const formatPot = (amount: number): string => {
    if (mode === "live") {
      const mon = amount / 100000;
      return `${mon.toFixed(3)} MON`;
    }
    return `${amount.toLocaleString()}`;
  };

  const getPhaseConfig = (p: string) => {
    switch (p) {
      case "preflop":
        return { color: "text-blue-400", bg: "from-blue-500/20 to-blue-600/10", glow: "shadow-blue-500/30", class: "phase-preflop" };
      case "flop":
        return { color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-600/10", glow: "shadow-emerald-500/30", class: "phase-flop" };
      case "turn":
        return { color: "text-yellow-400", bg: "from-yellow-500/20 to-yellow-600/10", glow: "shadow-yellow-500/30", class: "phase-turn" };
      case "river":
        return { color: "text-orange-400", bg: "from-orange-500/20 to-orange-600/10", glow: "shadow-orange-500/30", class: "phase-river" };
      case "showdown":
        return { color: "text-purple-400", bg: "from-purple-500/20 to-purple-600/10", glow: "shadow-purple-500/30", class: "phase-showdown" };
      default:
        return { color: "text-gray-400", bg: "from-gray-500/20 to-gray-600/10", glow: "shadow-gray-500/30", class: "phase-waiting" };
    }
  };

  const phaseConfig = getPhaseConfig(phase);
  const isWaiting = !phase || phase === "waiting";

  return (
    <div className="relative animated-bg border-b border-white/5">
      {/* Subtle animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-monad-primary/5 via-transparent to-monad-secondary/5 opacity-50" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(131, 110, 249, 0.5) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(131, 110, 249, 0.5) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Animated Logo */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity animate-glow-pulse" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-gray-900" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  <span className="bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent">
                    AI POKER
                  </span>
                  <span className="bg-gradient-to-r from-monad-primary to-purple-400 bg-clip-text text-transparent ml-1">
                    ARENA
                  </span>
                </h1>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">Powered by</span>
                  <span className="text-[10px] font-semibold bg-gradient-to-r from-monad-primary to-purple-400 bg-clip-text text-transparent uppercase tracking-widest">
                    Monad
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Game Stats */}
          <div className="flex items-center gap-3">
            {/* Current Pot Card */}
            <div className="stat-card shimmer-effect min-w-[160px]">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                Current Pot
              </div>
              <div className={`text-xl font-bold neon-text-gold flex items-center gap-2 transition-all duration-300 ${isAnimating ? 'scale-110' : 'scale-100'}`}>
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-yellow-500" fill="currentColor">
                  <circle cx="12" cy="12" r="10" className="opacity-20"/>
                  <circle cx="12" cy="12" r="8" />
                  <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#000" fontWeight="bold">$</text>
                </svg>
                <span className="tabular-nums">{formatPot(displayPot)}</span>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

            {/* Phase Card */}
            <div className={`stat-card min-w-[120px] phase-indicator ${phaseConfig.class}`}>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                {!isWaiting && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ color: phaseConfig.color.replace('text-', '').includes('blue') ? '#60a5fa' : phaseConfig.color.replace('text-', '').includes('emerald') ? '#34d399' : phaseConfig.color.replace('text-', '').includes('yellow') ? '#facc15' : phaseConfig.color.replace('text-', '').includes('orange') ? '#fb923c' : '#c084fc' }} />}
                Phase
              </div>
              <div className={`text-lg font-bold uppercase ${phaseConfig.color} transition-all duration-300`}>
                {isWaiting ? (
                  <span className="waiting-dots flex items-center gap-0.5">
                    Waiting
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {phase}
                  </span>
                )}
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

            {/* Games Card */}
            <div className="stat-card min-w-[140px]">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-500" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
                </svg>
                Games
              </div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span className="tabular-nums">{gamesToday}</span>
                <span className="text-xs text-gray-500 font-normal">today</span>
                <span className="text-gray-600">/</span>
                <span className="tabular-nums text-monad-primary">{gamesTotal}</span>
                <span className="text-xs text-gray-500 font-normal">total</span>
              </div>
            </div>
          </div>

          {/* Right: How to Play */}
          <div className="flex items-center gap-3">
            <button
              onClick={onHowToPlay}
              className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105"
            >
              {/* Button gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-monad-primary/20 to-monad-secondary/20 group-hover:from-monad-primary/30 group-hover:to-monad-secondary/30 transition-all" />

              {/* Border glow */}
              <div className="absolute inset-0 rounded-xl border border-monad-primary/30 group-hover:border-monad-primary/50 transition-colors" />

              {/* Icon */}
              <svg viewBox="0 0 24 24" className="relative w-4 h-4 text-monad-primary group-hover:text-white transition-colors" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>

              <span className="relative text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                How to Play
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-monad-primary/50 to-transparent" />
    </div>
  );
}
