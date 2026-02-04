export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HoleCards = [Card, Card];
export type CommunityCards = Card[];
export type Deck = Card[];

// Numeric representation for on-chain encoding
// Card value = rank * 4 + suit (0-51)
export type CardIndex = number;

export interface HandRank {
  rank: HandRankType;
  value: number; // For comparing same-rank hands
  cards: Card[]; // The 5 cards making the hand
  kickers: Card[]; // Remaining cards for tiebreakers
}

export type HandRankType =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_of_a_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_of_a_kind'
  | 'straight_flush'
  | 'royal_flush';

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  'T': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

export const SUIT_VALUES: Record<Suit, number> = {
  'spades': 0,
  'hearts': 1,
  'diamonds': 2,
  'clubs': 3,
};

export const HAND_RANK_VALUES: Record<HandRankType, number> = {
  'high_card': 1,
  'pair': 2,
  'two_pair': 3,
  'three_of_a_kind': 4,
  'straight': 5,
  'flush': 6,
  'full_house': 7,
  'four_of_a_kind': 8,
  'straight_flush': 9,
  'royal_flush': 10,
};
