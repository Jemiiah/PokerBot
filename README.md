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

This guide will help you set up and run the project locally for development.

### Prerequisites

| Tool | Version | Required | Notes |
|------|---------|----------|-------|
| Node.js | >= 20 | Yes | Runtime for all packages |
| pnpm | >= 9 | Yes | Package manager (monorepo) |
| Foundry | Latest | Yes | Smart contract development |
| Docker | Latest | No | Only needed for production deployment |

**Install pnpm** (if not already installed):
```bash
npm install -g pnpm
```

**Install Foundry** (if not already installed):
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/poker-agent-monad.git
cd poker-agent-monad

# Install all dependencies
pnpm install

# Build all packages
pnpm build
```

### Environment Setup

The project requires environment variables for different packages. Copy the example files and configure them:

#### 1. Root Environment (Backend Services)

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Network Configuration
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143

# Agent Private Keys (one per agent)
AGENT_PRIVATE_KEY_1=0x...  # Blaze agent
AGENT_PRIVATE_KEY_2=0x...  # Frost agent
AGENT_PRIVATE_KEY_3=0x...  # Shadow agent
AGENT_PRIVATE_KEY_4=0x...  # Viper agent

# Contract Addresses (get these after deployment)
POKER_GAME_ADDRESS=0x...
ESCROW_ADDRESS=0x...
TOURNAMENT_ADDRESS=0x...

# Coordinator Settings
COORDINATOR_URL=ws://localhost:8080
PORT=8080

# Agent Settings (optional)
AGENT_NAME=PokerBot001
MAX_WAGER_PERCENT=5
KELLY_FRACTION=0.25
```

#### 2. Frontend Environment

```bash
cp packages/frontend/.env.example packages/frontend/.env
```

Edit `packages/frontend/.env`:

```env
# Blockchain RPC
VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz

# Contract Addresses (same as root .env)
VITE_POKER_GAME_ADDRESS=0x...
VITE_ESCROW_ADDRESS=0x...

# Coordinator WebSocket URL
VITE_COORDINATOR_URL=ws://localhost:8080

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Deploy Smart Contracts

Before running the agents, deploy the contracts to Monad testnet:

```bash
cd packages/contracts

# Install Foundry dependencies
forge install

# Run tests (optional but recommended)
forge test

# Deploy to Monad testnet
forge script script/Deploy.s.sol \
  --rpc-url $MONAD_RPC_URL \
  --private-key $AGENT_PRIVATE_KEY_1 \
  --broadcast

# Copy the deployed addresses to your .env files
```

Deployed addresses will be saved in:
- `packages/contracts/broadcast/Deploy.s.sol/10143/run-latest.json`

### Running Locally (Development)

You can run each service independently for development:

#### Option 1: Run Services Separately (Recommended for Development)

```bash
# Terminal 1: Start the Frontend
pnpm frontend:dev
# Opens at http://localhost:5173

# Terminal 2: Start the Coordinator
pnpm coordinator:start
# WebSocket server at ws://localhost:8080

# Terminal 3: Start a Single Agent
pnpm agent:start
```

#### Option 2: Run All Services Together

```bash
# Start everything in development mode
pnpm dev
```

### Running with Docker (Production)

Docker is **not required** for local development but is used for production deployment to Railway.

The `Dockerfile` creates a multi-stage build that runs:
- 1 Coordinator service
- 4 AI Agents (Blaze, Frost, Shadow, Viper) via PM2

```bash
# Build the Docker image
docker build -t poker-agent .

# Run the container
docker run -p 8080:8080 \
  -e MONAD_RPC_URL=https://testnet-rpc.monad.xyz \
  -e AGENT_PRIVATE_KEY_1=0x... \
  -e AGENT_PRIVATE_KEY_2=0x... \
  -e AGENT_PRIVATE_KEY_3=0x... \
  -e AGENT_PRIVATE_KEY_4=0x... \
  -e POKER_GAME_ADDRESS=0x... \
  -e ESCROW_ADDRESS=0x... \
  poker-agent
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start all services in dev mode |
| `pnpm frontend:dev` | Start frontend dev server |
| `pnpm coordinator:start` | Start the coordinator service |
| `pnpm agent:start` | Start a single agent |
| `pnpm contracts:test` | Run smart contract tests |
| `pnpm contracts:build` | Compile smart contracts |

### Verifying Your Setup

1. **Frontend**: Open http://localhost:5173 - you should see the poker table UI
2. **Coordinator**: Check terminal for "WebSocket server listening on port 8080"
3. **Agents**: Check terminal for "Agent connected to coordinator"

### Troubleshooting

**Port already in use:**
```bash
# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9

# Kill process on port 8080 (coordinator)
lsof -ti:8080 | xargs kill -9
```

**pnpm not found after install:**
```bash
# Add pnpm to PATH
export PATH="$HOME/.local/share/pnpm:$PATH"
```

**Foundry commands not found:**
```bash
# Re-run foundryup
foundryup
```

## Configuration Reference

### Root Environment Variables (`.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `MONAD_RPC_URL` | Monad testnet RPC endpoint | Yes |
| `MONAD_CHAIN_ID` | Chain ID (10143 for testnet) | Yes |
| `AGENT_PRIVATE_KEY_1-4` | Private keys for each agent | Yes |
| `POKER_GAME_ADDRESS` | Deployed PokerGame contract | Yes |
| `ESCROW_ADDRESS` | Deployed Escrow contract | Yes |
| `COORDINATOR_URL` | WebSocket URL for coordinator | Yes |
| `PORT` | Coordinator server port | No (default: 8080) |
| `MAX_WAGER_PERCENT` | Max % of bankroll per game | No (default: 5) |
| `KELLY_FRACTION` | Kelly criterion fraction | No (default: 0.25) |

### Frontend Environment Variables (`packages/frontend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_MONAD_RPC_URL` | Monad RPC for frontend | Yes |
| `VITE_POKER_GAME_ADDRESS` | PokerGame contract address | Yes |
| `VITE_ESCROW_ADDRESS` | Escrow contract address | Yes |
| `VITE_COORDINATOR_URL` | Coordinator WebSocket URL | Yes |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID | Yes |

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
