# V4 API Implementation Plan

## Overview
This document outlines the plan for creating new V4 versions of the RMS search rates and prepare quote APIs with the following enhancements:
1. Change POL/POD fields to origin/destination
2. Add Inland haulage API integration to search rates endpoints
3. Add Maersk point-to-point schedules API to add earliest departure with quotes
4. Maintain backward compatibility (V1, V2, V3 remain unchanged)

---

## Current API Analysis

### Existing API Versions

#### V1 APIs (Production - DO NOT MODIFY)
- **`POST /api/search-rates`**
  - Input: `pol_code`, `pod_code`, `container_type`, `vendor_name`
  - Output: Ocean freight rates with pricing breakdown
  - Uses: `mv_freight_sell_prices` view

- **`POST /api/prepare-quote`**
  - Input: `salesforce_org_id`, `pol_code`, `pod_code`, `container_type`, `container_count`
  - Output: Complete quote with ocean freight + local charges
  - Uses: Preferred rate (`is_preferred = true`)

#### V2 APIs (Production - DO NOT MODIFY)
- **`POST /api/v2/search-rates`**
  - Input: `pol_code`, `pod_code`, `container_type`, `vendor_name`, `salesforce_org_id`
  - Output: All matching rates (not just preferred)

- **`POST /api/v2/prepare-quote`**
  - Input: `salesforce_org_id`, `rate_id`, `container_count`
  - Output: Quote for specific rate ID

#### V3 APIs (Production - DO NOT MODIFY)
- **`POST /api/v3/prepare-quote`**
  - Input: `pol_code`, `pod_code`, `container_type`, `container_count`, `cargo_weight_mt`, `haulage_type`
  - Output: IHE/IHI haulage charges only
  - Uses: `simplified_inland_function` RPC

- **`POST /api/v3/get-inland-haulage`**
  - Same as V3 prepare-quote, simplified response

---

## Database Schema Analysis

### Key Tables & Views

#### Ocean Freight Rates
- **Table**: `ocean_freight_rate`
  - Fields: `id`, `tenant_id`, `pol_id`, `pod_id`, `container_type`, `buy_amount`, `currency`, `tt_days`, `is_preferred`, `valid_from`, `valid_to`
  - Relationships: `pol_id` → `locations.id`, `pod_id` → `locations.id`

- **View**: `mv_freight_sell_prices` (Materialized)
  - Fields: `rate_id`, `pol_code`, `pod_code`, `pol_name`, `pod_name`, `container_type`, `carrier`, `ocean_freight_buy`, `freight_surcharges`, `all_in_freight_buy`, `all_in_freight_sell`, `transit_days`, `is_preferred`
  - Used by: V1 search-rates endpoint

#### Locations
- **Table**: `locations`
  - Fields: `id`, `unlocode`, `name`, `location_type` (SEAPORT, ICD, CFS, AIRPORT), `country_code`, `is_gateway_port`, `parent_port_id`
  - Key: `unlocode` is 5-character UN/LOCODE

#### Inland Haulage
- **RPC Function**: `simplified_inland_function`
  - Parameters: `p_pol_code`, `p_pod_code`, `p_container_type`, `p_container_count`, `p_cargo_weight_mt`, `p_haulage_type`
  - Returns: `ihe_charges`, `ihi_charges`, `pol_is_inland`, `pod_is_inland`, `exchange_rate`
  - Used by: V3 APIs

#### Schedules (Maersk)
- **Tables**: `carrier`, `service`, `vessel`, `voyage`, `transport_call`, `port_call_time`
- **Views**: 
  - `v_port_to_port_routes` - Direct port-to-port routes with transit times
  - `v_voyage_routes_with_transit` - Complete voyage routes
  - `v_weekly_vessel_schedule` - Weekly vessel sailing schedule
