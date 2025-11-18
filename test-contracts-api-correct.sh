#!/bin/bash
# Test Contracts API - CORRECT FORMAT

echo "========================================"
echo "Testing Contracts API (Correct Format)"
echo "========================================"

echo ""
echo "Step 1: Getting authentication token..."

# CORRECT FORMAT: tenant_id + user_id (not username/password)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000001","user_id":"user123"}' \
  | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:30}..."

echo ""
echo "Step 2: Testing /api/contracts endpoint..."

curl -s -X GET "http://localhost:3000/api/contracts?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" | jq

echo ""
echo "========================================"
echo "Done!"
echo "========================================"

