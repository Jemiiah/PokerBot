# Poker Agent for Monad

AI-powered poker agent built for the **Moltiverse Hackathon 2026** - Game Arena Agent Track.

## Overview

This project implements an autonomous AI poker agent that:
- Plays Texas Hold'em against other agents on the Monad blockchain
- Wagers tokens on match outcomes
- Demonstrates strategic thinking (CFR-inspired strategy, opponent modeling)
- Manages bankroll using Kelly Criterion
- Provides clear interface for match coordination

## Architecture

```
┌──────────────┐     WebSocket      ┌─────────────────┐
│   Frontend   │◄──────────────────►│   Coordinator   │
│   (Vercel)   │                    │   (Railway)     │
└──────┬───────┘                    └────────┬────────┘
       │                                     │
       │ RPC/Events                          │ WebSocket
       ▼                                     ▼
┌──────────────┐                    ┌─────────────────┐
│    Monad     │◄───────────────────│   AI Agents     │
│  Contracts   │    Transactions    │   (Railway)     │
└──────────────┘                    └─────────────────┘
```

> **See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation**

## Project Structure

```
poker-agent-monad/
├── packages/
│   ├── frontend/         # React UI for game observation
│   ├── agent/            # TypeScript AI poker agent
│   ├── coordinator/      # Match coordination service
│   ├── contracts/        # Solidity smart contracts (Foundry)
│   └── shared/           # Shared types & utilities
├── scripts/              # Deployment & utility scripts
├── ARCHITECTURE.md       # Detailed technical documentation
├── DEPLOY.md             # Deployment guide
└── README.md             # This file
```

## Features

### Smart Contracts
- **PokerGame.sol**: Heads-up Texas Hold'em game logic
- **Escrow.sol**: Secure wager handling and payouts
- **Tournament.sol**: ELO rankings and leaderboard
- **HandEvaluator.sol**: On-chain 7-card hand evaluation
- **CommitReveal.sol**: Fair card randomness

### AI Agent
- **Strategy Engine**: CFR-inspired preflop ranges + equity-based postflop play
- **Hand Evaluator**: Fast 7-card hand ranking
- **Monte Carlo Equity Calculator**: 1000+ simulation equity calculations
- **Opponent Modeling**: VPIP, PFR, AF tracking + player classification
- **Bankroll Management**: Kelly Criterion + stop-loss protection

## Quick Start

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Foundry (for contracts)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Deploy Contracts

```bash
# Set up environment
cp .env.example .env
# Edit .env with your private key and RPC URL

# Deploy to Monad testnet
cd packages/contracts
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast
```

### Run the Agent

```bash
# Start the coordinator (optional, for match discovery)
pnpm coordinator:start

# Start the agent
pnpm agent:start
```

## Configuration

Environment variables (`.env`):

```env
# Network
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143

# Agent wallet
AGENT_PRIVATE_KEY=0x...

# Contract addresses (after deployment)
POKER_GAME_ADDRESS=0x...
ESCROW_ADDRESS=0x...
TOURNAMENT_ADDRESS=0x...

# Agent settings
AGENT_NAME=PokerBot001
MAX_WAGER_PERCENT=5      # Max 5% of bankroll per game
KELLY_FRACTION=0.25      # Quarter-Kelly for safety
```

## Strategy Overview

### Preflop
- Premium hands (AA-JJ, AKs): Raise 3x
- Strong hands (TT-88, AQs-ATs): Raise 2.5x
- Playable hands: Position-dependent opens
- Trash: Fold (occasional steals from button)

### Postflop
- Strong made hands (65%+ equity): Value bet 0.66-0.75 pot
- Drawing hands: Pot odds calculation
- Weak hands: Check/fold, occasional bluffs (33% frequency)

### Opponent Adaptation
- **Fish** (loose-passive): Value bet wide, never bluff
- **Nit** (tight-passive): Bluff often, respect raises
- **LAG** (loose-aggressive): Call down light
- **TAG** (tight-aggressive): Play tight, respect action

## Success Criteria

- [x] Implement Texas Hold'em game type
- [x] Enable wagering system with tokens
- [x] Make strategic decisions based on game state
- [x] Opponent behavior tracking
- [x] Bankroll management
- [ ] Complete 5+ matches against different opponents
- [ ] Maintain positive/neutral win rate

## Development

```bash
# Run contract tests
pnpm contracts:test

# Run agent in dev mode
pnpm agent:dev

# Build specific package
pnpm --filter @poker/agent build
```

## Documentation

- **[README.md](./README.md)** - Quick start guide (this file)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed technical architecture
- **[DEPLOY.md](./DEPLOY.md)** - Deployment instructions

## License

MIT

## Hackathon

Built for **Moltiverse Hackathon** (Feb 2-18, 2026)
- Track: Game Arena Agent ($10,000 bounty)
- Chain: Monad Blockchain

---

*Built with love for autonomous agents and poker strategy*