- **Point-to-Point API**: Maersk DCSA API endpoint for preferred services
  - Endpoint: `https://api.maersk.com/dcsa/v2/point-to-point`
  - Returns: Preferred service codes for origin/destination pairs

#### Local Charges
- **View**: `v_local_charges_details`
  - Fields: `origin_port_code`, `destination_port_code`, `charge_code`, `charge_amount`, `charge_currency`, `applies_scope`, `charge_location_type`
  - Used by: V1 prepare-quote endpoint

---

## V4 API Requirements

### 1. V4 Search Rates API

**Endpoint**: `POST /api/v4/search-rates`

**Key Changes from V1**:
- ✅ Change `pol_code` → `origin` (UN/LOCODE)
- ✅ Change `pod_code` → `destination` (UN/LOCODE)
- ✅ Add inland haulage integration (IHE/IHI charges)
- ✅ Add earliest departure from Maersk schedules

**Request Body**:
```json
{
  "origin": "INNSA",              // Required: Origin port UN/LOCODE (was pol_code)
  "destination": "NLRTM",         // Required: Destination port UN/LOCODE (was pod_code)
  "container_type": "40HC",       // Optional: Container type
  "vendor_name": "MSC",           // Optional: Filter by carrier
  "cargo_weight_mt": 25,          // Required if origin or destination is inland port
  "haulage_type": "carrier",       // Required if origin or destination is inland: "carrier" or "merchant"
  "include_earliest_departure": true // Optional: Include earliest departure from schedules (default: false for search-rates)
}
```

**Response Structure**:
```json
{
  "success": true,
  "data": [
    {
      "vendor": "MSC",
      "route": "Nhava Sheva (JNPT) → Rotterdam",
      "origin": "INNSA",              // New field name
      "destination": "NLRTM",          // New field name
      "container_type": "40HC",
      "transit_days": 18,
      "pricing": {
        "ocean_freight_buy": 1950,
        "freight_surcharges": 289.85,
        "all_in_freight_buy": 2239.85,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 223.99
        },
        "all_in_freight_sell": 2463.84,
        "currency": "USD"
      },
      "validity": {
        "from": "2025-10-07",
        "to": "2026-01-05"
      },
      "is_preferred": true,
      "rate_id": 71,
      // NEW: Inland haulage charges (if include_inland_haulage = true)
      "inland_haulage": {
        "ihe_charges": {
          "found": false,
          "message": "Origin is not inland, no IHE needed"
        },
        "ihi_charges": {
          "found": false,
          "message": "Destination is not inland, no IHI needed"
        },
        "total_haulage_usd": 0
      },
      // NEW: Earliest departure (if include_earliest_departure = true)
      // Shows earliest departure for THIS carrier's rate
      "earliest_departure": {
        "found": true,
        "carrier": "MSC",  // Matches the rate's carrier
        "etd": "2025-11-10T10:00:00Z",
        "planned_departure": "2025-11-10T10:00:00Z",
        "estimated_departure": "2025-11-10T12:00:00Z",
        "carrier_service_code": "471",
        "carrier_voyage_number": "544W",
        "vessel_name": "ALULA EXPRESS",
        "vessel_imo": "9525883"
      }
    }
  ],
  "metadata": {
    "api_version": "v4",
    "generated_at": "2025-01-17T10:30:00.000Z"
  }
}
```

**Implementation Logic**:
1. Query `mv_freight_sell_prices` using `origin` and `destination` (map to `pol_code`/`pod_code` internally)
2. **Automatic Inland Detection**:
   - Check if origin or destination ports are inland (query `locations` table for `location_type = 'ICD'`)
   - If either port is inland, validate `cargo_weight_mt` and `haulage_type` are provided
   - For each rate, automatically call `simplified_inland_function` RPC with:
     - `p_pol_code`: origin (from rate)
     - `p_pod_code`: destination (from rate)
     - `p_container_type`: container_type (from request or rate)
     - `p_container_count`: 1 (for per-container calculation)
     - `p_cargo_weight_mt`: cargo_weight_mt (from request, required if inland)
     - `p_haulage_type`: haulage_type (from request, required if inland)
   - Add `inland_haulage` object to each rate response with IHE/IHI charges
   - Function automatically handles seaport detection (returns `found: false` if not inland, no error)
