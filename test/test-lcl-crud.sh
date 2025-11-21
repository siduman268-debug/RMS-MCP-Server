#!/bin/bash

# LCL CRUD API Test Script
# Tests all 18 LCL endpoints

API_URL="http://localhost:3000"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJ1c2VyX2lkIjoidGVzdC11c2VyIiwiaWF0IjoxNzYzNTQzNTAyLCJleHAiOjE3NjM1NDcxMDJ9._qNQ1wMM_IkZGqw-pNi48HuwmB5jCt6EHpCKYCR6dlY"

echo "=================================="
echo "LCL CRUD API Tests"
echo "=================================="
echo ""

# ============================================================================
# 1. LCL OCEAN FREIGHT RATE TESTS
# ============================================================================

echo "1️⃣  Testing LCL Ocean Freight Rates..."
echo ""

# List all LCL rates
echo "📋 GET /api/lcl-rates (List all rates)"
curl -s -X GET "$API_URL/api/lcl-rates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data | length, .[0] | {id, origin_code, destination_code, pricing_model, rate_per_cbm}'
echo ""

# Filter by origin
echo "📋 GET /api/lcl-rates?origin_code=INNSA (Filter by origin)"
curl -s -X GET "$API_URL/api/lcl-rates?origin_code=INNSA" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data | length'
echo ""

# Get single rate
echo "📋 GET /api/lcl-rates/13 (Get single rate)"
curl -s -X GET "$API_URL/api/lcl-rates/13" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data | {id, origin_code, destination_code, rate_per_cbm, vendor}'
echo ""

# Create new rate
echo "✏️  POST /api/lcl-rates (Create new rate)"
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/lcl-rates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 1,
    "origin_code": "INMUN",
    "destination_code": "USNYC",
    "service_type": "CONSOLIDATED",
    "pricing_model": "FLAT_RATE",
    "rate_basis": "PER_CBM",
    "min_volume_cbm": 0,
    "rate_per_cbm": 70.00,
    "minimum_charge": 100.00,
    "currency": "USD",
    "valid_from": "2025-01-01",
    "valid_to": "2025-12-31"
  }')

NEW_RATE_ID=$(echo $CREATE_RESPONSE | jq -r '.data.id')
echo "Created rate ID: $NEW_RATE_ID"
echo $CREATE_RESPONSE | jq '.data | {id, origin_code, destination_code, rate_per_cbm}'
echo ""

# Update rate
echo "✏️  PUT /api/lcl-rates/$NEW_RATE_ID (Update rate)"
curl -s -X PUT "$API_URL/api/lcl-rates/$NEW_RATE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rate_per_cbm": 75.00,
    "minimum_charge": 120.00
  }' | jq '.data | {id, rate_per_cbm, minimum_charge}'
echo ""

# Delete rate
echo "🗑️  DELETE /api/lcl-rates/$NEW_RATE_ID (Delete rate)"
curl -s -X DELETE "$API_URL/api/lcl-rates/$NEW_RATE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.success, .message'
echo ""

# ============================================================================
# 2. LCL SURCHARGE TESTS
# ============================================================================

echo "2️⃣  Testing LCL Surcharges..."
echo ""

# List all LCL surcharges
echo "📋 GET /api/lcl-surcharges (List all surcharges)"
curl -s -X GET "$API_URL/api/lcl-surcharges" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data | length, .[0] | {id, charge_code, applies_scope, amount}'
echo ""

# Filter by charge code
echo "📋 GET /api/lcl-surcharges?charge_code=BAF"
curl -s -X GET "$API_URL/api/lcl-surcharges?charge_code=BAF" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data | length, .[0]'
echo ""

# Create new surcharge
echo "✏️  POST /api/lcl-surcharges (Create new surcharge)"
SURCHARGE_RESPONSE=$(curl -s -X POST "$API_URL/api/lcl-surcharges" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 1,
    "charge_code": "DOC_FEE",
    "applies_scope": "other",
    "rate_basis": "PER_SHIPMENT",
    "amount": 35.00,
    "currency": "USD",
    "valid_from": "2025-01-01",
    "valid_to": "2025-12-31"
  }')

