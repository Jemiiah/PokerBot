# PokerBot Deployment Guide

## Network Configuration

| Network | Chain ID | RPC URL | Block Explorer |
|---------|----------|---------|----------------|
| **Mainnet** | 143 | `https://rpc.monad.xyz` | [monad.socialscan.io](https://monad.socialscan.io) |
| **Testnet** | 10143 | `https://testnet-rpc.monad.xyz` | [testnet.monadexplorer.com](https://testnet.monadexplorer.com) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                   │
│                    (Frontend Only)                               │
│                  your-app.vercel.app                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │ WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       RAILWAY                                    │
│              (Backend - Always Running)                          │
│                                                                  │
│   ┌─────────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│   │   Shadow    │  │  Storm  │  │   Sage  │  │  Ember  │       │
│   │   Agent     │  │  Agent  │  │  Agent  │  │  Agent  │       │
│   └──────┬──────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│          └──────────────┼────────────┼────────────┘             │
│                         ▼                                        │
│               ┌─────────────────┐                                │
│               │   Coordinator   │ ◄── Frontend connects here    │
│               │   WebSocket     │                                │
│               └────────┬────────┘                                │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MONAD BLOCKCHAIN                              │
│           Mainnet (143) or Testnet (10143)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Order

```
1. Smart Contracts  →  2. Backend (Railway)  →  3. Frontend (Vercel)
```

---

## Step 1: Deploy Smart Contracts

### 1.1 Prerequisites

- Foundry installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Deployer wallet with MON (mainnet or testnet)
- Private key exported as environment variable

### 1.2 Deploy to Testnet

```bash
cd packages/contracts

# Set environment variables
export PRIVATE_KEY=0x_your_deployer_private_key
export RPC_URL=https://testnet-rpc.monad.xyz

# Deploy all contracts
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# Deploy 4-player variant
forge script script/Deploy4Max.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### 1.3 Deploy to Mainnet

```bash
cd packages/contracts

# Set environment variables for MAINNET
export PRIVATE_KEY=0x_your_deployer_private_key
export RPC_URL=https://rpc.monad.xyz

# Deploy all contracts
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Deploy 4-player variant
forge script script/Deploy4Max.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

### 1.4 Save Deployed Addresses

After deployment, save the contract addresses:

```bash
# Output will show:
# ESCROW_ADDRESS=0x...
# POKER_GAME_ADDRESS=0x...
# TOURNAMENT_ADDRESS=0x...
# COMMIT_REVEAL_ADDRESS=0x...
# SPECTATOR_BETTING_ADDRESS=0x...
```

Update these in:
- `packages/frontend/src/config/contracts.ts` (MAINNET_CONTRACTS or TESTNET_CONTRACTS)
- `.env` files for backend

### 1.5 Verify Contracts (Optional)

Verify on block explorers:

```bash
# Socialscan
forge verify-contract <CONTRACT_ADDRESS> src/core/PokerGame.sol:PokerGame \
  --chain-id 143 \
  --verifier-url https://api.socialscan.io/monad/v1/contract/verify

# MonadVision
forge verify-contract <CONTRACT_ADDRESS> src/core/PokerGame.sol:PokerGame \
  --chain-id 143 \
  --verifier-url https://monadvision.com/api/verify

# Monadscan
forge verify-contract <CONTRACT_ADDRESS> src/core/PokerGame.sol:PokerGame \
  --chain-id 143 \
  --verifier-url https://api.monadscan.com/api/verify
```

---

## Step 2: Deploy Backend to Railway

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 2.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your PokerBot repository
4. Railway will auto-detect the Dockerfile

### 2.3 Generate Agent Wallets

```bash
node -e "
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
['Shadow', 'Storm', 'Sage', 'Ember'].forEach(name => {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  console.log(\`\${name}: \${account.address}\`);
  console.log(\`  Private Key: \${pk}\n\`);
});
"
```

### 2.4 Fund Agent Wallets

Send MON to each agent wallet:
- **Testnet**: Get from [faucet.monad.xyz](https://faucet.monad.xyz) (0.5 MON each)
- **Mainnet**: Transfer real MON (0.5-1 MON each)

### 2.5 Configure Environment Variables

In Railway dashboard → Your Service → Variables:

#### For Testnet:
```env
# Network
RPC_URL=https://testnet-rpc.monad.xyz
CHAIN_ID=10143

# Contracts (from Step 1)
POKER_GAME_ADDRESS=0x9d4191980352547DcF029Ee1f6C6806E17ae2811

# Agent Private Keys
SHADOW_PRIVATE_KEY=0x_your_shadow_private_key
STORM_PRIVATE_KEY=0x_your_storm_private_key
SAGE_PRIVATE_KEY=0x_your_sage_private_key
EMBER_PRIVATE_KEY=0x_your_ember_private_key

# Server
LOG_LEVEL=info
PORT=8080
```

#### For Mainnet:
```env
# Network
RPC_URL=https://rpc.monad.xyz
CHAIN_ID=143

# Contracts (from mainnet deployment)
POKER_GAME_ADDRESS=0x_mainnet_address

# Agent Private Keys
SHADOW_PRIVATE_KEY=0x_your_shadow_private_key
STORM_PRIVATE_KEY=0x_your_storm_private_key
SAGE_PRIVATE_KEY=0x_your_sage_private_key
EMBER_PRIVATE_KEY=0x_your_ember_private_key

# Server
LOG_LEVEL=info
PORT=8080
NODE_ENV=production
```

### 2.6 Deploy

Railway will automatically deploy when you push to your repo, or click "Deploy" manually.

Your backend URL will be: `https://your-project.up.railway.app`

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Update Frontend Config

For **mainnet**, update `packages/frontend/src/config/contracts.ts`:

```typescript
export const MAINNET_CONTRACTS = {
  POKER_GAME: '0x_your_mainnet_address' as `0x${string}`,
  ESCROW: '0x_your_mainnet_address' as `0x${string}`,
  // ... etc
} as const;
```

### 3.2 Configure Vercel Environment Variables

In Vercel dashboard → Settings → Environment Variables:

#### For Testnet:
```env
VITE_COORDINATOR_WS_URL=wss://your-project.up.railway.app/ws
VITE_CHAIN_ID=10143
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

#### For Mainnet:
```env
VITE_COORDINATOR_WS_URL=wss://your-project.up.railway.app/ws
VITE_CHAIN_ID=143
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

### 3.3 Deploy

```bash
cd packages/frontend

# Option A: Vercel CLI
vercel --prod

# Option B: Push to GitHub (auto-deploy if connected)
git push origin main
```

Your frontend URL: `https://your-app.vercel.app`

---

## Step 4: Verify Deployment

### Check Backend Health
```bash
curl https://your-project.up.railway.app/health
```

Expected response:
```json
{"status":"ok","matches":0,"agents":4,"frontends":0}
```

### Check Agent Status
```bash
curl https://your-project.up.railway.app/agents
```

### Verify Frontend
1. Open `https://your-app.vercel.app`
2. Connect wallet
3. Check that agents appear online
4. Test spectator betting

---

## Troubleshooting

### Agents not connecting?
- Check Railway logs for errors
- Verify private keys are correct
- Ensure wallets are funded with enough MON

### Frontend not connecting?
- Verify VITE_COORDINATOR_WS_URL is correct (use `wss://` not `ws://`)
- Check browser console for WebSocket errors
- Ensure Railway service is running

### RPC Timeouts?
- Network may be congested
- Agents will auto-retry with backoff
- Consider using a private RPC endpoint

### Contract verification failed?
- Ensure you're using the correct verifier URL for the network
- Check that compiler settings match deployment

---

## Cost Estimates

| Service | Free Tier | Production |
|---------|-----------|------------|
| Railway | $5/month credit | ~$5-20/month |
| Vercel | Free | Free (static) |
| Monad Testnet | Free | N/A |
| Monad Mainnet | N/A | Gas costs only |

---

## Security Checklist

- [ ] Never commit private keys to git
- [ ] Use Railway's secret management for keys
- [ ] Audit contracts before mainnet deployment
- [ ] Start with small amounts on mainnet
- [ ] Monitor agent wallet balances
- [ ] Set up alerts for low balances
- [ ] Use a hardware wallet for deployer key (mainnet)

---

## Quick Reference

### Testnet
```
Chain ID: 10143
RPC: https://testnet-rpc.monad.xyz
Explorer: https://testnet.monadexplorer.com
Faucet: https://faucet.monad.xyz
```

### Mainnet
```
Chain ID: 143
RPC: https://rpc.monad.xyz
Explorers:
  - https://monad.socialscan.io
  - https://monadvision.com
  - https://monadscan.com
```
