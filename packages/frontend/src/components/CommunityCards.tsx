import type { Card } from '../lib/constants';
import { PlayingCard, CardPlaceholder } from './PlayingCard';

interface CommunityCardsProps {
  cards: Card[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index}>
          {cards[index] ? (
            <PlayingCard card={cards[index]} />
          ) : (
            <CardPlaceholder />
          )}
        </div>
      ))}
    </div>
  );
}