NEW_SURCHARGE_ID=$(echo $SURCHARGE_RESPONSE | jq -r '.data.id')
echo "Created surcharge ID: $NEW_SURCHARGE_ID"
echo $SURCHARGE_RESPONSE | jq '.data | {id, charge_code, amount}'
echo ""

# Update surcharge
echo "✏️  PUT /api/lcl-surcharges/$NEW_SURCHARGE_ID (Update surcharge)"
curl -s -X PUT "$API_URL/api/lcl-surcharges/$NEW_SURCHARGE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 40.00
  }' | jq '.data | {id, charge_code, amount}'
echo ""

# Delete surcharge
echo "🗑️  DELETE /api/lcl-surcharges/$NEW_SURCHARGE_ID (Delete surcharge)"
curl -s -X DELETE "$API_URL/api/lcl-surcharges/$NEW_SURCHARGE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.success, .message'
echo ""

# ============================================================================
# 3. LCL SHIPMENT ITEM TESTS
# ============================================================================

echo "3️⃣  Testing LCL Shipment Items..."
echo ""

# Create shipment item
echo "✏️  POST /api/lcl-items (Create shipment item)"
ITEM_RESPONSE=$(curl -s -X POST "$API_URL/api/lcl-items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enquiry_id": "TEST-LCL-001",
    "length_cm": 100,
    "width_cm": 80,
    "height_cm": 60,
    "gross_weight_kg": 200,
    "pieces": 5,
    "commodity": "Electronics",
    "packaging_type": "Carton"
  }')

NEW_ITEM_ID=$(echo $ITEM_RESPONSE | jq -r '.data.id')
echo "Created item ID: $NEW_ITEM_ID"
echo $ITEM_RESPONSE | jq '.data | {id, volume_cbm, volumetric_weight_kg, chargeable_weight_kg, total_volume_cbm}'
echo ""

# List items by enquiry
echo "📋 GET /api/lcl-items?enquiry_id=TEST-LCL-001"
curl -s -X GET "$API_URL/api/lcl-items?enquiry_id=TEST-LCL-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data | length, .[0] | {id, enquiry_id, total_volume_cbm, total_chargeable_weight_kg}'
echo ""

# Get single item
echo "📋 GET /api/lcl-items/$NEW_ITEM_ID (Get single item)"
curl -s -X GET "$API_URL/api/lcl-items/$NEW_ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data | {id, volume_cbm, chargeable_weight_kg}'
echo ""

# Update item
echo "✏️  PUT /api/lcl-items/$NEW_ITEM_ID (Update item)"
curl -s -X PUT "$API_URL/api/lcl-items/$NEW_ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pieces": 10
  }' | jq '.data | {id, pieces, total_volume_cbm, total_chargeable_weight_kg}'
echo ""

# Delete item
echo "🗑️  DELETE /api/lcl-items/$NEW_ITEM_ID (Delete item)"
curl -s -X DELETE "$API_URL/api/lcl-items/$NEW_ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.success, .message'
echo ""

# ============================================================================
# 4. BULK OPERATIONS TESTS
# ============================================================================

echo "4️⃣  Testing Bulk Operations..."
echo ""

# Bulk create rates
echo "✏️  POST /api/lcl-rates/bulk (Bulk create rates)"
curl -s -X POST "$API_URL/api/lcl-rates/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rates": [
      {
        "vendor_id": 2,
        "origin_code": "INNSA",
        "destination_code": "USNYC",
        "service_type": "DIRECT",
        "pricing_model": "FLAT_RATE",
        "rate_basis": "PER_CBM",
        "rate_per_cbm": 85.00,
        "minimum_charge": 150.00,
        "currency": "USD",
        "valid_from": "2025-01-01",
        "valid_to": "2025-12-31"
      },
      {
        "vendor_id": 3,
        "origin_code": "INNSA",
        "destination_code": "GBLON",
        "service_type": "CONSOLIDATED",
        "pricing_model": "FLAT_RATE",
        "rate_basis": "PER_CBM",
        "rate_per_cbm": 65.00,
        "minimum_charge": 100.00,
        "currency": "GBP",
        "valid_from": "2025-01-01",
        "valid_to": "2025-12-31"
      }
    ]
  }' | jq '.success, .message, .data | length'
echo ""

echo "=================================="
echo "✅ All LCL CRUD API tests complete!"
echo "=================================="

