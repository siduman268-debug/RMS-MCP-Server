# Haulage V4 API Integration - Existing Implementation Analysis

## 📋 EXECUTIVE SUMMARY

**Good News**: The inland haulage system is **ALREADY INTEGRATED** into the V4 API! 🎉

The system has:
✅ Database function (`simplified_inland_function`) for IHE/IHI pricing  
✅ TypeScript service (`InlandPricingService`) wrapping the DB function  
✅ V4 API endpoints (`/api/v4/search-rates`, `/api/v4/prepare-quote`) using the service  
✅ Automatic inland port detection  
✅ Weight-based rate calculation  
✅ Exchange rate handling (INR ↔ USD)  
✅ Haulage responsibility logic (merchant vs carrier)  

**What We Need to Build for Tomorrow**:
- ✅ CRUD APIs for haulage management (create/edit/delete routes, rates, legs, responsibilities)
- ✅ LWC UI for managing haulage data
- ❌ **NO NEED** to integrate into V4 API - it's already done!

---

## 🔍 CURRENT IMPLEMENTATION ANALYSIS

### 1. Database Function: `simplified_inland_function`

**Location**: `simplified_v3_ihe_ihi.sql`

**Purpose**: Calculates IHE (Inland Haulage Export) and IHI (Inland Haulage Import) charges

**Parameters**:
```sql
simplified_inland_function(
    p_pol_code TEXT,              -- Origin UN/LOCODE
    p_pod_code TEXT,              -- Destination UN/LOCODE
    p_container_type TEXT,        -- Container type (20GP, 40HC, etc.)
    p_container_count INTEGER,    -- Number of containers
    p_cargo_weight_mt NUMERIC,    -- Cargo weight in metric tons
    p_haulage_type TEXT,          -- 'merchant' or 'carrier'
    p_vendor_id INTEGER           -- Optional vendor filter
)
RETURNS JSONB
```

**Logic Flow**:

```
1. Get Exchange Rate (INR ↔ USD)
   ├─→ Try: Today's rate from fx_rate table
   ├─→ Fallback 1: Latest available rate
   └─→ Fallback 2: Hard-coded 83.0

2. Get Location IDs and Check if Inland
   ├─→ POL: Get id, is_container_inland from locations
   └─→ POD: Get id, is_container_inland from locations

3. Calculate IHE (if POL is inland AND haulage_type = 'carrier')
   ├─→ Find haulage_route from inland POL to gateway port
   ├─→ Find haulage_rate:
   │   ├─→ Matching route_id
   │   ├─→ Matching container_type
   │   ├─→ Weight in range: min_weight_kg <= cargo_weight <= max_weight_kg
   │   ├─→ Valid dates: CURRENT_DATE BETWEEN valid_from AND valid_to
   │   └─→ Active: is_active = true
   ├─→ Calculate:
   │   ├─→ buy_inr = rate_per_container × container_count
   │   ├─→ sell_inr = rate_per_container × container_count
   │   ├─→ buy_usd = buy_inr / exchange_rate
   │   └─→ sell_usd = sell_inr / exchange_rate
   └─→ Return IHE charges JSON

4. Calculate IHI (if POD is inland AND haulage_type = 'carrier')
   └─→ Same logic as IHE (gateway → inland destination)

5. Return Combined Result
   └─→ { success, ihe_charges, ihi_charges, totals }
```

**Key Features**:
- ✅ **Weight Range Matching**: Handles `min_weight_kg` and `max_weight_kg` with NULL support
- ✅ **Vendor Filtering**: Optional `p_vendor_id` for vendor-specific rates
- ✅ **Exchange Rate**: Dynamic INR/USD conversion
- ✅ **Merchant vs Carrier**: Only includes charges if `haulage_type = 'carrier'`

**Sample Response**:
```json
{
  "success": true,
  "ihe_charges": {
    "found": true,
    "rate_id": 123,
    "rate_per_container_inr": 18000,
    "total_amount_inr": 18000,
    "total_amount_usd": 216.87,
    "currency": "INR",
    "exchange_rate": 83.0,
    "vendor_name": "ABC Logistics",
    "route_name": "Sonipat to Mundra (Road)",
    "gateway_code": "INMUN",
    "distance_km": 1250,
    "transit_days": 3
  },
  "ihi_charges": {
    "found": false
  },
  "totals": {
    "total_buy_inr": 18000,
    "total_sell_inr": 18000,
    "total_buy_usd": 216.87,
    "total_sell_usd": 216.87
  }
}
```

---

