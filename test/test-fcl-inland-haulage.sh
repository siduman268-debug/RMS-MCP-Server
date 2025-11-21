#!/bin/bash

##############################################################################
# FCL Inland Haulage Pricing Models Test Suite
# Tests all 3 pricing models to prevent double-charging
##############################################################################

BASE_URL="http://localhost:3000"
TENANT_ID="00000000-0000-0000-0000-000000000001"

# Test JWT token (replace with your actual token)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJ1c2VyX2lkIjoidGVzdC11c2VyIiwiaWF0IjoxNzYzNTQzNTAyLCJleHAiOjE3NjM1NDcxMDJ9._qNQ1wMM_IkZGqw-pNi48HuwmB5jCt6EHpCKYCR6dlY"

echo "🧪 FCL Inland Haulage Pricing Models Test Suite"
echo "================================================"
echo ""

##############################################################################
# SETUP: Tag test rates with different pricing models
##############################################################################

echo "📝 SETUP: Tagging test rates with pricing models..."
echo ""

# Find a rate with inland origin (INSON -> any port)
echo "1️⃣ Finding inland origin rate (INSON)..."
INLAND_RATE=$(curl -s -X GET "${BASE_URL}/api/ocean-freight?origin=INSON&limit=1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" | jq -r '.data[0].id // empty')

if [ -z "$INLAND_RATE" ]; then
  echo "❌ No inland origin rate found. Creating sample rate..."
  # Would need to create a rate here, or skip test
  echo "⚠️  Skipping - please create a rate with origin=INSON first"
else
  echo "✅ Found inland rate ID: $INLAND_RATE"
fi

echo ""
echo "================================================"
echo ""

##############################################################################
# TEST 1: Gateway Port Pricing (Default/Traditional)
# Ocean FROM port + separate IHE
##############################################################################

echo "🧪 TEST 1: Gateway Port Pricing (Traditional)"
echo "-----------------------------------------------"
echo "Scenario: Ocean INNSA-NLRTM + separate IHE INSON-INNSA"
echo "Expected: IHE should be calculated and added"
echo ""

QUOTE_1=$(curl -s -X POST "${BASE_URL}/api/v4/prepare-quote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "quote_id": "TEST-GATEWAY-001",
    "origin": "INSON",
    "destination": "NLRTM",
    "service_type": "FCL",
    "haulage_type": "MERCHANT",
    "container_details": [
      {
        "container_type": "40HC",
        "container_count": 1,
        "cargo_weight_mt": 10
      }
    ]
  }')

echo "📊 Response:"
echo "$QUOTE_1" | jq '{
  success: .success,
  pricing_model: .quote_details.inland_haulage.pricing_model,
  ocean_freight: .quote_details.ocean_freight.ocean_freight_cost_usd,
  ihe_charges: .quote_details.inland_haulage.ihe_charges.total_amount_usd,
  ihe_bundled: .quote_details.inland_haulage.ihe_charges.bundled,
  total_before_margin: .quote_details.totals.total_before_margin_usd,
  notes: .quote_details.inland_haulage.notes
}'

IHE_1=$(echo "$QUOTE_1" | jq -r '.quote_details.inland_haulage.ihe_charges.total_amount_usd // 0')
if [ "$IHE_1" != "0" ] && [ "$IHE_1" != "null" ]; then
  echo "✅ TEST 1 PASSED: IHE charges applied ($IHE_1 USD)"
else
  echo "❌ TEST 1 FAILED: IHE charges should be > 0"
fi

echo ""
echo "================================================"
echo ""

##############################################################################
# TEST 2: All-Inclusive Pricing
# Ocean rate already includes IHE - should NOT add it again
##############################################################################

echo "🧪 TEST 2: All-Inclusive Pricing (Bundled IHE)"
echo "-----------------------------------------------"
echo "Scenario: Maersk INSON-NLRTM door rate with IHE included"
echo "Expected: IHE should be $0 (bundled in ocean rate)"
echo ""

# First, tag a rate as all-inclusive (if we have one)
if [ -n "$INLAND_RATE" ]; then
  echo "🏷️  Tagging rate $INLAND_RATE as all-inclusive..."
  
  # Note: This would need a PATCH endpoint on ocean-freight
  # For now, let's simulate with a manual DB update
  echo "⚠️  Manual step required: Run this SQL in Supabase:"
  echo ""
  echo "UPDATE ocean_freight_rate"
  echo "SET includes_inland_haulage = jsonb_build_object("
  echo "  'ihe_included', true,"
  echo "  'pricing_model', 'all_inclusive',"
  echo "  'notes', 'TEST: Door-to-door all-inclusive rate'"
  echo ")"
  echo "WHERE id = $INLAND_RATE;"
  echo ""
  echo "Press Enter after running the SQL update..."
  read -p ""
fi

QUOTE_2=$(curl -s -X POST "${BASE_URL}/api/v4/prepare-quote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "quote_id": "TEST-ALLINCLUSIVE-001",
    "origin": "INSON",
    "destination": "NLRTM",
    "service_type": "FCL",
    "haulage_type": "MERCHANT",
    "container_details": [
      {
        "container_type": "40HC",
        "container_count": 1,
        "cargo_weight_mt": 10
      }
    ]
  }')

