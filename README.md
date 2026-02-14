# Poker Agent for Monad

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Monad](https://img.shields.io/badge/Chain-Monad%20Mainnet-purple.svg)](https://monad.xyz/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-orange.svg)](https://getfoundry.sh/)

AI-powered poker agents built for the **Moltiverse Hackathon 2026** - Game Arena Agent Track.

## Overview

**Poker Agent for Monad** is an autonomous AI-powered poker system where AI agents compete against each other in Texas Hold'em on the Monad blockchain. Agents wager tokens with outcomes settled entirely on-chain, employing sophisticated strategies including CFR-inspired preflop ranges, Monte Carlo equity calculations, opponent modeling, and Kelly Criterion bankroll management. The system features real-time game observation and spectator betting.

## Architecture

```
┌────────────────────┐       WebSocket        ┌──────────────────────┐
│      Frontend      │◄──────────────────────►│     Coordinator      │
│      (Vercel)      │                        │      (Railway)       │
└─────────┬──────────┘                        └──────────┬───────────┘
          │                                              │
          │ RPC/Events                                   │ WebSocket
          ▼                                              ▼
┌────────────────────┐                        ┌──────────────────────┐
│       Monad        │◄───────────────────────│      AI Agents       │
│     Contracts      │     Transactions       │      (Railway)       │
│                    │                        │                      │
│  • PokerGame       │                        │  • Blaze   • Shadow  │
│  • Escrow          │                        │  • Frost   • Viper   │
│  • Tournament      │                        │  • Storm   • Sage    │
│  • SpectatorBet    │                        │  • Ember   • Titan   │
└────────────────────┘                        └──────────────────────┘
```

> **See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation**

## Deployed Contracts

### Monad Mainnet (Chain ID: 143)

| Contract | Address | Explorer |
|----------|---------|----------|
| PokerGame | `0xCb1ef57cC989ba3043edb52542E26590708254fe` | [View](https://monad.socialscan.io/address/0xCb1ef57cC989ba3043edb52542E26590708254fe) |
| PokerGame4Max | `0xecaaEAA736a96B58d51793D288acE31499F7Fed2` | [View](https://monad.socialscan.io/address/0xecaaEAA736a96B58d51793D288acE31499F7Fed2) |
| Escrow | `0xb9E66aA8Ed13bA563247F4b2375fD19CF4B2c32C` | [View](https://monad.socialscan.io/address/0xb9E66aA8Ed13bA563247F4b2375fD19CF4B2c32C) |
| Escrow4Max | `0x0725199719bc9b20A82D2E9C1B17F008EBc70144` | [View](https://monad.socialscan.io/address/0x0725199719bc9b20A82D2E9C1B17F008EBc70144) |
| Tournament | `0xFbBC8C646f2c7c145EEA2c30A82B2A17f64F7B92` | [View](https://monad.socialscan.io/address/0xFbBC8C646f2c7c145EEA2c30A82B2A17f64F7B92) |
| CommitReveal | `0x3475cf785fDacc1B1d7f28BFc412e21B1cd5179d` | [View](https://monad.socialscan.io/address/0x3475cf785fDacc1B1d7f28BFc412e21B1cd5179d) |
| SpectatorBetting | `0x30E0A00f4589d786b390a3bdB043C69093292F17` | [View](https://monad.socialscan.io/address/0x30E0A00f4589d786b390a3bdB043C69093292F17) |

**RPC:** `https://rpc.monad.xyz` | **Explorers:** [Socialscan](https://monad.socialscan.io) · [MonadVision](https://monadvision.com) · [Monadscan](https://monadscan.com)

### Monad Testnet (Chain ID: 10143)

| Contract | Address |
|----------|---------|
| PokerGame | `0x2c19bEBa8A082b85D7c6D1564dD0Ebf9A149f2f0` |
| PokerGame4Max | `0x9d4191980352547DcF029Ee1f6C6806E17ae2811` |
| Escrow | `0x1174cFAe0E75F4c0FBd57F65b504c17C24B3fC8F` |
| Escrow4Max | `0x943473B2fF00482536BD6B64A650dF73A7dA3B04` |
| Tournament | `0x5658DC8fE47D27aBA44F9BAEa34D0Ab8b8566aaC` |
| CommitReveal | `0x50b49b4CfaBcb61781f8356de5f4F3f8D90Be11b` |
| SpectatorBetting | `0xFf85d9b5e2361bA32866beF85F53065be8d2faba` |

**RPC:** `https://testnet-rpc.monad.xyz`

## Project Structure

```
poker-agent-monad/
├── packages/
│   ├── frontend/          # React UI for game observation & spectator betting
│   ├── agent/             # TypeScript AI poker agent
│   ├── coordinator/       # WebSocket match coordination service
│   ├── contracts/         # Solidity smart contracts (Foundry)
│   │   └── src/
│   │       ├── core/          # PokerGame, Escrow, Tournament, SpectatorBetting
│   │       ├── interfaces/    # Contract interfaces
│   │       ├── libraries/     # HandEvaluator, DeckUtils, CardConstants
│   │       └── randomness/    # CommitReveal
│   └── shared/            # Shared types & utilities
├── docs/
│   ├── API.md             # API documentation
│   ├── SECURITY_AUDIT.md  # Security audit report
│   └── AI_POKER_ARENA_ROADMAP.md  # Future roadmap
├── scripts/
│   └── start-backend.sh   # PM2 backend startup script
├── ARCHITECTURE.md        # Detailed technical documentation
├── DEPLOY.md              # Deployment guide (Vercel + Railway)
├── Dockerfile             # Multi-stage Docker build
├── ecosystem.config.cjs   # PM2 process configuration
├── railway.json           # Railway deployment config
└── README.md              # This file
```

## Features

### Smart Contracts
- **PokerGame.sol** / **PokerGame4Max.sol**: Texas Hold'em game logic (2-4 players)
- **Escrow.sol**: Secure wager handling and payouts
- **Tournament.sol**: ELO rankings and leaderboard
- **HandEvaluator.sol**: On-chain 7-card hand evaluation
- **CommitReveal.sol**: Fair card randomness using commit-reveal
- **SpectatorBetting.sol**: Third-party betting on game outcomes

### AI Agent
- **Strategy Engine**: CFR-inspired preflop ranges + equity-based postflop play
- **Hand Evaluator**: Fast 7-card hand ranking
- **Monte Carlo Equity Calculator**: 1000+ simulation equity calculations
- **Opponent Modeling**: VPIP, PFR, AF tracking + player classification
- **Bankroll Management**: Kelly Criterion + stop-loss protection

### Frontend
- Real-time game observation via WebSocket
- Spectator betting interface
- Leaderboard and ELO rankings
- Wallet connection (WalletConnect)

## Quick Start

### Prerequisites

| Tool | Version | Required | Notes |
|------|---------|----------|-------|
| Node.js | >= 20 | Yes | Runtime for all packages |
| pnpm | >= 9 | Yes | Package manager (monorepo) |
| Foundry | Latest | Yes | Smart contract development |
| Docker | Latest | No | Only for production deployment |

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

Copy the example environment files:

```bash
# Root environment (backend services)
cp .env.example .env

# Frontend environment
cp packages/frontend/.env.example packages/frontend/.env
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

# Contract Addresses
POKER_GAME_ADDRESS=0x9d4191980352547DcF029Ee1f6C6806E17ae2811
ESCROW_ADDRESS=0x943473B2fF00482536BD6B64A650dF73A7dA3B04
TOURNAMENT_ADDRESS=0x5658DC8fE47D27aBA44F9BAEa34D0Ab8b8566aaC

# Coordinator Settings
COORDINATOR_URL=ws://localhost:8080
PORT=8080
```

### Running Locally

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

### Deploy Smart Contracts

```bash
cd packages/contracts

# Install Foundry dependencies
forge install

# Run tests
forge test

# Deploy to Monad testnet
forge script script/Deploy.s.sol \
  --rpc-url $MONAD_RPC_URL \
  --private-key $AGENT_PRIVATE_KEY_1 \
  --broadcast
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start all services in dev mode |
| `pnpm frontend:dev` | Start frontend dev server |
| `pnpm frontend:build` | Build frontend for production |
| `pnpm frontend:preview` | Preview production build |
| `pnpm coordinator:start` | Start coordinator service |
| `pnpm coordinator:dev` | Start coordinator in dev mode |
| `pnpm agent:start` | Start a single agent |
| `pnpm agent:dev` | Start agent in dev mode |
| `pnpm contracts:test` | Run smart contract tests |
| `pnpm contracts:build` | Compile smart contracts |
| `pnpm contracts:deploy` | Deploy smart contracts |

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
| Type | Description | Strategy |
|------|-------------|----------|
| **Fish** | Loose-passive | Value bet wide, never bluff |
| **Nit** | Tight-passive | Bluff often, respect raises |
| **LAG** | Loose-aggressive | Call down light |
| **TAG** | Tight-aggressive | Play tight, respect action |

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | Quick start guide (this file) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Detailed technical architecture |
| [DEPLOY.md](./DEPLOY.md) | Deployment instructions (Vercel + Railway) |
| [docs/API.md](./docs/API.md) | API documentation |
| [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md) | Security audit report |
| [docs/AI_POKER_ARENA_ROADMAP.md](./docs/AI_POKER_ARENA_ROADMAP.md) | Future roadmap |

## Docker Deployment

Docker is used for production deployment to Railway:

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

## Troubleshooting

**Port already in use:**
```bash
lsof -ti:5173 | xargs kill -9  # Frontend
lsof -ti:8080 | xargs kill -9  # Coordinator
```

**pnpm not found:**
```bash
export PATH="$HOME/.local/share/pnpm:$PATH"
```

**Foundry commands not found:**
```bash
foundryup
```

## Success Criteria

- [x] Implement Texas Hold'em game type
- [x] Enable wagering system with tokens
- [x] Make strategic decisions based on game state
- [x] Opponent behavior tracking
- [x] Bankroll management
- [x] Spectator betting system
- [ ] Complete 5+ matches against different opponents
- [ ] Maintain positive/neutral win rate

## License

MIT

## Hackathon

Built for **Moltiverse Hackathon 2026** (Feb 2-18, 2026)
- **Track:** Game Arena Agent ($10,000 bounty)
- **Chain:** Monad Blockchain

---

*Built with love for autonomous agents and poker strategy*
