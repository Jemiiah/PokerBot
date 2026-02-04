#!/bin/bash
# Start second agent with different config

export AGENT_PRIVATE_KEY=0x0391307dc1dc026ab49ceaac2cd961cdaa374545f31d1221cbe90fed0f5876ec
export AGENT_NAME=Agent2
export MONAD_RPC_URL=https://testnet-rpc.monad.xyz
export MONAD_CHAIN_ID=10143
export POKER_GAME_ADDRESS=0x0725199719bc9b20A82D2E9C1B17F008EBc70144
export ESCROW_ADDRESS=0x2641fA006fb1Fd60Cb41C98d2E0B37b4F2FC800e
export TOURNAMENT_ADDRESS=0xecaaEAA736a96B58d51793D288acE31499F7Fed2
export COORDINATOR_URL=ws://localhost:8080
export COORDINATOR_WS_URL=ws://localhost:8080/ws
export COORDINATOR_API_URL=http://localhost:8080
export LOG_LEVEL=debug

npx tsx src/index.ts
