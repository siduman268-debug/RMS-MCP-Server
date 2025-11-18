#!/bin/bash
# Test Contracts API with proper authentication

echo "========================================"
echo "Testing Contracts API"
echo "========================================"

echo ""
echo "Step 1: Getting authentication token..."

# Get token (adjust username/password if different)
TOKEN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "Token Response: $TOKEN_RESPONSE"

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Response was:"
  echo "$TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."

echo ""
echo "Step 2: Testing /api/contracts endpoint..."

CONTRACTS_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/contracts?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001")

echo "$CONTRACTS_RESPONSE" | jq

echo ""
echo "========================================"
echo "Checking for new fields..."
echo "========================================"

# Check if vendor_name exists
if echo "$CONTRACTS_RESPONSE" | jq -e '.data[0].vendor_name' > /dev/null 2>&1; then
  echo "✅ vendor_name field found"
else
  echo "❌ vendor_name field NOT found"
fi

# Check if contract_number exists
if echo "$CONTRACTS_RESPONSE" | jq -e '.data[0].contract_number' > /dev/null 2>&1; then
  echo "✅ contract_number field found"
else
  echo "❌ contract_number field NOT found"
fi

echo ""
echo "========================================"
echo "Sample Contract Data:"
echo "========================================"
echo "$CONTRACTS_RESPONSE" | jq '.data[0] | {id, contract_number, name, vendor_name, vendor_id, is_spot}'

echo ""

