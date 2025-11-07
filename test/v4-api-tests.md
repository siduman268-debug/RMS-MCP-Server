# V4 API Testing Guide

## Test Scenarios

### 1. V4 Search Rates - Basic Test
### 2. V4 Search Rates - With Inland Port
### 3. V4 Search Rates - With Earliest Departure
### 4. V4 Prepare Quote - Basic Test
### 5. V4 Prepare Quote - With Inland Port
### 6. V4 Prepare Quote - With Earliest Departure
### 7. V1/V2/V3 APIs - Backward Compatibility Test

---

## Prerequisites

1. Server running on `http://localhost:3000` (or your port)
2. Valid JWT token (get from `/api/auth/token`)
3. Valid `x-tenant-id` header: `00000000-0000-0000-0000-000000000001`

---

## Test 1: V4 Search Rates - Basic

**Endpoint:** `POST /api/v4/search-rates`

**Request:**
```json
{
  "origin": "INNSA",
  "destination": "NLRTM",
  "container_type": "40HC"
}
```

**Expected:**
- ✅ Returns rates with `origin`/`destination` fields
- ✅ Uses `origin_code`/`destination_code` from database
- ✅ All pricing fields present

---

## Test 2: V4 Search Rates - With Inland Port

**Endpoint:** `POST /api/v4/search-rates`

**Request:**
```json
{
  "origin": "INTKD",
  "destination": "NLRTM",
  "container_type": "40HC",
  "cargo_weight_mt": 10,
  "haulage_type": "carrier"
}
```

**Expected:**
- ✅ Returns rates
- ✅ Automatically includes `inland_haulage` if origin is inland
- ✅ Has `ihe_charges` and `ihi_charges` if applicable

---

## Test 3: V4 Search Rates - With Earliest Departure

**Endpoint:** `POST /api/v4/search-rates`

**Request:**
```json
{
  "origin": "INNSA",
  "destination": "NLRTM",
  "container_type": "40HC",
  "include_earliest_departure": true
}
```

**Expected:**
- ✅ Returns rates
- ✅ Each rate has `earliest_departure` object
- ✅ `earliest_departure.found` is true/false
- ✅ If found, has `departure_date` and `vessel_name`

---

## Test 4: V4 Prepare Quote - Basic

**Endpoint:** `POST /api/v4/prepare-quote`

**Request:**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "origin": "INNSA",
  "destination": "NLRTM",
  "container_type": "40HC",
  "container_count": 1
}
```

**Expected:**
- ✅ Returns complete quote
- ✅ Uses `origin`/`destination` in request
- ✅ Returns `origin`/`destination` in response
- ✅ Has all quote parts (ocean freight, origin charges, destination charges)
- ✅ Has totals

---

## Test 5: V4 Prepare Quote - With Inland Port

**Endpoint:** `POST /api/v4/prepare-quote`

**Request:**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "origin": "INTKD",
  "destination": "NLRTM",
  "container_type": "40HC",
  "container_count": 1,
  "cargo_weight_mt": 10,
  "haulage_type": "carrier"
}
```

**Expected:**
- ✅ Returns complete quote
- ✅ Automatically includes `inland_haulage` in totals
- ✅ `inland_haulage_total_usd` > 0 if inland detected
- ✅ Has `inland_haulage` object with IHE/IHI details

---

## Test 6: V4 Prepare Quote - With Earliest Departure

**Endpoint:** `POST /api/v4/prepare-quote`

**Request:**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "origin": "INNSA",
  "destination": "NLRTM",
  "container_type": "40HC",
  "container_count": 1,
  "include_earliest_departure": true
}
```

**Expected:**
- ✅ Returns complete quote
- ✅ Has `earliest_departure` object
- ✅ `earliest_departure.found` is true/false
- ✅ If found, has departure details

---

## Test 7: V1 Search Rates - Backward Compatibility

**Endpoint:** `POST /api/search-rates`

**Request:**
```json
{
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC"
}
```

**Expected:**
- ✅ Still works with `pol_code`/`pod_code`
- ✅ Returns same data structure as before
- ✅ No errors

---

## Test 8: V1 Prepare Quote - Backward Compatibility

**Endpoint:** `POST /api/prepare-quote`

**Request:**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 1
}
```

**Expected:**
- ✅ Still works with `pol_code`/`pod_code`
- ✅ Returns same data structure as before
- ✅ No errors

---

## Error Cases to Test

### 1. Missing Required Fields
**Request:**
```json
{
  "origin": "INNSA"
  // Missing destination
}
```
**Expected:** 400 error with clear message

### 2. Inland Port Without Required Params
**Request:**
```json
{
  "origin": "INTKD",
  "destination": "NLRTM",
  "container_type": "40HC"
  // Missing cargo_weight_mt and haulage_type
}
```
**Expected:** 400 error asking for `cargo_weight_mt` and `haulage_type`

### 3. Invalid Port Codes
**Request:**
```json
{
  "origin": "INVALID",
  "destination": "NLRTM",
  "container_type": "40HC"
}
```
**Expected:** Returns empty results or 404, not server error

---

## Quick Test Commands (cURL)

Replace `YOUR_TOKEN` and `YOUR_TENANT_ID` with actual values.

```bash
# Test 1: V4 Search Rates
curl -X POST http://localhost:3000/api/v4/search-rates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC"
  }'

# Test 2: V4 Prepare Quote
curl -X POST http://localhost:3000/api/v4/prepare-quote \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC",
    "container_count": 1
  }'

# Test 3: V1 Search Rates (Backward Compatibility)
curl -X POST http://localhost:3000/api/search-rates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC"
  }'
```

---

## Success Criteria

✅ All V4 endpoints work with `origin`/`destination`  
✅ All V1/V2/V3 endpoints still work with `pol_code`/`pod_code`  
✅ Inland detection works automatically  
✅ Earliest departure integration works  
✅ No database errors  
✅ Response structures match expected format  

