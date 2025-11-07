#!/bin/bash
# Ready-to-Run V4 API Tests
# Tenant ID: 00000000-0000-0000-0000-000000000001

BASE_URL="http://localhost:3000"
TENANT_ID="00000000-0000-0000-0000-000000000001"

echo "=========================================="
echo "V4 API Test Suite"
echo "=========================================="
echo ""

# Step 1: Get JWT Token
echo "Step 1: Getting JWT Token..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\": \"$TENANT_ID\"}")

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""

# Step 2: Test V4 Search Rates
echo "Step 2: Testing V4 Search Rates..."
curl -s -X POST "$BASE_URL/api/v4/search-rates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC"
  }' | jq '.success, .data[0].origin, .data[0].destination' || echo "❌ Test failed"
echo ""

# Step 3: Test V4 Prepare Quote
echo "Step 3: Testing V4 Prepare Quote..."
curl -s -X POST "$BASE_URL/api/v4/prepare-quote" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC",
    "container_count": 1
  }' | jq '.success, .data.route.origin, .data.route.destination' || echo "❌ Test failed"
echo ""

# Step 4: Test V1 Search Rates (Backward Compatibility)
echo "Step 4: Testing V1 Search Rates (Backward Compatibility)..."
curl -s -X POST "$BASE_URL/api/search-rates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC"
  }' | jq '.success' || echo "❌ Test failed"
echo ""

echo "=========================================="
echo "Tests Complete!"
echo "=========================================="