echo "📊 Response:"
echo "$QUOTE_2" | jq '{
  success: .success,
  pricing_model: .quote_details.inland_haulage.pricing_model,
  ocean_freight: .quote_details.ocean_freight.ocean_freight_cost_usd,
  ihe_charges: .quote_details.inland_haulage.ihe_charges.total_amount_usd,
  ihe_bundled: .quote_details.inland_haulage.ihe_charges.bundled,
  total_before_margin: .quote_details.totals.total_before_margin_usd,
  notes: .quote_details.inland_haulage.notes
}'

IHE_2=$(echo "$QUOTE_2" | jq -r '.quote_details.inland_haulage.ihe_charges.total_amount_usd // 0')
BUNDLED_2=$(echo "$QUOTE_2" | jq -r '.quote_details.inland_haulage.ihe_charges.bundled // false')

if [ "$IHE_2" = "0" ] && [ "$BUNDLED_2" = "true" ]; then
  echo "✅ TEST 2 PASSED: IHE is bundled, no separate charge"
else
  echo "❌ TEST 2 FAILED: IHE should be $0 and bundled=true"
  echo "   Got: IHE=$IHE_2, bundled=$BUNDLED_2"
fi

echo ""
echo "================================================"
echo ""

##############################################################################
# TEST 3: Inland Origin Pricing
# Ocean FROM inland point + separate IHE
##############################################################################

echo "🧪 TEST 3: Inland Origin Pricing"
echo "-----------------------------------------------"
echo "Scenario: Ocean INSON-NLRTM + separate IHE INSON-INNSA"
echo "Expected: IHE should be calculated from inland to POL"
echo ""

if [ -n "$INLAND_RATE" ]; then
  echo "🏷️  Tagging rate $INLAND_RATE as inland_origin..."
  echo ""
  echo "⚠️  Manual step required: Run this SQL in Supabase:"
  echo ""
  echo "UPDATE ocean_freight_rate"
  echo "SET includes_inland_haulage = jsonb_build_object("
  echo "  'ihe_included', false,"
  echo "  'ihe_from_location', 'INSON',"
  echo "  'ihe_to_location', 'INNSA',"
  echo "  'pricing_model', 'inland_origin',"
  echo "  'notes', 'TEST: Ocean priced from inland, IHE billed separately'"
  echo ")"
  echo "WHERE id = $INLAND_RATE;"
  echo ""
  echo "Press Enter after running the SQL update..."
  read -p ""
fi

QUOTE_3=$(curl -s -X POST "${BASE_URL}/api/v4/prepare-quote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "quote_id": "TEST-INLANDORIGIN-001",
    "origin": "INSON",
    "destination": "NLRTM",
    "service_type": "FCL",
    "haulage_type": "MERCHANT",
    "container_details": [
      {
        "container_type": "40HC",
        "container_count": 1,
        "cargo_weight_mt": 10
      }
    ]
  }')

echo "📊 Response:"
echo "$QUOTE_3" | jq '{
  success: .success,
  pricing_model: .quote_details.inland_haulage.pricing_model,
  ocean_freight: .quote_details.ocean_freight.ocean_freight_cost_usd,
  ihe_charges: .quote_details.inland_haulage.ihe_charges.total_amount_usd,
  ihe_bundled: .quote_details.inland_haulage.ihe_charges.bundled,
  total_before_margin: .quote_details.totals.total_before_margin_usd,
  notes: .quote_details.inland_haulage.notes
}'

IHE_3=$(echo "$QUOTE_3" | jq -r '.quote_details.inland_haulage.ihe_charges.total_amount_usd // 0')
if [ "$IHE_3" != "0" ] && [ "$IHE_3" != "null" ]; then
  echo "✅ TEST 3 PASSED: IHE charges applied ($IHE_3 USD)"
else
  echo "❌ TEST 3 FAILED: IHE charges should be > 0"
fi

echo ""
echo "================================================"
echo ""

##############################################################################
# SUMMARY
##############################################################################

echo "📊 TEST SUMMARY"
echo "================================================"
echo "Test 1 (Gateway Port):     ${IHE_1:-N/A} USD IHE"
echo "Test 2 (All-Inclusive):    ${IHE_2:-N/A} USD IHE (bundled: ${BUNDLED_2:-N/A})"
echo "Test 3 (Inland Origin):    ${IHE_3:-N/A} USD IHE"
echo ""
echo "Expected:"
echo "  - Test 1 & 3: IHE > 0 (separate charge)"
echo "  - Test 2: IHE = 0 (bundled)"
echo ""

##############################################################################
# CLEANUP
##############################################################################

echo "🧹 CLEANUP"
echo "================================================"
echo "Reverting test rate to default (gateway_port)..."
echo ""

if [ -n "$INLAND_RATE" ]; then
  echo "⚠️  Manual cleanup: Run this SQL in Supabase:"
  echo ""
  echo "UPDATE ocean_freight_rate"
  echo "SET includes_inland_haulage = NULL"
  echo "WHERE id = $INLAND_RATE;"
  echo ""
fi

echo "✅ Tests complete!"
echo ""



