# Inland Haulage V4 API Integration Analysis
**Date**: 2025-11-20  
**Purpose**: Analyze current V4 inland haulage logic and align with new haulage management system

## Executive Summary

The V4 API currently uses the `simplified_inland_function` RPC to handle inland haulage (IHE/IHI) calculations. This analysis reviews the current implementation, identifies gaps, and proposes enhancements to leverage the new haulage management tables.

---

## Current Implementation

### 1. Entry Points (V4 API)

#### A. `/api/v4/search-rates` (Line 279-314)
- **Trigger**: Automatically called when `origin` or `destination` is inland
- **Parameters**:
  ```typescript
  {
    p_pol_code: origin.toUpperCase(),
    p_pod_code: destination.toUpperCase(),
    p_container_type: container_type || rate.container_type,
    p_container_count: 1,
    p_cargo_weight_mt: cargo_weight_mt,
    p_haulage_type: haulage_type,
    p_vendor_id: carrierVendorId
  }
  ```
- **Returns**: Adds `inland_haulage` object to each rate:
  ```typescript
  {
    ihe_charges: { found: boolean, total_amount_usd: number, ... },
    ihi_charges: { found: boolean, total_amount_usd: number, ... },
    total_haulage_usd: number
  }
  ```

#### B. `/api/v4/prepare-quote` (Line 593-628)
- **Trigger**: Automatically called when creating a quote for inland locations
- **Parameters**: Same as search-rates
- **Returns**: Same structure, integrated into quote total

### 2. Core Logic (`simplified_inland_function`)

Located in: `simplified_v3_ihe_ihi.sql`

**Key Steps**:
1. **Lookup Locations** (Lines 70-91)
   - Get `location.id` and `is_container_inland` flag
   - Return error if location not found

2. **IHE Calculation** (Lines 93-150)
   - **Condition**: `v_pol_is_inland AND p_haulage_type = 'carrier'`
   - **Query**: Finds active `haulage_rate` from:
     - `from_location_id` = POL
     - `to_location_id` = gateway port (from `haulage_route`)
     - Matches `container_type`, `vendor_id`
     - Within `valid_from`/`valid_to` dates
   - **Weight-Based Matching**:
     ```sql
     (rate_basis = 'PER_CONTAINER' AND container_type = p_container_type)
     OR
     (rate_basis = 'WEIGHT_SLAB' AND cargo_weight BETWEEN min_weight_kg AND max_weight_kg)
     ```
   - **Currency Conversion**: INR → USD using `fx_rate` table
   - **Margin Application**: 10% markup on buy rate

3. **IHI Calculation** (Lines 152-209)
   - **Condition**: `v_pod_is_inland AND p_haulage_type = 'carrier'`
   - **Query**: Same logic as IHE but for gateway → POD

4. **Return Structure**:
   ```json
   {
     "success": true,
     "ihe_charges": {
       "found": true,
       "route_id": 12,
       "route_name": "Sonepat to Mundra (Road)",
       "from_location": "INSON",
       "to_location": "INMUN",
       "buy_amount_inr": 30000,
       "sell_amount_inr": 33000,
       "buy_amount_usd": 361.45,
       "sell_amount_usd": 397.59,
       "total_amount_inr": 33000,
       "total_amount_usd": 397.59,
       "exchange_rate": 83.0,
       "container_type": "40HC",
       "weight_slab": { ... }
     },
     "ihi_charges": { ... }
   }
   ```

---

## New Haulage Management System

### Tables Created

1. **`haulage_route`** (Route Master)
   - `route_code`, `route_name`
   - `from_location_id`, `to_location_id`
   - `primary_mode`, `available_modes[]`
   - `total_distance_km`, `avg_transit_days`

2. **`haulage_rate`** (Pricing)
   - Links to `route_id`, `vendor_id`, `contract_id`
   - `rate_basis`: PER_CONTAINER, WEIGHT_SLAB, PER_KG, PER_TON, PER_CBM, FLAT
   - `rate_per_container`, `min_weight_kg`, `max_weight_kg`, `rate_per_unit`
   - `fuel_surcharge_pct`, `toll_charges`, `loading_charges`, etc.
   - `valid_from`, `valid_to`

3. **`haulage_leg`** (Multi-leg Routes)
   - `route_id`, `leg_sequence`
   - `from_location_id`, `to_location_id`, `via_point_id`
   - `transport_mode`, `distance_km`, `transit_days`

4. **`haulage_responsibility`** (Incoterms)
   - `term_code` (FOB, CIF, EXW, etc.)
   - `ihe_arranged_by`, `ihe_paid_by`, `ihe_include_in_quote`
   - `ihi_arranged_by`, `ihi_paid_by`, `ihi_include_in_quote`

### CRUD APIs Created

