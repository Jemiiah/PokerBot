# PokerBot Deployment Guide

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
│                    MONAD TESTNET                                 │
│                  (Smart Contract)                                │
│           0x9d4191980352547DcF029Ee1f6C6806E17ae2811             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 1.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your PokerBot repository
4. Railway will auto-detect the Dockerfile

### 1.3 Configure Environment Variables

In Railway dashboard, go to your service → Variables → Add these:

```env
# Blockchain
RPC_URL=https://testnet-rpc.monad.xyz
CHAIN_ID=10143
POKER_GAME_ADDRESS=0x9d4191980352547DcF029Ee1f6C6806E17ae2811

# Agent Private Keys (REQUIRED - generate new wallets!)
SHADOW_PRIVATE_KEY=0x_your_shadow_private_key
STORM_PRIVATE_KEY=0x_your_storm_private_key
SAGE_PRIVATE_KEY=0x_your_sage_private_key
EMBER_PRIVATE_KEY=0x_your_ember_private_key

# Optional: AI Personality
ANTHROPIC_API_KEY=your_key_here

# Server
LOG_LEVEL=info
```

### 1.4 Generate Agent Wallets

Run this to generate 4 new wallets:

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

### 1.5 Fund Agent Wallets

Send MON (Monad testnet tokens) to each wallet address:
- Minimum: 0.1 MON per agent
- Recommended: 0.5 MON per agent

Get testnet MON from: https://faucet.monad.xyz

### 1.6 Deploy

Railway will automatically deploy when you push to your repo, or click "Deploy" manually.

Your backend URL will be: `https://your-project.up.railway.app`

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```env
VITE_COORDINATOR_URL=wss://your-project.up.railway.app/ws
VITE_CHAIN_ID=10143
VITE_POKER_CONTRACT=0x9d4191980352547DcF029Ee1f6C6806E17ae2811
```

### 2.2 Deploy

```bash
cd packages/frontend
vercel --prod
```

Or connect your GitHub repo to Vercel for auto-deploy.

---

## Step 3: Verify Deployment

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

---

## Troubleshooting

### Agents not connecting?
- Check Railway logs for errors
- Verify private keys are correct
- Ensure wallets are funded

### Frontend not connecting?
- Verify VITE_COORDINATOR_URL is correct
- Check browser console for WebSocket errors
- Ensure Railway service is running

### RPC Timeouts?
- Monad testnet may be congested
- Agents will auto-retry with backoff

---

## Local Development

Run everything locally:

```bash
# Terminal 1: Coordinator
cd packages/coordinator && npm run dev

# Terminal 2: Frontend
cd packages/frontend && npm run dev

# Terminal 3-6: Agents
cd packages/agent
npm run start:shadow
npm run start:storm
npm run start:sage
npm run start:ember
```

---

## Cost Estimates

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Railway | $5/month credit | Enough for this project |
| Vercel | Free | Static hosting |
| Monad | Free | Testnet tokens |

---

## Security Notes

- Never commit private keys to git
- Use Railway's secret management for keys
- Agent wallets should only hold testnet tokens
- In production, use a proper key management system
