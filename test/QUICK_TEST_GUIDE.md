# Quick API Test Guide

## Prerequisites

1. **Get JWT Token:**
```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }'
```

2. **Set Variables:**
```bash
export TOKEN="your_jwt_token_here"
export TENANT_ID="00000000-0000-0000-0000-000000000001"
```

---

## Test 1: V4 Search Rates ✅

```bash
curl -X POST http://localhost:3000/api/v4/search-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC"
  }' | jq
```

**Expected:** Returns rates with `origin`/`destination` fields

---

## Test 2: V4 Prepare Quote ✅

```bash
curl -X POST http://localhost:3000/api/v4/prepare-quote \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC",
    "container_count": 1
  }' | jq
```

**Expected:** Returns complete quote with `origin`/`destination` in response

---

## Test 3: V4 Search Rates with Earliest Departure ✅

```bash
curl -X POST http://localhost:3000/api/v4/search-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC",
    "include_earliest_departure": true
  }' | jq
```

**Expected:** Each rate has `earliest_departure` object

---

## Test 4: V4 Prepare Quote with Earliest Departure ✅

```bash
curl -X POST http://localhost:3000/api/v4/prepare-quote \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC",
    "container_count": 1,
    "include_earliest_departure": true
  }' | jq
```

**Expected:** Quote has `earliest_departure` object

---

## Test 5: V4 with Inland Port (Automatic Haulage) ✅

```bash
curl -X POST http://localhost:3000/api/v4/search-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INTKD",
    "destination": "NLRTM",
    "container_type": "40HC",
    "cargo_weight_mt": 10,
    "haulage_type": "carrier"
  }' | jq
```

**Expected:** Automatically includes `inland_haulage` if origin is inland

---

## Test 6: V1 Search Rates (Backward Compatibility) ✅

```bash
curl -X POST http://localhost:3000/api/search-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC"
  }' | jq
```

**Expected:** Still works with `pol_code`/`pod_code`

---

## Test 7: V1 Prepare Quote (Backward Compatibility) ✅

```bash
curl -X POST http://localhost:3000/api/prepare-quote \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 1
  }' | jq
```

**Expected:** Still works with `pol_code`/`pod_code`

---

## Error Test: Missing Required Fields ❌

```bash
curl -X POST http://localhost:3000/api/v4/search-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INNSA"
  }' | jq
```

**Expected:** 400 error with message about missing `destination`

---

## What to Check

### V4 Search Rates Response:
```json
{
  "success": true,
  "data": [
    {
      "origin": "INNSA",           // ✅ NEW field
      "destination": "NLRTM",      // ✅ NEW field
      "vendor": "...",
      "route": "...",
      "pricing": {...},
      "inland_haulage": {...},     // ✅ If inland detected
      "earliest_departure": {...}  // ✅ If requested
    }
  ]
}
```

### V4 Prepare Quote Response:
```json
{
  "success": true,
  "data": {
    "route": {
      "origin": "INNSA",           // ✅ NEW field
      "destination": "NLRTM"       // ✅ NEW field
    },
    "quote_parts": {...},
    "totals": {
      "inland_haulage_total_usd": 0  // ✅ If inland detected
    },
    "inland_haulage": {...},       // ✅ If inland detected
    "earliest_departure": {...}    // ✅ If requested
  }
}
```

---

## Success Checklist

- [ ] V4 search-rates works with `origin`/`destination`
- [ ] V4 prepare-quote works with `origin`/`destination`
- [ ] V1/V2/V3 still work with `pol_code`/`pod_code`
- [ ] Inland detection works automatically
- [ ] Earliest departure integration works
- [ ] Error handling works correctly
- [ ] Response structures match expected format

