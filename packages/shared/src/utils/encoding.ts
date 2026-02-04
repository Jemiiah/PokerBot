import type { Card, Rank, Suit, CardIndex } from '../types/cards.js';
import { RANK_VALUES } from '../types/cards.js';
import { RANKS, SUITS } from '../constants/poker.js';

/**
 * Convert a Card to its numeric index (0-51)
 * Index = rank_index * 4 + suit_index
 */
export function cardToIndex(card: Card): CardIndex {
  const rankIndex = RANKS.indexOf(card.rank);
  const suitIndex = SUITS.indexOf(card.suit);
  return rankIndex * 4 + suitIndex;
}

/**
 * Convert a numeric index (0-51) to a Card
 */
export function indexToCard(index: CardIndex): Card {
  if (index < 0 || index > 51) {
    throw new Error(`Invalid card index: ${index}`);
  }
  const rankIndex = Math.floor(index / 4);
  const suitIndex = index % 4;
  return {
    rank: RANKS[rankIndex],
    suit: SUITS[suitIndex],
  };
}

/**
 * Convert a card to string notation (e.g., "As" for Ace of spades)
 */
export function cardToString(card: Card): string {
  const suitChar = card.suit[0];
  return `${card.rank}${suitChar}`;
}

/**
 * Parse a string notation to a Card (e.g., "As" -> Ace of spades)
 */
export function stringToCard(str: string): Card {
  if (str.length !== 2) {
    throw new Error(`Invalid card string: ${str}`);
  }
  const rank = str[0] as Rank;
  const suitChar = str[1].toLowerCase();

  const suitMap: Record<string, Suit> = {
    's': 'spades',
    'h': 'hearts',
    'd': 'diamonds',
    'c': 'clubs',
  };

  const suit = suitMap[suitChar];
  if (!suit) {
    throw new Error(`Invalid suit character: ${suitChar}`);
  }

  if (!RANKS.includes(rank)) {
    throw new Error(`Invalid rank: ${rank}`);
  }

  return { rank, suit };
}

/**
 * Convert hole cards to standard notation (e.g., "AKs" for suited, "AKo" for offsuit)
 */
export function holeCardsToNotation(cards: [Card, Card]): string {
  const [c1, c2] = cards;
  const r1 = RANK_VALUES[c1.rank];
  const r2 = RANK_VALUES[c2.rank];

  // Sort by rank (higher first)
  const [high, low] = r1 >= r2 ? [c1, c2] : [c2, c1];
  const suited = high.suit === low.suit;

  if (high.rank === low.rank) {
    return `${high.rank}${low.rank}`; // Pocket pair
  }

  return `${high.rank}${low.rank}${suited ? 's' : 'o'}`;
}

/**
 * Generate a full deck of 52 cards
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle
 */
export function shuffleDeck(deck: Card[], seed?: number): Card[] {
  const shuffled = [...deck];
  const random = seed !== undefined ? seededRandom(seed) : Math.random;

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Simple seeded PRNG (for deterministic shuffling)
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.imul(48271, s) | 0 % 2147483647;
    return (s & 2147483647) / 2147483648;
  };
}

/**
 * Convert bytes32 to hex string
 */
export function bytes32ToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hex string to bytes32
 */
export function hexToBytes32(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length !== 64) {
    throw new Error('Invalid bytes32 hex string');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
