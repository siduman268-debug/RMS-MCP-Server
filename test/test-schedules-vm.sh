#!/bin/bash
# Test V4 Schedule Search Endpoint on VM

BASE_URL="http://13.204.127.113:3000"
TENANT_ID="00000000-0000-0000-0000-000000000001"

echo "=== Getting Auth Token ==="
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"$TENANT_ID\",\"user_id\":\"schedule-test\"}" | \
  jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained"
echo ""

# Test 1: Point-to-point schedules (INNSA → NLRTM)
echo "=== Test 1: Point-to-point schedules (INNSA → NLRTM) ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "cargo_ready_date": "2025-11-18",
    "limit": 5
  }' | jq '.'
echo ""

# Test 2: All schedules from a port (INNSA) with date range
echo "=== Test 2: All schedules from INNSA (Nov 18-25) ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INNSA",
    "departure_from": "2025-11-18",
    "departure_to": "2025-11-25",
    "limit": 10
  }' | jq '.'
echo ""

# Test 3: Filter by carrier (Maersk)
echo "=== Test 3: Maersk schedules (INNSA → NLRTM) ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "carrier": "Maersk",
    "cargo_ready_date": "2025-11-18",
    "limit": 5
  }' | jq '.'
echo ""

# Test 4: Filter by service code
echo "=== Test 4: Filter by service code ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "service_code": "471",
    "cargo_ready_date": "2025-11-18",
    "limit": 5
  }' | jq '.'
echo ""

# Test 5: Filter by vessel name
echo "=== Test 5: Filter by vessel name ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INNSA",
    "vessel_name": "AL RIFFA",
    "limit": 5
  }' | jq '.'
echo ""

# Test 6: Filter by voyage
echo "=== Test 6: Filter by voyage ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INNSA",
    "voyage": "545W",
    "limit": 5
  }' | jq '.'
echo ""

# Test 7: Inland port (INTKD → NLRTM) - should show Portcast fallback
echo "=== Test 7: Inland port schedules (INTKD → NLRTM) ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INTKD",
    "destination": "NLRTM",
    "cargo_ready_date": "2025-11-18",
    "limit": 5
  }' | jq '.'
echo ""

# Test 8: MSC schedules (should use Portcast if available)
echo "=== Test 8: MSC schedules (INNSA → AEJEA) ==="
curl -s -X POST "$BASE_URL/api/v4/schedules/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "origin": "INNSA",
    "destination": "AEJEA",
    "carrier": "MSC",
    "cargo_ready_date": "2025-11-18",
    "limit": 5
  }' | jq '.'
echo ""

echo "=== All tests completed ==="


