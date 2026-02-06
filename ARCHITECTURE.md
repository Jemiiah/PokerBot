# PokerBot Architecture Documentation

> Comprehensive technical documentation for the AI Poker Agent monorepo

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Frontend Architecture](#frontend-architecture)
- [Agent Architecture](#agent-architecture)
- [Smart Contracts](#smart-contracts)
- [Coordinator Service](#coordinator-service)
- [Data Flow](#data-flow)
- [Integration Points](#integration-points)
- [Configuration](#configuration)
- [Feature Status](#feature-status)

---

## Overview

**Project:** `poker-agent-monad`
**Purpose:** AI-powered poker agents competing on Monad blockchain
**Hackathon:** Moltiverse Hackathon 2026 - Game Arena Agent Track

### Technology Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Monad Testnet (chainId: 10143) |
| Smart Contracts | Solidity ^0.8.24, Foundry |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State Management | Zustand |
| Web3 | viem, wagmi |
| Backend | Node.js, Fastify, WebSockets |
| Agent | Pure TypeScript with AI strategy engine |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
poker-agent-monad/
├── packages/
│   ├── frontend/          # React UI for game observation
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   ├── pages/         # Page layouts
│   │   │   ├── hooks/         # React hooks
│   │   │   ├── stores/        # Zustand state stores
│   │   │   ├── services/      # Game engine & services
│   │   │   ├── config/        # Wagmi & contract config
│   │   │   └── lib/           # Constants & utilities
│   │   └── ...
│   │
│   ├── agent/             # AI poker agent engine
│   │   ├── src/
│   │   │   ├── strategy/      # Decision-making engine
│   │   │   ├── opponent/      # Player profiling
│   │   │   ├── bankroll/      # Risk management
│   │   │   ├── blockchain/    # Contract interaction
│   │   │   ├── personality/   # Agent personalities
│   │   │   └── utils/         # Config & logging
│   │   └── ...
│   │
│   ├── coordinator/       # Matchmaking & thought relay
│   │   └── src/
│   │       └── index.ts       # Fastify WebSocket server
│   │
│   ├── contracts/         # Solidity smart contracts
│   │   ├── src/
│   │   │   ├── core/          # Game & escrow contracts
│   │   │   ├── interfaces/    # Contract interfaces
│   │   │   ├── libraries/     # Hand evaluator, utils
│   │   │   └── randomness/    # Commit-reveal system
│   │   └── script/            # Deployment scripts
│   │
│   └── shared/            # Common types & utilities
│       └── src/
│           ├── types/         # Shared type definitions
│           ├── constants/     # Shared constants
│           └── utils/         # Encoding utilities
│
├── scripts/               # Deployment & utility scripts
├── ARCHITECTURE.md        # This file
├── DEPLOY.md              # Deployment guide
└── README.md              # Quick start guide
```

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── components/
│   ├── AgentAvatar.tsx        # Agent profile display
│   ├── AgentSeat.tsx          # Table seat with cards/chips
│   ├── CommunityCards.tsx     # Shared cards display
│   ├── GameControls.tsx       # Mode/game controls
│   ├── LiveBettingPanel.tsx   # Spectator betting UI
│   ├── MatchmakingQueue.tsx   # Queue status
│   ├── PlayingCard.tsx        # Card component
│   ├── PokerTable.tsx         # Main table visualization
│   ├── Sidebar.tsx            # Events/thoughts panel
│   ├── ThoughtBubble.tsx      # Agent reasoning display
│   └── WalletConnect.tsx      # Web3 connection
├── pages/
│   └── HomePage.tsx           # Main layout
├── hooks/
│   ├── usePokerContract.ts    # Contract interactions
│   └── useRealGame.ts         # Live game management
├── stores/
│   ├── gameStore.ts           # Central game state (Zustand)
│   └── bettingStore.ts        # Betting state
├── services/
│   ├── gameEngine.ts          # Demo game simulation
│   └── realGameService.ts     # Coordinator/contract integration
├── config/
│   ├── contracts.ts           # ABIs & addresses
│   ├── wagmi.ts               # Wagmi configuration
│   └── chains.ts              # Chain definitions
└── lib/
    └── constants.ts           # Agents, game constants
```

### Key Components

#### State Management (Zustand)

**gameStore.ts** - Central game state:
```typescript
interface GameState {
  mode: 'demo' | 'live';
  isRunning: boolean;
  phase: GamePhase;
  agents: Record<AgentId, AgentState>;
  pot: number;
  communityCards: Card[];
  events: GameEvent[];
  // ... more fields
}
```

#### Game Modes

| Mode | Description |
|------|-------------|
| **Demo** | Simulated games with 4 AI agents (Claude, ChatGPT, Grok, DeepSeek) |
| **Live** | Real blockchain games with live agents (Shadow, Storm, Sage, Blaze, etc.) |

#### Services

- **gameEngine.ts**: Runs demo games with simulated AI decisions
- **realGameService.ts**:
  - WebSocket connection to Coordinator
  - Contract state synchronization
  - Agent thought relay
  - Mode-aware state updates (prevents demo/live mixing)

### Agent Definitions

**8 Live Agents:**
| Agent | Color | Personality |
|-------|-------|-------------|
| Blaze | #FF6B35 | Aggressive, fiery |
| Frost | #4FC3F7 | Cool, calculated |
| Shadow | #9C27B0 | Mysterious, deceptive |
| Storm | #00BCD4 | Unpredictable, volatile |
| Sage | #4CAF50 | Wise, patient |
| Ember | #FFC107 | Warm, steady |
| Viper | #F44336 | Quick, sharp |
| Titan | #607D8B | Strong, immovable |

**4 Demo Agents:** Claude, ChatGPT, Grok, DeepSeek

---

## Agent Architecture

### Directory Structure

```
agent/src/
├── Agent.ts                 # Main orchestrator
├── strategy/
│   ├── StrategyEngine.ts    # Decision-making
│   ├── HandEvaluator.ts     # Hand strength
│   ├── EquityCalculator.ts  # Monte Carlo equity
│   └── PreflopStrategy.ts   # Preflop ranges
├── opponent/
│   └── OpponentModel.ts     # Player profiling
├── bankroll/
│   └── BankrollManager.ts   # Kelly Criterion
├── blockchain/
│   ├── ContractClient.ts    # Contract interaction
│   └── WalletManager.ts     # Account management
├── personality/
│   └── PersonalityService.ts # Agent personas
└── utils/
    ├── config.ts            # Environment config
    └── logger.ts            # Pino logger
```

### Strategy Engine

**Decision Flow:**
```
Game State → Strategy Engine → Decision
                  ↓
         ┌───────┴───────┐
         ↓               ↓
    Preflop          Postflop
         ↓               ↓
  Hand Ranges    Equity Calculator
         ↓               ↓
    Decision         Decision
```

**Output:**
```typescript
{
  action: 'fold' | 'check' | 'call' | 'raise' | 'all_in',
  amount?: bigint,
  confidence: number,  // 0-1
  reasoning: string
}
```

### Hand Evaluation

- **HandEvaluator.ts**: Fast 7-card evaluation
- Rankings: High card → Royal flush (1-10)
- Generates best 5-card hand from 7 cards

### Equity Calculator

- Monte Carlo simulation (1000+ runs)
- Calculates win probability against opponent range
- Accounts for unknown cards

### Preflop Strategy

- 169 unique preflop hands with strength ratings (0-100)
- GTO-inspired ranges
- Position-aware recommendations

**Example Ratings:**
| Hand | Strength |
|------|----------|
| AA | 100 |
| KK | 98 |
| AKs | 93 |
| QQ | 91 |
| JJ | 88 |

### Opponent Modeling

Tracks:
- VPIP (Voluntarily Put In Pot %)
- PFR (Pre-Flop Raise %)
- AF (Aggression Factor)
- WTSD (Went To Showdown %)

**Player Types:** TAG, LAG, Nit, Fish, Unknown

### Bankroll Management

**Kelly Criterion:**
```
f* = (b*p - q) / b
```
- Uses fractional Kelly (25%) for variance reduction
- Max wager: 5% of bankroll
- Session stop-loss: 20%

---

## Smart Contracts

### Directory Structure

```
contracts/src/
├── core/
│   ├── PokerGame.sol        # 2-player heads-up
│   ├── PokerGame4Max.sol    # 2-4 player variant
│   ├── Escrow.sol           # 2-player escrow
│   ├── Escrow4Max.sol       # Multi-player escrow
│   ├── SpectatorBetting.sol # Betting on games
│   └── Tournament.sol       # ELO rankings
├── interfaces/
│   ├── IPokerGame.sol
│   └── IPokerGame4Max.sol
├── libraries/
│   ├── HandEvaluator.sol    # On-chain hand ranking
│   ├── DeckUtils.sol        # Card operations
│   └── CardConstants.sol    # Card encoding
└── randomness/
    └── CommitReveal.sol     # Fair randomness
```

### PokerGame4Max.sol (Primary)

**Game Phases:**
```
WAITING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN → COMPLETE
```

**Key Functions:**
```solidity
createGame(bytes32 commitment, uint8 minPlayers, uint8 maxPlayers)
joinGame(bytes32 gameId, bytes32 commitment)
takeAction(bytes32 gameId, uint8 action, uint256 amount)
revealCards(bytes32 gameId, uint8[2] cards, bytes32 salt)
```

**Actions:** FOLD=0, CHECK=1, CALL=2, RAISE=3, ALL_IN=4

**Card Commitment:**
```
commitment = keccak256(card1, card2, salt)
```

**Events:**
```solidity
GameCreated(bytes32 gameId, address creator, uint256 wager)
PlayerJoined(bytes32 gameId, address player, uint8 playerIndex)
GameStarted(bytes32 gameId, uint8 playerCount)
ActionTaken(bytes32 gameId, address player, uint8 action, uint256 amount)
PhaseChanged(bytes32 gameId, uint8 newPhase)
GameEnded(bytes32 gameId, address winner, uint256 pot)
```

### Deployed Addresses (Monad Testnet)

```
POKER_GAME_4MAX: 0x9d4191980352547DcF029Ee1f6C6806E17ae2811
ESCROW_4MAX:     0x943473B2fF00482536BD6B64A650dF73A7dA3B04
```

---

## Coordinator Service

### Overview

Fastify WebSocket server on port 8080 providing:
- Agent registration & matchmaking
- Game coordination
- Thought relay to frontends

### State Management

```typescript
// Connected agents
Map<address, ConnectedAgent>

// Active games
Map<gameId, Match>

// Connected frontends
Map<frontendId, ConnectedFrontend>

// Matchmaking queue
QueuedAgent[]
```

### Matchmaking Algorithm

1. Check queue every 3 seconds
2. Match 3-4 eligible agents
3. Send `create_game_command` to first agent
4. Send `join_game_command` to others

### WebSocket Messages

**Agent → Coordinator:**
```json
{ "type": "register", "address": "0x...", "name": "Blaze", "balance": "..." }
{ "type": "ready_to_play", "address": "0x...", "maxWager": "..." }
{ "type": "agent_thought", "gameId": "...", "action": "raise", "reasoning": "..." }
```

**Coordinator → Agent:**
```json
{ "type": "create_game_command", "wagerAmount": "...", "players": [...] }
{ "type": "join_game_command", "gameId": "...", "wagerAmount": "..." }
```

**Frontend Messages:**
```json
{ "type": "frontend_subscribe", "gameId": "0x..." }
{ "type": "agent_thought", ... }  // Relayed from agents
```

### REST Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service status |
| `GET /matches` | All matches |
| `GET /agents` | Connected agents |
| `GET /queue` | Matchmaking queue |

---

## Data Flow

### Complete Game Flow

```
INITIALIZATION
├─ Frontend connects to Coordinator (WebSocket)
├─ Agent registers with Coordinator
├─ Coordinator adds Agent to matchmaking queue

MATCHMAKING
├─ Coordinator matches 3+ agents
├─ Sends create_game_command to Agent1
├─ Sends join_game_command to Agent2, Agent3

GAME CREATION
├─ Agent1: createGame(commitment) → Contract
├─ Contract: Emits GameCreated
├─ Frontend: Subscribes to game

GAMEPLAY
├─ Agents poll contract, take actions
├─ Each action: agent_thought → Coordinator → Frontend
├─ Frontend updates UI in real-time

SHOWDOWN
├─ Agents reveal cards
├─ Contract evaluates hands, awards pot
├─ Contract: Emits GameEnded

COMPLETION
├─ Frontend shows winner
├─ Agents update stats, re-queue
```

---

## Integration Points

### Frontend ↔ Blockchain

```typescript
// Direct contract queries (wagmi)
useGameState(gameId)     // Polls every 2 seconds
useActiveGames()         // Gets active games

// Contract events
ActionTaken, PhaseChanged, GameEnded
```

### Frontend ↔ Coordinator

```
Frontend → frontend_subscribe → Coordinator
Coordinator → agent_thought, game_events → Frontend
```

### Agent ↔ Coordinator

```
Agent → register, ready_to_play, agent_thought → Coordinator
Coordinator → create_game_command, join_game_command → Agent
```

### Agent ↔ Blockchain

```
Agent → createGame, joinGame, takeAction, revealCards → Contract
Contract → Events → Agent (via polling)
```

---

## Configuration

### Environment Variables

```env
# Network
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143

# Wallet
AGENT_PRIVATE_KEY=0x...

# Contracts
POKER_GAME_4MAX_ADDRESS=0x...
ESCROW_4MAX_ADDRESS=0x...

# Coordinator
COORDINATOR_URL=ws://localhost:8080
COORDINATOR_API_URL=http://localhost:8080

# Agent Settings
AGENT_NAME=Blaze
MAX_WAGER_PERCENT=5
KELLY_FRACTION=0.25
TIMEOUT_SECONDS=60

# Personality
AGENT_PERSONALITY=Blaze
AGENT_MODE=live

# Optional
OPENAI_API_KEY=...
LOG_LEVEL=info
```

### Deployment Architecture

```
┌──────────────────┐
│    Vercel        │
│   (Frontend)     │
└────────┬─────────┘
         │ WebSocket
         ▼
┌──────────────────────┐
│      Railway         │
│  (Backend Services)  │
├──────────────────────┤
│ • Coordinator        │
│ • 4x AI Agents       │
└────────┬─────────────┘
         │ RPC
         ▼
┌──────────────────┐
│   Monad Chain    │
│   (Testnet)      │
└──────────────────┘
```

---

## Feature Status

### Completed ✅

#### Smart Contracts
- [x] PokerGame4Max.sol - 2-4 player Texas Hold'em
- [x] Escrow4Max.sol - Multi-player fund management
- [x] HandEvaluator.sol - On-chain hand ranking
- [x] Commit-reveal card system (anti-cheat)
- [x] Deployed on Monad testnet

#### AI Agents
- [x] Strategy engine (preflop + postflop)
- [x] Monte Carlo equity calculator
- [x] Kelly Criterion bankroll management
- [x] Opponent modeling (VPIP, PFR, AF)
- [x] 8 unique personalities
- [x] Contract interaction
- [x] Coordinator WebSocket integration

#### Coordinator Service
- [x] Fastify WebSocket server
- [x] Agent registration & matchmaking
- [x] Game coordination
- [x] Thought relay to frontends
- [x] REST API endpoints

#### Frontend
- [x] Real-time poker table visualization
- [x] Agent seats with cards/chips/status
- [x] Community cards display
- [x] Agent thought bubbles
- [x] Demo mode (simulated games)
- [x] Live mode (blockchain games)
- [x] Mode separation (demo/live isolation)
- [x] Matchmaking queue display
- [x] Spectator betting panel (UI)

### In Progress 🚧

| Feature | Status | Notes |
|---------|--------|-------|
| Spectator Betting (On-chain) | UI exists | Contract not integrated |
| Tournament System | Contract exists | Not integrated with frontend |
| Leaderboard Display | Placeholder | Need contract/coordinator data |

### Planned 📋

| Feature | Priority | Notes |
|---------|----------|-------|
| Multi-game Viewing | Medium | Watch multiple games simultaneously |
| Agent LLM Integration | Medium | OpenAI for dynamic responses |
| Hand History | Medium | Save/replay past games |
| Statistics Dashboard | Medium | Win rates, ROI, session stats |
| Mobile Responsive | Low | Table works, sidebar needs work |
| Sound Effects | Low | Card deals, chip sounds |
| Enhanced Animations | Low | Framer Motion polish |
| Chat System | Low | Agent trash talk |
| Push Notifications | Low | Game start alerts |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT

---

*Last updated: February 2026*
