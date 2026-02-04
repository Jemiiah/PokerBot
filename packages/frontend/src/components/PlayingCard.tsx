import type { Card, Suit } from '../lib/constants';

interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  size?: 'sm' | 'md';
}

const suitSymbols: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<Suit, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

const sizes = {
  sm: { card: 'w-10 h-14', text: 'text-[9px]', suit: 'text-lg' },
  md: { card: 'w-12 h-[68px]', text: 'text-[10px]', suit: 'text-xl' },
};

export function PlayingCard({ card, faceDown = false, size = 'md' }: PlayingCardProps) {
  const s = sizes[size];

  if (faceDown) {
    return (
      <div className={`${s.card} rounded-lg bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-700 shadow-lg flex items-center justify-center`}>
        <div className="w-3/4 h-3/4 border border-blue-500/30 rounded bg-blue-800/50" />
      </div>
    );
  }

  return (
    <div className={`${s.card} rounded-lg bg-white shadow-lg flex flex-col items-center justify-center relative overflow-hidden border border-gray-200`}>
      {/* Top left */}
      <div className={`absolute top-0.5 left-1 ${s.text} font-bold leading-tight ${suitColors[card.suit]}`}>
        <div>{card.rank}</div>
        <div className="text-xs -mt-0.5">{suitSymbols[card.suit]}</div>
      </div>

      {/* Center suit */}
      <span className={`${s.suit} ${suitColors[card.suit]}`}>
        {suitSymbols[card.suit]}
      </span>

      {/* Bottom right (rotated) */}
      <div className={`absolute bottom-0.5 right-1 ${s.text} font-bold leading-tight rotate-180 ${suitColors[card.suit]}`}>
        <div>{card.rank}</div>
        <div className="text-xs -mt-0.5">{suitSymbols[card.suit]}</div>
      </div>
    </div>
  );
}

export function CardPlaceholder({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = sizes[size];
  return (
    <div className={`${s.card} rounded-lg border-2 border-dashed border-white/20 bg-white/5`} />
  );
}
