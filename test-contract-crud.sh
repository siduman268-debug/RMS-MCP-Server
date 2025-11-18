#!/bin/bash

# Test script for Contract CRUD operations
# This tests CREATE, READ, UPDATE, DELETE for contracts

BASE_URL="${BASE_URL:-http://185.199.53.169:3000}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000001}"
USER_ID="${USER_ID:-user-001}"

echo "==============================================="
echo "CONTRACT CRUD TEST SUITE"
echo "==============================================="
echo ""

# Step 1: Get JWT Token
echo "1. Getting JWT token..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": \"$TENANT_ID\",
    \"user_id\": \"$USER_ID\"
  }")

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""

# Step 1.5: Get a vendor ID to use for the contract
echo "1.5. Getting vendor ID..."
VENDORS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/vendors?limit=1" \
  -H "Authorization: Bearer $TOKEN")

VENDOR_ID=$(echo $VENDORS_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$VENDOR_ID" ]; then
  echo "❌ No vendor found. Please create a vendor first."
  exit 1
fi

echo "✅ Using Vendor ID: $VENDOR_ID"
echo ""

# Step 2: CREATE - Create a new contract
echo "2. Creating new contract..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/contracts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"vendor_id\": $VENDOR_ID,
    \"name\": \"TEST SPOT CONTRACT\",
    \"mode\": \"ocean\",
    \"is_spot\": true,
    \"effective_from\": \"2025-01-01\",
    \"effective_to\": \"2025-12-31\",
    \"currency\": \"USD\",
    \"source_ref\": \"TEST-CONTRACT-001\",
    \"terms\": {\"payment_terms\": \"30 days\"}
  }")

echo "$CREATE_RESPONSE" | jq '.'

CONTRACT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$CONTRACT_ID" ]; then
  echo "❌ Failed to create contract"
  exit 1
fi

echo "✅ Contract created with ID: $CONTRACT_ID"
echo ""

# Step 3: READ - Get contract by ID
echo "3. Reading contract by ID..."
READ_RESPONSE=$(curl -s -X GET "$BASE_URL/api/contracts/$CONTRACT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$READ_RESPONSE" | jq '.'

if echo "$READ_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Contract read successfully"
  # Show the auto-generated contract number
  CONTRACT_NUMBER=$(echo $READ_RESPONSE | grep -o '"contract_number":"[^"]*"' | cut -d'"' -f4)
  echo "   Contract Number: $CONTRACT_NUMBER"
else
  echo "❌ Failed to read contract"
fi
echo ""

# Step 4: UPDATE - Update contract details
echo "4. Updating contract..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/contracts/$CONTRACT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "TEST SPOT CONTRACT UPDATED",
    "effective_to": "2026-06-30",
    "terms": {"payment_terms": "60 days", "notes": "Updated terms"}
  }')

echo "$UPDATE_RESPONSE" | jq '.'

if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Contract updated successfully"
else
  echo "❌ Failed to update contract"
fi
echo ""

# Step 5: LIST - Get all contracts
echo "5. Listing all contracts..."
LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/api/contracts?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "$LIST_RESPONSE" | jq '.data | map({id, contract_number, name, is_spot, vendor_name})'
echo "✅ Contracts list retrieved"
echo ""

# Step 6: DELETE - Delete the contract
echo "6. Deleting contract..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/contracts/$CONTRACT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$DELETE_RESPONSE" | jq '.'

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Contract deleted successfully"
else
  echo "❌ Failed to delete contract"
fi
echo ""

# Step 7: VERIFY DELETION - Try to read deleted contract
echo "7. Verifying deletion..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/contracts/$CONTRACT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$VERIFY_RESPONSE" | grep -q 'not found'; then
  echo "✅ Contract deletion verified (404 as expected)"
else
  echo "⚠️ Contract might still exist"
fi
echo ""

echo "==============================================="
echo "CONTRACT CRUD TEST COMPLETE"
echo "==============================================="