### 2. TypeScript Service: `InlandPricingService`

**Location**: `src/INLAND_PRICING_SERVICE.ts`

**Purpose**: Wraps the database function with TypeScript types and error handling

**Key Method**:
```typescript
async priceInlandEnquiry(params: InlandPricingParams): Promise<InlandPricingResponse>
```

**Features**:
- ✅ Type-safe parameter validation
- ✅ Default values (cargo_weight_mt = 20MT, incoterm = 'CIF', haulage_type = 'carrier')
- ✅ Error handling and logging
- ✅ Calls `simplified_inland_function` RPC

**Usage Example**:
```typescript
const service = new InlandPricingService(supabase);
const result = await service.priceInlandEnquiry({
  pol_code: 'INSON',
  pod_code: 'INMUN',
  container_type: '40HC',
  container_count: 1,
  cargo_weight_mt: 25,
  haulage_type: 'carrier'
});
```

---

### 3. V4 API Integration

**Location**: `src/routes/v4-routes.ts`

#### Endpoint 1: `/api/v4/search-rates`

**Purpose**: Search for rates with automatic inland detection

**Key Logic**:
```typescript
// 1. Check if origin/destination are inland
const { originIsInland, destinationIsInland } = await scheduleService.checkInlandPorts(
  origin,
  destination
);

// 2. If inland, require cargo_weight_mt and haulage_type
if ((originIsInland || destinationIsInland) && (!cargo_weight_mt || !haulage_type)) {
  return reply.code(400).send({
    success: false,
    error: 'cargo_weight_mt and haulage_type are required when origin or destination is an inland port (ICD)'
  });
}

// 3. Search rates from mv_freight_sell_prices view
// 4. For each rate, check if inland haulage needs to be added
// 5. Call simplified_inland_function if needed
// 6. Add IHE/IHI to rate's total
```

**Request Example**:
```json
POST /api/v4/search-rates
{
  "origin": "INSON",
  "destination": "NLRTM",
  "container_type": "40HC",
  "cargo_weight_mt": 25,
  "haulage_type": "carrier",
  "vendor_name": "Maersk"
}
```

**Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "rate_id": 245,
      "origin": "INSON",
      "destination": "NLRTM",
      "ocean_freight_buy": 1200,
      "ocean_freight_sell": 1320,
      "ihe_charges": {
        "found": true,
        "total_amount_usd": 216.87,
        "route_name": "Sonipat to Mundra (Road)"
      },
      "total_buy": 1416.87,
      "total_sell": 1536.87
    }
  ]
}
```

#### Endpoint 2: `/api/v4/prepare-quote`

**Purpose**: Prepare detailed quote for a selected rate

**Key Logic**:
```typescript
// 1. Get rate by rate_id from mv_freight_sell_prices
// 2. Extract origin/destination from rate
// 3. Check if origin/destination are inland
// 4. If inland, call simplified_inland_function
// 5. Get local charges (origin/destination port charges)
// 6. Get earliest departure schedule (if requested)
// 7. Combine all costs into detailed quote
```

**Request Example**:
```json
POST /api/v4/prepare-quote
{
  "salesforce_org_id": "00D123456789ABC",
  "rate_id": 245,
  "container_count": 2,
  "cargo_weight_mt": 50,
  "haulage_type": "carrier",
  "include_earliest_departure": true,
  "cargo_ready_date": "2025-11-25"
}
```

**Response Example**:
```json
{
  "success": true,
  "quote": {
    "rate_id": 245,
    "origin": "INSON",
    "destination": "NLRTM",
    "container_type": "40HC",
    "container_count": 2,
    "ocean_freight": {
      "buy_usd": 2400,
      "sell_usd": 2640
    },
    "ihe_charges": {
      "route_name": "Sonipat to Mundra (Road)",
      "total_usd": 433.74,
      "per_container_usd": 216.87
    },
    "origin_charges": {
      "charges": [...],
      "total_usd": 150
    },
    "destination_charges": {
      "charges": [...],
      "total_usd": 200
    },
    "earliest_departure": {
      "pol_code": "INMUN",
      "departure_date": "2025-11-28",
      "vessel_name": "MSC GINA",
      "service_code": "ASIA-EUROPE"
    },
    "totals": {
      "total_buy_usd": 3183.74,
      "total_sell_usd": 3423.74,
      "margin_usd": 240
    }
  }
}
```

---

## 🔗 INTEGRATION POINTS

### How Haulage Connects to the Quote Flow:

```
1. User Searches Rates
   ↓
2. V4 API checks if origin/destination is inland
   ↓ (if inland)