3. If `include_earliest_departure = true`:
   - For each rate, find earliest departure for that specific carrier from origin port
   - Query `v_port_to_port_routes` filtered by origin port AND carrier name
   - Or use Maersk point-to-point API if carrier is Maersk
   - Match carrier from rate (`rate.carrier` or `rate.vendor`) to schedule data
   - Add `earliest_departure` object to each rate response (carrier-specific)

---

### 2. V4 Prepare Quote API

**Endpoint**: `POST /api/v4/prepare-quote`

**Key Changes from V1**:
- ✅ Change `pol_code` → `origin` (UN/LOCODE)
- ✅ Change `pod_code` → `destination` (UN/LOCODE)
- ✅ Add earliest departure from Maersk schedules (for selected carrier)
- ✅ **Automatic inland haulage**: Automatically detects inland ports and includes IHE/IHI charges in quote totals
- ✅ **Combined pricing**: Single endpoint provides ocean freight + local charges + inland haulage (if applicable) + schedules

**Request Body**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",  // Required: Salesforce Organization ID
  "origin": "INNSA",                       // Required: Origin port UN/LOCODE (was pol_code)
  "destination": "NLRTM",                  // Required: Destination port UN/LOCODE (was pod_code)
  "container_type": "40HC",                // Required: Container type
  "container_count": 2,                    // Optional: Number of containers (default: 1)
  "include_earliest_departure": true,      // Optional: Include earliest departure for selected carrier (default: true)
  "cargo_weight_mt": 25,                   // Required if origin or destination is inland port
  "haulage_type": "carrier"                // Required if origin or destination is inland: "carrier" or "merchant"
}
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "route": {
      "origin": "INNSA",                   // New field name
      "destination": "NLRTM",               // New field name
      "container_type": "40HC",
      "container_count": 2
    },
    "quote_parts": {
      "ocean_freight": {
        "carrier": "MSC",
        "all_in_freight_sell": 2463.84,
        "ocean_freight_buy": 1950,
        "freight_surcharges": 289.85,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 223.99
        },
        "currency": "USD",
        "transit_days": 18,
        "validity": {
          "from": "2025-10-07",
          "to": "2026-01-05"
        },
        "is_preferred": true,
        "rate_id": 71
      },
      "origin_charges": { /* ... same as V1 ... */ },
      "destination_charges": { /* ... same as V1 ... */ },
      "other_charges": { /* ... same as V1 ... */ }
    },
    "totals": {
      "ocean_freight_total": 4927.68,
      "origin_total_local": 23200,
      "origin_total_usd": 279.52,
      "destination_total_local": 750,
      "destination_total_usd": 882.34,
      "other_total_local": 0,
      "other_total_usd": 0,
      // NEW: Inland haulage totals (if include_inland_haulage = true)
      "inland_haulage_total_usd": 624,     // IHE + IHI combined
      "grand_total_usd": 6713.54,           // Includes inland haulage if enabled
      "currency": "USD",
      "fx_rates": { /* ... */ },
      "currencies_used": ["INR", "EUR"]
    },
    "quote_summary": { /* ... same as V1 ... */ },
    // NEW: Inland haulage details (if include_inland_haulage = true)
    "inland_haulage": {
      "ihe_charges": {
        "found": false,
        "message": "Origin is not inland, no IHE needed"
      },
      "ihi_charges": {
        "found": false,
        "message": "Destination is not inland, no IHI needed"
      },
      "total_haulage_usd": 0
    },
    // NEW: Earliest departure for the selected carrier (from preferred rate)
    "earliest_departure": {
      "found": true,
      "carrier": "MSC",  // Matches the preferred rate's carrier
      "etd": "2025-11-10T10:00:00Z",
      "planned_departure": "2025-11-10T10:00:00Z",
      "estimated_departure": "2025-11-10T12:00:00Z",
      "carrier_service_code": "471",
      "carrier_voyage_number": "544W",
      "vessel_name": "ALULA EXPRESS",
      "vessel_imo": "9525883",
      "transit_time_days": 15.2
    },
    "metadata": {
      "generated_at": "2025-01-17T10:30:00.000Z",
      "origin": "INNSA",                    // New field name
      "destination": "NLRTM",               // New field name
      "container_type": "40HC",
      "container_count": 2,
      "api_version": "v4"
    }
  }
}
```

**Implementation Logic**:
1. Use same logic as V1 prepare-quote but with `origin`/`destination` field names
2. Query preferred rate using origin/destination (map to pol_code/pod_code internally)
3. Get local charges (same as V1)
4. **Automatic Inland Detection**:
   - Check if origin or destination ports are inland (query `locations` table for `location_type = 'ICD'`)
   - If either port is inland, validate `cargo_weight_mt` and `haulage_type` are provided
   - Automatically call `simplified_inland_function` RPC (same as V3):
     - `p_pol_code`: origin
     - `p_pod_code`: destination
     - `p_container_type`: container_type (from request)
     - `p_container_count`: container_count (from request)
     - `p_cargo_weight_mt`: cargo_weight_mt (from request, required if inland)
     - `p_haulage_type`: haulage_type (from request, required if inland)
   - Add IHE/IHI charges to quote totals (`inland_haulage_total_usd`)
   - Include `inland_haulage` object in response
   - Update `grand_total_usd` to include haulage charges (ocean + local + haulage)
   - If both ports are seaports, no haulage charges (function returns `found: false`, no error)
5. If `include_earliest_departure = true`:
   - Get preferred rate's carrier name
   - Query Maersk schedules (database views or API) filtered by origin port AND carrier
   - Find earliest departure for that specific carrier from origin port
   - Add `earliest_departure` to response (carrier-specific)

---

## Maersk Point-to-Point Schedules Integration

### API Endpoint
- **URL**: `https://api.maersk.com/dcsa/v2/point-to-point`
- **Method**: GET
- **Authentication**: OAuth 2.0 (Consumer Key + Secret)
- **Parameters**: 
  - `originLocationId` (UN/LOCODE)
  - `destinationLocationId` (UN/LOCODE)
  - `fromDate` (optional)
  - `toDate` (optional)