- **Haulage Routes**: 7 endpoints (list, get, create, update, delete, bulk-create, filter)
- **Haulage Rates**: 5 endpoints (list, get, create, update, delete)
- **Haulage Legs**: 5 endpoints (list, get, create, update, delete)
- **Haulage Responsibilities**: 4 endpoints (list, get, create, update)

---

## Gap Analysis

### ✅ What's Working Well

1. **Automatic Detection**: V4 API correctly detects inland locations and triggers haulage calculation
2. **Weight-Based Rates**: Function supports both per-container and weight-slab rates
3. **Currency Conversion**: Uses live FX rates from `fx_rate` table
4. **Margin Application**: Applies 10% markup (should use `margin_rule_v2` later)
5. **Gateway Port Routing**: Correctly finds gateway port via `locations.parent_location_id`

### ⚠️ Current Limitations

1. **No Multi-Leg Support**: Function only handles simple POL→Gateway or Gateway→POD routes
2. **Hardcoded Margin**: 10% margin is hardcoded, should use `margin_rule_v2` table
3. **Single Vendor**: Can only query one vendor at a time (p_vendor_id)
4. **No Contract Context**: Doesn't consider `rate_contract` validity or contract-specific rates
5. **Missing Surcharges**: Doesn't include `fuel_surcharge_pct`, `toll_charges`, etc. from `haulage_rate`
6. **No Responsibility Matrix**: Doesn't use `haulage_responsibility` table for incoterm-based logic
7. **Schema Limitation**: `ocean_freight_rate` doesn't track if/how inland haulage is included

### 🎯 Opportunities for Enhancement

1. **Leverage New Tables**: Use `haulage_leg` for multi-leg routing (e.g., ROAD→RAIL→ROAD)
2. **Contract-Aware Pricing**: Filter `haulage_rate` by `contract_id` when available
3. **Incoterm Integration**: Use `haulage_responsibility` to determine `include_in_quote` dynamically
4. **Comprehensive Costing**: Include all charges from `haulage_rate` (fuel, tolls, loading, etc.)
5. **Multi-Vendor Comparison**: Query all active vendors and return best rates
6. **Schema Enhancement**: Add `includes_inland_haulage` JSONB to `ocean_freight_rate` (IN PROGRESS)

---

## Proposed Enhancements

### Phase 1: Schema Enhancement (IN PROGRESS)

**File**: `migrations/add_includes_inland_haulage_to_ocean_freight.sql`

Add `includes_inland_haulage` JSONB column to `ocean_freight_rate`:
```sql
{
  "ihe_included": boolean,
  "ihi_included": boolean,
  "pricing_model": "all_inclusive" | "inland_origin" | "gateway_port",
  "ihe_from_location": uuid,
  "ihi_to_location": uuid,
  "notes": string
}
```

**Purpose**: Track the 3 carrier pricing models:
1. **all_inclusive**: Door-to-door rate (IHE/IHI bundled)
2. **inland_origin**: Ocean rate from inland + separate IHE
3. **gateway_port**: Traditional port-to-port + separate IHE/IHI

### Phase 2: Enhanced Inland Function (V4)

**New Function**: `enhanced_inland_function_v4`

**Improvements**:
1. **Check Ocean Freight Context First**:
   ```sql
   -- If ocean_freight_rate has includes_inland_haulage data, use that
   SELECT includes_inland_haulage 
   FROM ocean_freight_rate 
   WHERE id = p_rate_id;
   
   IF includes_inland_haulage->>'pricing_model' = 'all_inclusive' THEN
     -- IHE/IHI already in ocean rate, return 0 haulage charges
     RETURN ... no additional haulage ...
   ELSIF includes_inland_haulage->>'pricing_model' = 'inland_origin' THEN
     -- Calculate IHE only
     ...
   END IF;
   ```

2. **Use `haulage_responsibility` Table**:
   ```sql
   SELECT ihe_include_in_quote, ihi_include_in_quote
   FROM haulage_responsibility
   WHERE term_code = p_incoterm;
   ```

3. **Include All Haulage Charges**:
   ```sql
   -- Base rate + surcharges
   v_total = rate_per_container 
           + (rate_per_container * fuel_surcharge_pct / 100)
           + toll_charges
           + loading_charges
           + unloading_charges
           + documentation_fee;
   ```

4. **Multi-Leg Support** (Future):
   ```sql
   -- For complex routes, aggregate all legs
   SELECT SUM(leg_cost) FROM haulage_leg WHERE route_id = ...
   ```

5. **Multi-Vendor Comparison**:
   ```sql
   -- Query all vendors, return cheapest or all options
   SELECT * FROM haulage_rate
   WHERE route_id = ... 
   AND valid_from <= CURRENT_DATE 
   AND valid_to >= CURRENT_DATE
   ORDER BY rate_per_container ASC;
   ```