3. Call simplified_inland_function
   ├─→ Find haulage_route (inland → gateway)
   ├─→ Find haulage_rate (with weight/container match)
   └─→ Calculate IHE/IHI charges
   ↓
4. Add haulage charges to ocean freight rate
   ↓
5. Return combined rate to user
   ↓
6. User selects a rate
   ↓
7. V4 API prepares detailed quote
   ├─→ Ocean Freight
   ├─→ IHE/IHI (if applicable)
   ├─→ Origin/Destination Charges
   ├─→ Earliest Departure Schedule
   └─→ Total with Margin
   ↓
8. Quote sent to Salesforce
```

---

## 📊 DATA FLOW DIAGRAM

```
┌────────────────────────────────────────────────────────────┐
│  USER REQUEST: Get quote for Sonipat → Rotterdam         │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│  V4 API: Check if INSON (Sonipat) is inland              │
│  ✅ Result: Yes, is_container_inland = true               │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│  DB Function: simplified_inland_function                  │
│  ├─→ Find route: Sonipat → Mundra Port                   │
│  ├─→ Find rate: ₹18,000 per 40HC                         │
│  ├─→ Convert: ₹18,000 / 83 = $216.87                     │
│  └─→ Return IHE charges                                   │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│  V4 API: Get ocean freight rate (Mundra → Rotterdam)     │
│  └─→ $1,200 from mv_freight_sell_prices                  │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│  V4 API: Combine Costs                                    │
│  ├─→ IHE: $216.87                                         │
│  ├─→ Ocean: $1,200                                        │
│  ├─→ Origin Charges: $150                                 │
│  ├─→ Dest Charges: $200                                   │
│  └─→ TOTAL: $1,766.87                                     │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│  RESPONSE: Complete quote sent to Salesforce             │
└────────────────────────────────────────────────────────────┘
```

---

## ✅ WHAT'S ALREADY WORKING

1. **Automatic Inland Detection** ✅
   - API checks `is_container_inland` flag in locations table
   - No manual input needed from user

2. **IHE/IHI Calculation** ✅
   - Database function handles all logic
   - Weight-based rate matching
   - Exchange rate conversion

3. **Haulage Responsibility** ✅
   - Merchant: Customer arranges, not in quote
   - Carrier: Shipping line arranges, included in quote

4. **Integration with Ocean Freight** ✅
   - IHE + Ocean Freight + IHI = Total
   - Seamless combination in V4 API

5. **Schedule Integration** ✅
   - Earliest departure from gateway port
   - Handles inland locations properly

---

## 🚧 WHAT'S MISSING (What We Need to Build Tomorrow)

### 1. CRUD APIs for Haulage Management ❌

**Currently**: Data is read-only from the quote flow  
**Need**: Create/Edit/Delete endpoints for:
- Haulage Routes
- Haulage Rates
- Haulage Legs
- Haulage Responsibilities

### 2. LWC UI for Haulage Management ❌

**Currently**: No UI to manage haulage data  
**Need**: LWC tab in RMS Management for:
- Creating new routes
- Adding rates for routes
- Managing multi-modal legs
- Configuring responsibility terms

### 3. Bulk Upload ❌

**Currently**: No bulk operations  
**Need**: CSV upload for:
- Bulk route creation
- Bulk rate updates
- Bulk leg definitions

---

## 💡 IMPLEMENTATION STRATEGY FOR TOMORROW

### Phase 1: Backend APIs (Morning)

**DO NOT TOUCH**:
- ❌ `simplified_inland_function` (already working)
- ❌ `InlandPricingService` (already working)
- ❌ V4 API endpoints (already integrated)

**BUILD NEW**:
- ✅ CRUD endpoints in `src/index.ts`:
  - `/api/haulage-routes` (GET, POST, PUT, DELETE)
  - `/api/haulage-rates` (GET, POST, PUT, DELETE)
  - `/api/haulage-legs` (GET, POST, PUT, DELETE)
  - `/api/haulage-responsibilities` (GET, POST, PUT, DELETE)

**ONLY FOR MANAGEMENT**, not for quote calculation!

### Phase 2: LWC UI (Afternoon)

**Purpose**: Allow users to manage haulage data through Salesforce

**Components**:
- `rmsHaulageManagement` - Main component
- `rmsHaulageRouteCards` - Route cards view
- `rmsHaulageRateTable` - Rate table
- `rmsHaulageLegTable` - Leg sequence table
- `rmsHaulageResponsibilityTable` - Responsibility reference

---

## 🎯 KEY INSIGHTS FOR IMPLEMENTATION

### 1. Rate Matching Logic is Complex

The database function uses this logic for weight matching:

```sql
WHERE (
    -- No weight restrictions
    (hrate.min_weight_kg IS NULL AND hrate.max_weight_kg IS NULL) 
    OR 
    -- Only max weight set
    (hrate.min_weight_kg IS NULL AND hrate.max_weight_kg >= (p_cargo_weight_mt * 1000)) 
    OR 
    -- Only min weight set
    (hrate.max_weight_kg IS NULL AND hrate.min_weight_kg <= (p_cargo_weight_mt * 1000)) 
    OR 
    -- Both min and max set
    (hrate.min_weight_kg <= (p_cargo_weight_mt * 1000) 
     AND hrate.max_weight_kg >= (p_cargo_weight_mt * 1000))
)
```

**Implication**: Our CRUD UI must support:
- ✅ Rates with no weight restrictions (NULL/NULL)
- ✅ Rates with only min weight (e.g., > 10 tons)
- ✅ Rates with only max weight (e.g., < 20 tons)
- ✅ Rates with both min and max (e.g., 10-20 tons)

### 2. Rate Basis is Critical

From `haulage_rate` table:
- `PER_CONTAINER`: Fixed rate per container type
- `WEIGHT_SLAB`: Tiered pricing by weight
- `PER_KG / PER_TON / PER_CBM`: Unit-based
- `FLAT`: One price for all

**Implication**: Our UI must:
- ✅ Show/hide fields based on rate_basis
- ✅ Validate required fields per basis type
- ✅ Display calculations correctly

### 3. Haulage Responsibility is Global

The `haulage_responsibility` table has **NO tenant_id**!

**Implication**:
- ✅ All tenants share the same responsibility terms
- ✅ Only admin users should edit these (reference data)
- ✅ Most users will just SELECT from this table

### 4. Exchange Rates Matter

The function uses `fx_rate` table for INR ↔ USD conversion.

**Implication**:
- ✅ Ensure fx_rate table is updated regularly
- ✅ Display which rate was used in quotes
- ✅ Allow manual rate override if needed

---

## 📝 RECOMMENDATIONS FOR TOMORROW

### 1. Keep V4 Logic Untouched ✅

The existing quote flow is working. Our CRUD APIs are **separate** for management only.

### 2. Focus on Management, Not Calculation ✅

Tomorrow we build the **data entry UI**, not the pricing engine.

### 3. Test Against Production Data ✅

We have:
- 15 routes
- 30 rates
- 2 legs
- 10 responsibilities

Use this real data to test our UI.

### 4. Maintain Consistency ✅

Our CRUD APIs should:
- ✅ Use same validation as database function
- ✅ Respect same constraints (CHECK, FK, NOT NULL)
- ✅ Follow same naming conventions

### 5. Don't Break Existing Quotes ⚠️

**CRITICAL**: Our changes should NOT affect:
- ❌ `simplified_inland_function`
- ❌ V4 API endpoints
- ❌ Existing quote flow

Only add new management endpoints!

---

## 🎉 CONCLUSION

**The inland haulage pricing engine is COMPLETE and WORKING!** 🎊

Tomorrow we're building the **management interface** to:
- ✅ Create/edit routes
- ✅ Manage rates
- ✅ Define legs
- ✅ Configure responsibilities

This is a **data management task**, not a pricing logic task!

The heavy lifting (rate matching, weight slabs, exchange rates, IHE/IHI logic) is already done in the database function.

**We're in a great position!** Let's build an awesome management UI! 🚀💪

---

## 📚 REFERENCE

### Files to Study:
1. `src/INLAND_PRICING_SERVICE.ts` - Service wrapper
2. `src/routes/v4-routes.ts` - API integration
3. `simplified_v3_ihe_ihi.sql` - Core pricing logic
4. `HAULAGE_SYSTEM_DOCUMENTATION.md` - Schema details

### Database Tables:
1. `haulage_route` - Route definitions
2. `haulage_rate` - Pricing (complex!)
3. `haulage_leg` - Multi-modal segments
4. `haulage_responsibility` - Terms (global reference)

### Key Concepts:
- IHE (Inland Haulage Export): Origin → Port
- IHI (Inland Haulage Import): Port → Destination
- Merchant Haulage: Customer arranges
- Carrier Haulage: Shipping line arranges
- Weight Slabs: Tiered pricing by weight
- Rate Basis: How rate is calculated

---

**Ready to build the management UI tomorrow!** 🚀