### Response Structure
```json
{
  "preferredServices": [
    {
      "carrierServiceCode": "471",
      "carrierServiceName": "ME1",
      "transitTime": 15
    }
  ],
  "schedules": [
    {
      "carrierServiceCode": "471",
      "carrierVoyageNumber": "544W",
      "vessel": {
        "name": "ALULA EXPRESS",
        "imo": "9525883"
      },
      "portCalls": [
        {
          "location": {
            "unlocode": "INNSA"
          },
          "departure": {
            "planned": "2025-11-10T10:00:00Z",
            "estimated": "2025-11-10T12:00:00Z"
          }
        }
      ]
    }
  ]
}
```

### Implementation Options

**Option 1: Use Database Views (Recommended - Primary)**
- Query `v_port_to_port_routes` view
- Filter by `origin_unlocode` and `destination_unlocode`
- Get earliest `origin_departure` where `origin_departure >= CURRENT_DATE`
- Pros: Fast, no external API calls, uses synced data
- Cons: Requires schedule data to be synced

**Option 2: Use Existing Maersk Adapter (Fallback)**
- Use existing `MaerskDCSAAdapter.fetchPointToPoint()` method
- Already configured with `MAERSK_API_KEY` from environment
- Endpoint: `/ocean/commercial-schedules/dcsa/v1/point-to-point-routes`
- Parse response for earliest departure from legs
- Pros: Real-time data, already integrated
- Cons: Requires API credentials, slower, rate limits