### Phase 3: V4 API Integration

Update `/api/v4/search-rates` and `/api/v4/prepare-quote`:

1. **Pass Rate Context**:
   ```typescript
   const { data: haulageResult } = await supabase.rpc(
     'enhanced_inland_function_v4',
     {
       p_rate_id: rate.id,  // NEW: Pass ocean freight rate ID
       p_pol_code: origin.toUpperCase(),
       p_pod_code: destination.toUpperCase(),
       p_container_type: container_type,
       p_incoterm: incoterm || 'CIF',  // NEW: Pass incoterm
       p_haulage_type: haulage_type,
       p_vendor_id: carrierVendorId
     }
   );
   ```

2. **Enhanced Response**:
   ```typescript
   processedRate.inland_haulage = {
     pricing_model: 'all_inclusive' | 'inland_origin' | 'gateway_port',
     ihe_charges: {
       found: true,
       route: { ... },
       base_rate: 30000,
       fuel_surcharge: 1500,
       toll_charges: 0,
       total_inr: 31500,
       total_usd: 379.52,
       included_in_ocean_rate: false  // NEW
     },
     ihi_charges: { ... },
     total_haulage_usd: 759.04
   };
   ```

---

## Implementation Roadmap

### ✅ Completed
- [x] Created 4 haulage tables with proper schema
- [x] Built 21 CRUD API endpoints for haulage management
- [x] Implemented LWC UI for haulage data management
- [x] Added audit logging for all haulage operations

### 🔄 In Progress
- [x] Add `includes_inland_haulage` JSONB to `ocean_freight_rate` (Migration script created)

### 📋 Next Steps
1. **Run Migration** (5 min)
   - Execute `migrations/add_includes_inland_haulage_to_ocean_freight.sql`
   - Verify column and indexes created
   - Test JSONB queries

2. **Create Enhanced Function** (2-3 hours)
   - Write `enhanced_inland_function_v4.sql`
   - Implement rate context awareness
   - Add `haulage_responsibility` integration
   - Include all haulage charges
   - Test with sample data

3. **Update V4 API** (1 hour)
   - Modify `/api/v4/search-rates` to pass rate_id and incoterm
   - Modify `/api/v4/prepare-quote` similarly
   - Update response structure
   - Test end-to-end

4. **Update Ocean Freight Management UI** (1 hour)
   - Add `includes_inland_haulage` field to Ocean Freight create/edit forms
   - Add picklist for `pricing_model`
   - Add location lookups for `ihe_from_location`, `ihi_to_location`

5. **Documentation** (30 min)
   - Update API_DOCUMENTATION_V4.md
   - Update SCHEDULE_SYSTEM_DOCUMENTATION.md
   - Add examples to HAULAGE_SYSTEM_DOCUMENTATION.md

---

## Testing Strategy

### Unit Tests
1. Test `enhanced_inland_function_v4` with:
   - All-inclusive ocean rate (expect $0 haulage)
   - Inland origin rate (expect IHE only)
   - Gateway port rate (expect IHE + IHI)
   - Multi-container scenarios
   - Weight-slab rate matching

### Integration Tests
1. Test V4 API `/api/v4/search-rates`:
   - INSON → NLRTM (inland origin)
   - INNSA → NLRTM (port to port)
   - INTKD → DEHAM (IHE + IHI)

2. Test V4 API `/api/v4/prepare-quote`:
   - Verify haulage charges in quote total
   - Test different incoterms (FOB, CIF, DDP)

### E2E Tests
1. LWC → API → Database:
   - Create ocean freight rate with inland haulage
   - Search for rates via scheduleSearch LWC
   - Verify haulage charges displayed correctly

---

## Success Criteria

1. ✅ `ocean_freight_rate` has `includes_inland_haulage` column
2. ✅ Migration runs without errors on production
3. ✅ `enhanced_inland_function_v4` correctly identifies 3 pricing models
4. ✅ V4 API returns accurate haulage charges for all scenarios
5. ✅ LWC UI allows managing inland haulage configuration
6. ✅ All tests pass
7. ✅ Documentation updated

---

## Conclusion

The current `simplified_inland_function` works well for basic IHE/IHI calculations but doesn't leverage the full power of the new haulage management system. By implementing the proposed enhancements, we will:

1. **Support 3 carrier pricing models** (all-inclusive, inland origin, gateway port)
2. **Eliminate duplicate charges** (avoid charging IHE twice if already in ocean rate)
3. **Use incoterms correctly** (via `haulage_responsibility` table)
4. **Include all cost components** (fuel, tolls, loading, etc.)
5. **Enable future multi-leg support** (via `haulage_leg` table)
6. **Maintain backward compatibility** (existing API calls still work)

The migration script is ready to run, and the enhancement roadmap is clear. Ready to proceed! 🚀

