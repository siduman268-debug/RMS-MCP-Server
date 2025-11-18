#!/bin/bash

# Test script for Vendor CRUD operations
# This tests CREATE, READ, UPDATE, DELETE for vendors

BASE_URL="${BASE_URL:-http://185.199.53.169:3000}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000001}"
USER_ID="${USER_ID:-user-001}"

echo "==============================================="
echo "VENDOR CRUD TEST SUITE"
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

# Step 2: CREATE - Create a new vendor
echo "2. Creating new vendor..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/vendors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "TEST VENDOR LINE",
    "alias": "TVL",
    "vendor_type": "carrier",
    "mode": ["ocean", "air"],
    "external_ref": "TEST-001"
  }')

echo "$CREATE_RESPONSE" | jq '.'

VENDOR_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$VENDOR_ID" ]; then
  echo "❌ Failed to create vendor"
  exit 1
fi

echo "✅ Vendor created with ID: $VENDOR_ID"
echo ""

# Step 3: READ - Get vendor by ID
echo "3. Reading vendor by ID..."
READ_RESPONSE=$(curl -s -X GET "$BASE_URL/api/vendors/$VENDOR_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$READ_RESPONSE" | jq '.'

if echo "$READ_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Vendor read successfully"
else
  echo "❌ Failed to read vendor"
fi
echo ""

# Step 4: UPDATE - Update vendor details
echo "4. Updating vendor..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/vendors/$VENDOR_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "TEST VENDOR LINE UPDATED",
    "alias": "TVLU",
    "mode": ["ocean", "air", "rail"]
  }')

echo "$UPDATE_RESPONSE" | jq '.'

if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Vendor updated successfully"
else
  echo "❌ Failed to update vendor"
fi
echo ""

# Step 5: LIST - Get all vendors
echo "5. Listing all vendors..."
LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/api/vendors?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "$LIST_RESPONSE" | jq '.data | map({id, name, vendor_type})'
echo "✅ Vendors list retrieved"
echo ""

# Step 6: DELETE - Delete the vendor
echo "6. Deleting vendor..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/vendors/$VENDOR_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$DELETE_RESPONSE" | jq '.'

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Vendor deleted successfully"
else
  echo "❌ Failed to delete vendor"
fi
echo ""

# Step 7: VERIFY DELETION - Try to read deleted vendor
echo "7. Verifying deletion..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/vendors/$VENDOR_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$VERIFY_RESPONSE" | grep -q 'not found'; then
  echo "✅ Vendor deletion verified (404 as expected)"
else
  echo "⚠️ Vendor might still exist"
fi
echo ""

echo "==============================================="
echo "VENDOR CRUD TEST COMPLETE"
echo "==============================================="