**Recommendation**: Use Option 1 (database views) as primary, with Option 2 (Maersk adapter) as fallback if no data in database.

---

## Implementation Plan

### Phase 1: V4 Search Rates API
1. ✅ Create new endpoint `/api/v4/search-rates`
2. ✅ Map `origin`/`destination` to `pol_code`/`pod_code` internally
3. ✅ Query `mv_freight_sell_prices` view
4. ✅ Add optional inland haulage integration:
   - If `include_inland_haulage = true`, validate `cargo_weight_mt` and `haulage_type` are provided
   - For each rate, call `simplified_inland_function` RPC (same as V3)
   - Add `inland_haulage` object to each rate with IHE/IHI charges
   - Function handles seaport detection automatically
5. ✅ Add optional earliest departure:
   - If `include_earliest_departure = true`, query `v_port_to_port_routes`
   - Find earliest departure for origin port and carrier
   - Add `earliest_departure` object to each rate

### Phase 2: V4 Prepare Quote API
1. ✅ Create new endpoint `/api/v4/prepare-quote`
2. ✅ Map `origin`/`destination` to `pol_code`/`pod_code` internally
3. ✅ Use same logic as V1 but with new field names
4. ✅ **Automatic inland haulage integration**:
   - Check if origin or destination ports are inland (query `locations` table)
   - If inland detected, validate `cargo_weight_mt` and `haulage_type` are provided
   - Automatically call `simplified_inland_function` RPC (same as V3)
   - Add IHE/IHI charges to quote totals (`inland_haulage_total_usd`)
   - Include `inland_haulage` object in response
   - Update `grand_total_usd` to include haulage charges (ocean + local + haulage)
   - If both ports are seaports, no haulage charges (no error, just `found: false`)
5. ✅ Add earliest departure integration:
   - Get preferred rate's carrier name
   - Query Maersk schedules (database views or API) filtered by origin port AND carrier
   - Find earliest departure for that specific carrier from origin port
   - Add `earliest_departure` to response (carrier-specific)

### Phase 3: Maersk Schedules Integration
1. ✅ Create helper function `getEarliestDeparture(origin, carrier)` in new service
2. ✅ Primary: Query `v_port_to_port_routes` view filtered by origin AND carrier name
3. ✅ Fallback: Use existing `MaerskDCSAAdapter.fetchPointToPoint()` if carrier is Maersk and no database data
4. ✅ Handle errors gracefully (return `found: false` if no schedule for that carrier)
5. ✅ Extract earliest departure from Maersk point-to-point response legs
6. ✅ Match carrier name from rate to schedule data (case-insensitive matching)

### Phase 4: Testing & Documentation
1. ✅ Update API_DOCUMENTATION.md with V4 endpoints
2. ✅ Test with various origin/destination combinations
3. ✅ Test inland haulage integration
4. ✅ Test earliest departure integration
5. ✅ Verify backward compatibility (V1, V2, V3 unchanged)

---

## Questions for Context

### 1. Maersk API Credentials ✅ ANSWERED
- **A**: Maersk API credentials are stored in `.env` file:
  - Consumer API Key: `MAERSK_API_KEY` (environment variable)
  - Secret: `MAERSK_API_SECRET` (environment variable)
- **Note**: Existing code uses `MAERSK_CONSUMER_KEY` or `MAERSK_API_KEY` for authentication
- **Authentication**: Maersk API uses `Consumer-Key` header (no OAuth required)
- **Existing Integration**: `MaerskDCSAAdapter` class already exists with `fetchPointToPoint()` method

