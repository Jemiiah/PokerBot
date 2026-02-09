#!/bin/bash
# Phase 6 API Test Script
# Usage: ./test-api.sh

BASE_URL="http://localhost:8080"
WALLET="0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0d"

echo "=== Phase 6: Public Agent API Tests ==="
echo ""

# 1. Health check
echo "1. Health Check"
curl -s "$BASE_URL/health" | jq .
echo ""

# 2. Register agent
echo "2. Register External Agent"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/agents/register" \
  -H "Content-Type: application/json" \
  -d "{\"walletAddress\":\"$WALLET\", \"agentName\":\"TestBot\"}")
echo "$RESPONSE" | jq .

# Extract API key
API_KEY=$(echo "$RESPONSE" | jq -r '.apiKey')
echo "API Key: $API_KEY"
echo ""

if [ "$API_KEY" == "null" ]; then
  echo "Registration failed (wallet may already be registered)"
  echo "Try with a different wallet address"
  exit 1
fi

# 3. Get agent info
echo "3. Get Agent Info (/api/agents/me)"
curl -s "$BASE_URL/api/agents/me" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# 4. Join queue
echo "4. Join Matchmaking Queue"
curl -s -X POST "$BASE_URL/api/queue/join" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"maxWager":"10000000000000000"}' | jq .
echo ""

# 5. Check queue status
echo "5. Check Queue Status"
curl -s "$BASE_URL/queue" | jq .
echo ""

# 6. Get active games
echo "6. Get Active Games"
curl -s "$BASE_URL/api/games/active" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# 7. Leave queue
echo "7. Leave Queue"
curl -s -X POST "$BASE_URL/api/queue/leave" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# 8. Check leaderboard
echo "8. Check Leaderboard"
curl -s "$BASE_URL/api/leaderboard" | jq .
echo ""

# 9. Test rate limit headers
echo "9. Rate Limit Headers"
curl -s -I "$BASE_URL/api/agents/me" \
  -H "Authorization: Bearer $API_KEY" 2>&1 | grep -i "x-ratelimit"
echo ""

echo "=== All Tests Complete ==="
