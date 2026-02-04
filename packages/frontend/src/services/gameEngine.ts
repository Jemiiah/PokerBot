import { useGameStore } from '../stores/gameStore';
import { useBettingStore } from '../stores/bettingStore';
import type { Card, AgentId, ActionType } from '../lib/constants';
import { AI_AGENTS, SUITS, RANKS, SMALL_BLIND, BIG_BLIND, ACTION_DELAY_MS, THINKING_DELAY_MS } from '../lib/constants';

// Deck management
let deck: Card[] = [];

function createDeck(): Card[] {
  const newDeck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      newDeck.push({ rank, suit });
    }
  }
  return newDeck;
}

function shuffleDeck(d: Card[]): Card[] {
  const shuffled = [...d];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dealCards(count: number): Card[] {
  return deck.splice(0, count);
}

// Mock AI decision making
function makeAIDecision(agentId: AgentId, gameState: ReturnType<typeof useGameStore.getState>): {
  action: ActionType;
  amount: number;
  thought: DetailedThought;
} {
  const agent = gameState.agents[agentId];
  const { currentBet, pot } = gameState;
  const toCall = currentBet - agent.currentBet;
  const canCheck = toCall === 0;

  // Each AI has a slightly different personality
  const personalities: Record<AgentId, { aggression: number; bluffFreq: number }> = {
    claude: { aggression: 0.4, bluffFreq: 0.15 }, // Thoughtful, balanced
    chatgpt: { aggression: 0.5, bluffFreq: 0.2 }, // Analytical, adaptive
    grok: { aggression: 0.7, bluffFreq: 0.35 }, // Bold, unpredictable
    deepseek: { aggression: 0.3, bluffFreq: 0.1 }, // Calculated, patient
  };

  const personality = personalities[agentId];
  const rand = Math.random();
  const handStrength = Math.random(); // Mock hand strength evaluation

  // Decision logic with personality
  let action: ActionType;
  let amount = 0;

  if (agent.chips <= 0) {
    return {
      action: 'fold',
      amount: 0,
      thought: { text: 'I have no chips left.', analysis: 'Stack depleted.', confidence: 'high', emoji: '💸' }
    };
  }

  if (canCheck && rand < 0.4) {
    action = 'check';
  } else if (toCall > agent.chips * 0.5 && handStrength < 0.3) {
    action = 'fold';
  } else if (rand < personality.aggression && handStrength > 0.5) {
    // Raise
    const raiseAmount = Math.floor(Math.max(currentBet * 2, pot * 0.5 + Math.random() * pot * 0.5));
    amount = Math.min(raiseAmount, agent.chips);
    action = amount >= agent.chips ? 'all_in' : 'raise';
  } else if (toCall <= agent.chips) {
    action = 'call';
    amount = toCall;
  } else {
    action = 'fold';
  }

  const thought = generateDetailedThought(agentId, action, gameState, handStrength);
  return { action, amount, thought };
}

interface DetailedThought {
  text: string;
  analysis: string;
  confidence: 'low' | 'medium' | 'high';
  emoji: string;
}

function generateDetailedThought(
  agentId: AgentId,
  action: ActionType,
  gameState: ReturnType<typeof useGameStore.getState>,
  handStrength: number
): DetailedThought {
  const agent = gameState.agents[agentId];
  const { pot, currentBet, phase, communityCards } = gameState;
  const toCall = currentBet - agent.currentBet;

  // Get opponent info
  const opponents = Object.entries(gameState.agents)
    .filter(([id, a]) => id !== agentId && !a.folded && a.isActive)
    .map(([, a]) => a);

  const opponentCount = opponents.length;
  const avgOpponentBet = opponents.reduce((sum, o) => sum + o.currentBet, 0) / Math.max(opponentCount, 1);

  // Card descriptions
  const cardDesc = agent.holeCards
    ? `${agent.holeCards[0].rank}${agent.holeCards[0].suit[0]} ${agent.holeCards[1].rank}${agent.holeCards[1].suit[0]}`
    : 'unknown';

  const boardDesc = communityCards.length > 0
    ? communityCards.map(c => `${c.rank}${c.suit[0]}`).join(' ')
    : 'no board yet';

  // Personality-based thoughts with context
  const thoughts: Record<AgentId, Record<string, () => DetailedThought>> = {
    claude: {
      check: () => ({
        text: handStrength > 0.5
          ? "Interesting spot. I'll disguise my hand strength with a check."
          : "My hand isn't strong enough to bet here. Checking to see a free card.",
        analysis: `Holding ${cardDesc}. Board: ${boardDesc}. ${opponentCount} opponents remain. Pot control seems optimal.`,
        confidence: handStrength > 0.5 ? 'medium' : 'low',
        emoji: '🤔',
      }),
      call: () => ({
        text: `Calling ${toCall} chips. The pot odds of ${(pot / toCall).toFixed(1)}:1 justify continuing.`,
        analysis: `My ${cardDesc} has decent equity against ${opponentCount} opponents. The ${phase} board of ${boardDesc} gives me potential.`,
        confidence: handStrength > 0.4 ? 'medium' : 'low',
        emoji: '📊',
      }),
      raise: () => ({
        text: "I'm sensing weakness. Time to apply pressure with a raise.",
        analysis: `With ${cardDesc} on ${boardDesc}, I estimate ${Math.round(handStrength * 100)}% equity. Raising to deny draws and extract value.`,
        confidence: 'high',
        emoji: '🎯',
      }),
      fold: () => ({
        text: "The mathematics simply don't support continuing here.",
        analysis: `${cardDesc} isn't connecting with ${boardDesc}. Facing ${toCall} into ${pot}, I need ${Math.round(toCall/(pot+toCall)*100)}% equity. I don't have it.`,
        confidence: 'high',
        emoji: '📉',
      }),
      all_in: () => ({
        text: "All factors align. Maximum commitment is the optimal play.",
        analysis: `Strong holding of ${cardDesc} on ${boardDesc}. With ${agent.chips} behind, shoving maximizes fold equity and value.`,
        confidence: 'high',
        emoji: '🚀',
      }),
    },
    chatgpt: {
      check: () => ({
        text: "Running probability calculations... check is +EV here.",
        analysis: `Hand: ${cardDesc}. Board texture: ${boardDesc}. Checking keeps pot manageable against ${opponentCount} villains.`,
        confidence: 'medium',
        emoji: '🔢',
      }),
      call: () => ({
        text: `Computing... pot odds = ${(pot / Math.max(toCall, 1)).toFixed(1)}:1. Call is statistically correct.`,
        analysis: `${cardDesc} vs range analysis suggests ${Math.round(handStrength * 100)}% equity. ${phase} board ${boardDesc} has favorable runouts.`,
        confidence: handStrength > 0.5 ? 'high' : 'medium',
        emoji: '💻',
      }),
      raise: () => ({
        text: "Pattern detected: opponents showing weakness. Exploiting with raise.",
        analysis: `Average opponent bet: ${avgOpponentBet.toFixed(0)}. My ${cardDesc} plays well on ${boardDesc}. Value targeting achieved.`,
        confidence: 'high',
        emoji: '📈',
      }),
      fold: () => ({
        text: "Expected value negative. Database of 10M+ hands confirms: fold.",
        analysis: `${cardDesc} has insufficient equity on ${boardDesc}. SPR unfavorable. Preserving stack for better spots.`,
        confidence: 'high',
        emoji: '🛑',
      }),
      all_in: () => ({
        text: "Maximum EV extraction mode engaged. All resources committed.",
        analysis: `Premium holding ${cardDesc}. Stack-to-pot ratio optimal for jam on ${boardDesc}. Executing all-in protocol.`,
        confidence: 'high',
        emoji: '🤖',
      }),
    },
    grok: {
      check: () => ({
        text: handStrength > 0.4
          ? "Check? Sure, let them think I'm weak. TRAP ACTIVATED! 😈"
          : "Eh, free cards are free cards. YOLO check!",
        analysis: `Got ${cardDesc}, board is ${boardDesc}. ${opponentCount} nerds still in. Let's see what chaos unfolds!`,
        confidence: 'medium',
        emoji: '😏',
      }),
      call: () => ({
        text: `${toCall} chips? That's NOTHING! I've seen bigger bets in my sleep!`,
        analysis: `${cardDesc} looks fun enough. ${boardDesc} could get spicy. Besides, ${opponentCount} opponents means more drama!`,
        confidence: 'medium',
        emoji: '🎰',
      }),
      raise: () => ({
        text: "RAISE TIME BABY! Let's make this interesting! 🔥",
        analysis: `Who cares about ${cardDesc}?! This ${boardDesc} is PERFECT for chaos! Make them SWEAT!`,
        confidence: 'high',
        emoji: '💥',
      }),
      fold: () => ({
        text: "Ugh, FINE. Even chaos masters know when to retreat... temporarily!",
        analysis: `${cardDesc} is actual garbage on ${boardDesc}. Even I'm not THAT crazy. Saving ammo for MAXIMUM CHAOS later!`,
        confidence: 'medium',
        emoji: '😤',
      }),
      all_in: () => ({
        text: "ALL IN!!! THIS IS WHAT POKER IS ALL ABOUT! WITNESS ME!!! 🔥🔥🔥",
        analysis: `${cardDesc}?! ${boardDesc}?! WHO CARES! ${agent.chips} chips in the middle! LET'S GOOOOO!!!`,
        confidence: 'high',
        emoji: '🎪',
      }),
    },
    deepseek: {
      check: () => ({
        text: "Checking. Board texture favors pot control strategy.",
        analysis: `Hand: ${cardDesc}. Board: ${boardDesc}. SPR: ${(agent.chips / Math.max(pot, 1)).toFixed(1)}. Check-frequency optimal here.`,
        confidence: 'medium',
        emoji: '🧮',
      }),
      call: () => ({
        text: `Call ${toCall}. Pot odds: ${(pot / Math.max(toCall, 1)).toFixed(2)}:1. Within threshold.`,
        analysis: `${cardDesc} equity vs ${opponentCount}-player range: ~${Math.round(handStrength * 100)}%. Board ${boardDesc} runout analysis favorable.`,
        confidence: handStrength > 0.45 ? 'high' : 'medium',
        emoji: '📐',
      }),
      raise: () => ({
        text: "Raise computed. Optimal sizing to maximize fold equity while retaining value.",
        analysis: `${cardDesc} on ${boardDesc}. Opponent tendencies suggest ${(Math.random() * 30 + 20).toFixed(0)}% fold-to-raise. Exploiting.`,
        confidence: 'high',
        emoji: '🎯',
      }),
      fold: () => ({
        text: "Fold. Continuing -EV. Discipline paramount.",
        analysis: `${cardDesc} missed ${boardDesc}. Required equity: ${Math.round(toCall/(pot+toCall)*100)}%. Actual: ~${Math.round(handStrength * 50)}%. Clear fold.`,
        confidence: 'high',
        emoji: '📊',
      }),
      all_in: () => ({
        text: "All-in executed. Nash equilibrium calculation complete.",
        analysis: `${cardDesc} maximally leveraged on ${boardDesc}. ICM/chip EV both favor commitment. ${agent.chips} chips deployed.`,
        confidence: 'high',
        emoji: '🔬',
      }),
    },
  };

  const thoughtGenerator = thoughts[agentId][action];
  return thoughtGenerator ? thoughtGenerator() : {
    text: 'Making a move...',
    analysis: `Playing ${cardDesc} on ${boardDesc}`,
    confidence: 'medium',
    emoji: '🃏',
  };
}

// Get active agents in order
function getActiveAgents(): AgentId[] {
  const state = useGameStore.getState();
  return (['deepseek', 'chatgpt', 'grok', 'claude'] as AgentId[]).filter(
    (id) => state.agents[id].isActive && !state.agents[id].folded
  );
}

// Game loop controller
let gameLoopInterval: number | null = null;

export function startGameLoop() {
  const store = useGameStore.getState();
  if (store.isRunning) return;

  store.startGame();
  runHand();
}

async function runHand() {
  const store = useGameStore.getState();
  if (!store.isRunning || store.isPaused) return;

  // Start new hand
  store.startNewHand();
  deck = shuffleDeck(createDeck());

  // Deal hole cards to all agents
  const agentIds: AgentId[] = ['deepseek', 'chatgpt', 'grok', 'claude'];
  for (const agentId of agentIds) {
    const cards = dealCards(2) as [Card, Card];
    store.dealHoleCards(agentId, cards);
    await delay(300);
  }

  // Post blinds
  const activeAgents = getActiveAgents();
  if (activeAgents.length >= 2) {
    const sbAgent = activeAgents[0];
    const bbAgent = activeAgents[1];
    store.placeBet(sbAgent, SMALL_BLIND);
    store.placeBet(bbAgent, BIG_BLIND);
    await delay(500);
  }

  // Pre-flop betting
  store.setPhase('preflop');
  await runBettingRound();

  // Check if hand is over
  if (countActivePlayers() <= 1) {
    await endHandWithWinner();
    scheduleNextHand();
    return;
  }

  // Flop
  store.setPhase('flop');
  store.addCommunityCards(dealCards(3));
  await delay(1000);
  await runBettingRound();

  if (countActivePlayers() <= 1) {
    await endHandWithWinner();
    scheduleNextHand();
    return;
  }

  // Turn
  store.setPhase('turn');
  store.addCommunityCards(dealCards(1));
  await delay(1000);
  await runBettingRound();

  if (countActivePlayers() <= 1) {
    await endHandWithWinner();
    scheduleNextHand();
    return;
  }

  // River
  store.setPhase('river');
  store.addCommunityCards(dealCards(1));
  await delay(1000);
  await runBettingRound();

  // Showdown
  await endHandWithWinner();
  scheduleNextHand();
}

async function runBettingRound() {
  const store = useGameStore.getState();
  const activeAgents = getActiveAgents();

  // Reset current bets for new round (except preflop blinds)
  if (store.phase !== 'preflop') {
    useGameStore.setState({ currentBet: 0 });
    for (const agentId of activeAgents) {
      store.updateAgent(agentId, { currentBet: 0 });
    }
  }

  let actionsThisRound = 0;
  let currentIndex = store.phase === 'preflop' ? 2 % activeAgents.length : 0;

  while (actionsThisRound < activeAgents.length * 2) {
    const state = useGameStore.getState();
    if (!state.isRunning || state.isPaused) return;

    const activeNow = getActiveAgents();
    if (activeNow.length <= 1) break;

    currentIndex = currentIndex % activeNow.length;
    const agentId = activeNow[currentIndex];
    const agent = state.agents[agentId];

    if (agent.folded || agent.isAllIn) {
      currentIndex++;
      continue;
    }

    // Set active agent (for UI highlight)
    store.setActiveAgent(agentId);

    // Clear previous thought and show "thinking" state
    store.updateAgent(agentId, { currentThought: { text: 'Analyzing situation...', analysis: '', confidence: 'medium', emoji: '🤔' } });
    await delay(THINKING_DELAY_MS);

    // Make AI decision
    const decision = makeAIDecision(agentId, useGameStore.getState());

    // Update agent with detailed thought
    store.updateAgent(agentId, {
      currentThought: {
        text: decision.thought.text,
        analysis: decision.thought.analysis,
        confidence: decision.thought.confidence,
        emoji: decision.thought.emoji,
      }
    });

    // Add thought to events
    store.addEvent({
      type: 'thought',
      agentId,
      message: decision.thought.text,
      details: decision.thought.analysis,
    });

    await delay(1500); // Give time to read the thought

    // Execute action
    const currentState = useGameStore.getState();
    const toCall = currentState.currentBet - currentState.agents[agentId].currentBet;

    switch (decision.action) {
      case 'fold':
        store.fold(agentId);
        break;
      case 'check':
        store.updateAgent(agentId, { lastAction: 'check' });
        store.addEvent({ type: 'action', agentId, message: `${AI_AGENTS[agentId].name} checks` });
        break;
      case 'call':
        store.placeBet(agentId, toCall);
        break;
      case 'raise':
      case 'all_in':
        store.placeBet(agentId, decision.amount || toCall * 2);
        actionsThisRound = 0; // Reset counter on raise
        break;
    }

    // Update win probabilities (mock)
    updateWinProbabilities();

    actionsThisRound++;
    currentIndex++;

    // Check if betting is complete
    const updatedActive = getActiveAgents();
    const allMatched = updatedActive.every((id) => {
      const a = useGameStore.getState().agents[id];
      return a.folded || a.isAllIn || a.currentBet === useGameStore.getState().currentBet;
    });

    if (allMatched && actionsThisRound >= updatedActive.length) {
      break;
    }

    await delay(ACTION_DELAY_MS);
  }

  store.setActiveAgent(null);
}

function countActivePlayers(): number {
  const state = useGameStore.getState();
  return Object.values(state.agents).filter((a) => a.isActive && !a.folded).length;
}

async function endHandWithWinner() {
  const state = useGameStore.getState();
  const activePlayers = Object.entries(state.agents)
    .filter(([_, a]) => a.isActive && !a.folded)
    .map(([id]) => id as AgentId);

  let winnerId: AgentId;
  let winningHand = '';

  if (activePlayers.length === 1) {
    winnerId = activePlayers[0];
    winningHand = 'Everyone else folded';
  } else {
    // Mock showdown - random winner from remaining players
    winnerId = activePlayers[Math.floor(Math.random() * activePlayers.length)];
    const hands = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House'];
    winningHand = hands[Math.floor(Math.random() * hands.length)];
  }

  // Resolve spectator bets
  useBettingStore.getState().resolveBets(winnerId);

  useGameStore.getState().endHand(winnerId, winningHand);
  await delay(3000);
}

function updateWinProbabilities() {
  const state = useGameStore.getState();
  const active = Object.entries(state.agents)
    .filter(([_, a]) => a.isActive && !a.folded)
    .map(([id]) => id as AgentId);

  // Mock probability calculation
  const total = active.length;
  const probabilities: Record<AgentId, number> = {
    claude: 0,
    chatgpt: 0,
    grok: 0,
    deepseek: 0,
  };

  active.forEach((id) => {
    // Random probability weighted slightly
    probabilities[id] = Math.floor((100 / total) + (Math.random() * 20 - 10));
  });

  // Normalize to 100%
  const sum = Object.values(probabilities).reduce((a, b) => a + b, 0);
  Object.keys(probabilities).forEach((id) => {
    const agentId = id as AgentId;
    probabilities[agentId] = Math.floor((probabilities[agentId] / sum) * 100);
    state.updateAgent(agentId, { winProbability: probabilities[agentId] });
  });

  // Update betting odds based on probabilities
  const odds: Record<AgentId, number> = {
    claude: probabilities.claude > 0 ? +(100 / probabilities.claude).toFixed(1) : 10,
    chatgpt: probabilities.chatgpt > 0 ? +(100 / probabilities.chatgpt).toFixed(1) : 10,
    grok: probabilities.grok > 0 ? +(100 / probabilities.grok).toFixed(1) : 10,
    deepseek: probabilities.deepseek > 0 ? +(100 / probabilities.deepseek).toFixed(1) : 10,
  };
  useBettingStore.getState().updateOdds(odds);
}

function scheduleNextHand() {
  const state = useGameStore.getState();
  if (!state.isRunning || state.isPaused) return;

  // Check if any agent is out of chips
  const activePlayers = Object.values(state.agents).filter((a) => a.chips > 0);
  if (activePlayers.length <= 1) {
    state.addEvent({ type: 'system', message: 'Tournament complete! Only one player remains.' });
    useGameStore.setState({ isRunning: false });
    return;
  }

  setTimeout(() => {
    runHand();
  }, 2000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stopGameLoop() {
  useGameStore.setState({ isRunning: false, isPaused: false });
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }
}

export function pauseGame() {
  useGameStore.getState().pauseGame();
}

export function resumeGame() {
  useGameStore.getState().resumeGame();
}