### 2. Inland Haulage Integration ✅ ANSWERED (Automatic Detection)
- **A**: V3 `/api/v3/get-inland-haulage` endpoint shows the pattern:
  - Uses `simplified_inland_function` RPC
  - Required params: `pol_code`, `pod_code`, `container_type`, `cargo_weight_mt`, `haulage_type`
  - Returns: `ihe_charges`, `ihi_charges`, `pol_is_inland`, `pod_is_inland`, `total_haulage_usd`
- **V4 Implementation**: 
  - **Automatic Detection**: System automatically checks if origin/destination are inland ports
  - **Automatic Inclusion**: If origin is inland → automatically add IHE charges
  - **Automatic Inclusion**: If destination is inland → automatically add IHI charges
  - **Required Parameters**: If any port is inland, require `cargo_weight_mt` and `haulage_type` in request
  - Call same `simplified_inland_function` RPC for each rate/quote
  - Function automatically detects if ports are inland and calculates IHE/IHI accordingly
  - If both ports are seaports, no haulage charges (function returns `found: false`, no error)

### 3. Earliest Departure ✅ ANSWERED
- **A**: Earliest departure should be shown **for the selected carrier rate**
- **V4 Search Rates**: Show earliest departure for each carrier's rate (each rate can have different carrier)
- **V4 Prepare Quote**: Show earliest departure for the preferred/selected rate's carrier
- **Default**: Include by default in V4 prepare-quote (`include_earliest_departure: true` by default)
- **Implementation**: Match carrier from rate to find earliest departure for that specific carrier from origin port

### 4. Field Name Compatibility ✅ ANSWERED
- **A**: V4 will use **only new field names** (`origin`/`destination`)
- **No backward compatibility**: V4 does NOT accept `pol_code`/`pod_code`
- **Migration**: Clients must update to use `origin`/`destination` when migrating to V4
- **Old APIs remain**: V1, V2, V3 continue to use `pol_code`/`pod_code` for backward compatibility

### 5. Database Views
- **Q**: Are the schedule views (`v_port_to_port_routes`, etc.) already populated with data?
- **Q**: How frequently is schedule data synced?
- **Context Needed**: Data availability for earliest departure

### 6. Error Handling ✅ ANSWERED (Default Strategy)
- **A**: If Maersk API or schedule lookup fails:
  - Return `earliest_departure: { found: false, message: "..." }`
  - Do NOT fail the entire request
  - Graceful degradation: Return rates/quote without earliest departure if schedule unavailable
- **Rationale**: Rates and quotes are still valid without schedule data

---

## File Structure

### New Files to Create
```
src/
  routes/
    v4-routes.ts                    # New V4 API endpoints
  services/
    schedule-integration.service.ts  # Maersk schedules integration (uses existing adapter)
```

### Files to Modify
```
src/
  index.ts                # Register V4 routes (import and use v4-routes.ts)
API_DOCUMENTATION.md      # Add V4 documentation
```

### Existing Files to Reuse
```
src/
  dcsa/
    dcsa-client-adapted.ts        # Already has DCSAClient with Maersk adapter
    adapters/
      maersk.adapter.ts           # Already has fetchPointToPoint() method
  types/
    maersk-api.types.ts           # TypeScript types for Maersk API
```

---

## Next Steps

1. **Get answers to context questions** (above)
2. **Review Maersk API documentation** (if using direct API calls)
3. **Test database views** (verify schedule data availability)
4. **Implement V4 search-rates endpoint**
5. **Implement V4 prepare-quote endpoint**
6. **Add Maersk schedules integration**
7. **Write tests**
8. **Update documentation**

---

## Notes

- ✅ All existing APIs (V1, V2, V3) remain unchanged
- ✅ V4 APIs are additive, not replacements
- ✅ Field name changes are only in request/response, internal logic uses existing database schema
- ✅ Inland haulage integration reuses existing `simplified_inland_function` RPC
- ✅ Schedule integration can use existing database views or Maersk API

---

**Last Updated**: 2025-01-17
**Status**: Planning Phase - Awaiting Context Questions

