# RMS MCP Server - API Documentation (V4)

## Overview

The RMS MCP Server provides RESTful APIs for freight rate management, quote generation, and vessel schedule lookup. This documentation focuses on **V4 APIs** (recommended for new integrations).

**Base URL**: `http://13.204.127.113:3000` (Production) | `http://localhost:3000` (Development)  
**Authentication**: JWT Token + Tenant ID  
**Content-Type**: `application/json`

---

## 🔐 Authentication

### Get JWT Token

**Endpoint**: `POST /api/auth/token`

**Request**:
```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "user_id": "user123"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "expires_in": "1h"
}
```

**Required Headers** (for all authenticated endpoints):
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

---

## 🏥 Health Check

**Endpoint**: `GET /health`

**Description**: Check if the API server is running.

**Response**:
```json
{
  "status": "ok",
  "service": "rms-api",
  "timestamp": "2025-11-12T14:46:15.000Z"
}
```

**Example**:
```bash
curl http://localhost:3000/health
```

---

## 📊 V4 APIs

### 1. Search Rates

**Endpoint**: `POST /api/v4/search-rates`  
**Authentication**: Required

**Description**: Search for ocean freight rates with automatic inland haulage detection and optional schedule information.

**Request**:
```json
{
  "origin": "INNSA",                    // Required: Origin port UN/LOCODE
  "destination": "NLRTM",                // Required: Destination port UN/LOCODE
  "container_type": "40HC",             // Optional: Container type (20GP, 40GP, 40HC, 45HC)
  "cargo_ready_date": "2025-11-18",    // Optional: Defaults to today. Filters rates by validity.
  "cargo_weight_mt": 10,                // Required if origin/destination is inland
  "haulage_type": "carrier",            // Required if inland: "carrier" or "merchant"
  "include_earliest_departure": false   // Optional: Include schedule info (default: false)
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "vendor": "Maersk",
      "route": "Nhava Sheva (INNSA) → Rotterdam (NLRTM)",
      "origin": "INNSA",
      "destination": "NLRTM",
      "container_type": "40HC",
      "transit_days": 20,
      "pricing": {
        "ocean_freight_buy": 2000,
        "freight_surcharges": 300,
        "all_in_freight_buy": 2300,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 230
        },
        "all_in_freight_sell": 2530,
        "currency": "USD"
      },
      "validity": {
        "from": "2025-10-07",
        "to": "2026-01-05"
      },
      "is_preferred": false,
      "rate_id": 74,
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
      "earliest_departure": {
        "found": true,
        "carrier": "MAERSK",
        "etd": "2025-11-06T21:12:00+05:30",
        "vessel_name": "ALULA EXPRESS",
        "carrier_voyage_number": "544W",
        "transit_time_days": 34.4
      }
    }
  ],
  "metadata": {
    "api_version": "v4",
    "generated_at": "2025-11-12T14:46:15.000Z",
    "cargo_ready_date": "2025-11-18"
  }
}
```

**Key Features**:
- ✅ Automatic inland port detection (ICD)
- ✅ Automatic inland haulage calculation (IHE/IHI)
- ✅ Cargo readiness date filtering
- ✅ Optional earliest departure information

---

### 2. Prepare Quote

**Endpoint**: `POST /api/v4/prepare-quote`  
**Authentication**: Required

**Description**: Generate a complete quote for a specific rate with automatic inland haulage and schedule information.

**Request**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",  // Required: Salesforce Org ID
  "rate_id": 74,                           // Required: Rate ID from search-rates
  "container_count": 1,                    // Optional: Number of containers (default: 1, max: 10)
  "cargo_ready_date": "2025-11-18",       // Optional: Defaults to today. Must be within rate validity.
  "cargo_weight_mt": 10,                   // Required if origin/destination is inland
  "haulage_type": "carrier",              // Required if inland: "carrier" or "merchant"
  "include_earliest_departure": true      // Optional: Include schedule info (default: true)
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 74,
    "route": {
      "origin": "INNSA",
      "destination": "NLRTM",
      "origin_name": "Nhava Sheva (INNSA)",
      "destination_name": "Rotterdam (NLRTM)",
      "container_type": "40HC",
      "container_count": 1
    },
    "quote_parts": {
      "ocean_freight": {
        "carrier": "Maersk",
        "all_in_freight_sell": 2530,
        "ocean_freight_buy": 2000,
        "freight_surcharges": 300,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 230
        },
        "currency": "USD",
        "transit_days": 20,
        "validity": {
          "from": "2025-10-07",
          "to": "2026-01-05"
        },
        "rate_id": 74
      },
      "origin_charges": {
        "charges": [...],
        "total_usd": 139.76,
        "count": 4
      },
      "destination_charges": {
        "charges": [...],
        "total_usd": 420,
        "count": 4
      },
      "other_charges": {
        "charges": [],
        "total_usd": 0,
        "count": 0
      }
    },
    "totals": {
      "ocean_freight_total": 2530,
      "origin_total_usd": 139.76,
      "destination_total_usd": 420,
      "other_total_usd": 0,
      "inland_haulage_total_usd": 0,
      "grand_total_usd": 3089.76,
      "currency": "USD"
    },
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
    "earliest_departure": {
      "found": true,
      "carrier": "MAERSK",
      "etd": "2025-11-06T21:12:00+05:30",
      "vessel_name": "ALULA EXPRESS",
      "carrier_voyage_number": "544W",
      "transit_time_days": 34.4
    },
    "upcoming_departures": [
      {
        "carrier": "MAERSK",
        "etd": "2025-11-13T17:00:00+05:30",
        "carrier_voyage_number": "545W",
        "vessel_name": "AL RIFFA",
        "transit_time_days": 34.6
      }
    ],
    "metadata": {
      "generated_at": "2025-11-12T14:46:15.000Z",
      "cargo_ready_date": "2025-11-18"
    }
  }
}
```

**Key Features**:
- ✅ Rate-specific quotes (by `rate_id`)
- ✅ Automatic inland haulage calculation
- ✅ Earliest departure + next 4 sailings
- ✅ Complete quote breakdown (ocean + local + inland)

---

### 3. Search Schedules

**Endpoint**: `POST /api/v4/schedules/search`  
**Authentication**: Required

**Description**: Search for vessel schedules independently of rates. Returns schedules from multiple sources (database, Portcast, carrier APIs) with deduplication. **All filtering is done client-side** for maximum flexibility.

**Request**:
```json
{
  "origin": "INNSA",                    // Required: Origin port UN/LOCODE
  "destination": "NLRTM",               // Optional: Destination port UN/LOCODE
  "departure_from": "2025-11-18",       // Optional: Start date (defaults to today)
  "departure_to": "2025-12-18",         // Optional: End date
  "weeks": 4,                           // Optional: Calculate departure_to from weeks (2, 4, or 6)
  "limit": 100                          // Optional: Max results (default: 100, max: 500)
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "carrier": "MAERSK",
      "etd": "2025-11-18T00:00:00.000Z",
      "eta": "2025-12-13T00:00:00.000Z",
      "transit_time_days": 25,
      "service_code": "471",
      "service_name": "AE7 Service",
      "voyage": "545W",
      "vessel_name": "AL RIFFA",
      "vessel_imo": "9525912",
      "origin_port_code": "INNSA",
      "origin_port_name": "Nhava Sheva",
      "destination_port_code": "NLRTM",
      "destination_port_name": "Rotterdam",
      "route_name": "AE7 Service",
      "is_direct": true,
      "legs": [
        {
          "sequence": 1,
          "from": "INNSA",
          "from_name": "Nhava Sheva",
          "to": "NLRTM",
          "to_name": "Rotterdam",
          "departure": "2025-11-18T00:00:00.000Z",
          "arrival": "2025-12-13T00:00:00.000Z",
          "transport_mode": "VESSEL",
          "carrier_code": "MAEU",
          "carrier_name": "Maersk",
          "voyage": "545W",
          "vessel_name": "AL RIFFA",
          "vessel_imo": "9525912"
        }
      ],
      "source": "maersk"
    },
    {
      "carrier": "MAERSK",
      "etd": "2025-11-20T00:00:00.000Z",
      "eta": "2025-12-20T00:00:00.000Z",
      "transit_time_days": 30,
      "service_code": "AE1",
      "service_name": "AE1 Service",
      "voyage": "123E",
      "vessel_name": "MSC OSCAR",
      "vessel_imo": "9703310",
      "origin_port_code": "INTKD",
      "origin_port_name": "Tughlakabad ICD",
      "destination_port_code": "USNYC",
      "destination_port_name": "New York",
      "route_name": "AE1 Service",
      "is_direct": false,
      "legs": [
        {
          "sequence": 1,
          "from": "INTKD",
          "from_name": "Tughlakabad ICD",
          "to": "INNSA",
          "to_name": "Nhava Sheva",
          "departure": "2025-11-20T08:00:00.000Z",
          "arrival": "2025-11-20T14:00:00.000Z",
          "transport_mode": "RAIL",
          "carrier_code": "MAEU",
          "carrier_name": "Maersk"
        },
        {
          "sequence": 2,
          "from": "INNSA",
          "from_name": "Nhava Sheva",
          "to": "SGSIN",
          "to_name": "Singapore",
          "departure": "2025-11-22T10:00:00.000Z",
          "arrival": "2025-11-28T18:00:00.000Z",
          "transport_mode": "VESSEL",
          "carrier_code": "MAEU",
          "carrier_name": "Maersk",
          "voyage": "123E",
          "vessel_name": "MSC OSCAR",
          "vessel_imo": "9703310"
        },
        {
          "sequence": 3,
          "from": "SGSIN",
          "from_name": "Singapore",
          "to": "USNYC",
          "to_name": "New York",
          "departure": "2025-11-30T12:00:00.000Z",
          "arrival": "2025-12-20T08:00:00.000Z",
          "transport_mode": "VESSEL",
          "carrier_code": "MAEU",
          "carrier_name": "Maersk",
          "voyage": "456W",
          "vessel_name": "MAERSK DENVER",
          "vessel_imo": "9781234"
        }
      ],
      "source": "maersk"
    }
  ],
  "metadata": {
    "api_version": "v4",
    "generated_at": "2025-11-12T14:46:15.000Z",
    "origin": "INNSA",
    "destination": "NLRTM",
    "departure_from": "2025-11-18",
    "departure_to": "2025-12-18",
    "total_results": 25,
    "note": "All filtering (carrier, service, vessel, voyage, is_direct, arrival dates) should be done client-side in the LWC"
  }
}
```

**Route Details for Indirect Schedules**:

For indirect routes (especially from inland ports), the `legs` array provides complete route breakdown:

- **Leg 1**: Inland origin → Gateway port (transport_mode: `RAIL` or `TRUCK`)
- **Leg 2+**: Gateway port → Transshipment port(s) → Destination (transport_mode: `VESSEL`)
- **Last Leg**: Destination gateway → Inland destination (if applicable, transport_mode: `RAIL` or `TRUCK`)

**Key Fields in Each Leg**:
- `sequence`: Leg order (1, 2, 3, ...)
- `from` / `from_name`: Origin port code and name
- `to` / `to_name`: Destination port code and name
- `departure` / `arrival`: ISO 8601 timestamps
- `transport_mode`: `VESSEL` (ocean), `RAIL` (inland rail), `TRUCK` (inland truck), `BARGE` (inland barge)
- `carrier_code` / `carrier_name`: Carrier information
- `voyage`: Voyage number (for VESSEL legs)
- `vessel_name` / `vessel_imo`: Vessel details (for VESSEL legs)

**Identifying Route Types**:
- `is_direct: true` + `legs.length === 1` → Direct ocean route
- `is_direct: false` + `legs.length > 1` → Indirect route with transshipment
- Legs with `transport_mode: "RAIL"` or `"TRUCK"` → Inland haulage segments
- Multiple VESSEL legs → Transshipment at intermediate ports

**Key Features**:
- ✅ Multi-source schedules (Database → Carrier API → Portcast)
- ✅ Automatic deduplication
- ✅ **Complete routing information (legs) for indirect routes** - Shows all legs including:
  - Inland haulage (RAIL/TRUCK) from inland origins to gateway ports
  - Ocean transport (VESSEL) with transshipment ports
  - Final inland delivery (RAIL/TRUCK) to inland destinations
- ✅ Client-side filtering (carrier, service, vessel, voyage, is_direct, arrival dates)
- ✅ **Detailed route breakdown** - Each leg includes ports, dates, transport mode, vessel, and voyage information

**Client-Side Filtering**:
The API returns all schedules in the date range. Your LWC should filter by:
- Carrier name
- Service code/name
- Vessel name
- Voyage number
- Direct-only routes (`is_direct: true`)
- Arrival dates (`eta`)

---

## 📋 Quick Reference

### Container Types
- `20GP` - 20ft General Purpose
- `40GP` - 40ft General Purpose
- `40HC` - 40ft High Cube
- `45HC` - 45ft High Cube

### Inland Ports (ICD)
When `origin` or `destination` is an inland port (e.g., `INTKD`), you must provide:
- `cargo_weight_mt` - Cargo weight in metric tons
- `haulage_type` - `"carrier"` (for IHE/IHI charges) or `"merchant"` (no charges)

### Schedule Sources
Schedules are sourced in priority order:
1. **Database views** (`v_port_to_port_routes`) - Highest priority
2. **Carrier APIs** (Maersk DCSA) - For supported carriers
3. **Portcast table** (`portcast_schedules`) - Fallback

### Error Responses

**400 Bad Request**:
```json
{
  "success": false,
  "error": "Missing required fields: origin, destination"
}
```

**401 Unauthorized**:
```json
{
  "error": "Missing required headers",
  "required": ["authorization: Bearer <token>", "x-tenant-id: <tenant_id>"]
}
```

**404 Not Found** (Prepare Quote):
```json
{
  "success": false,
  "error": "Rate not found"
}
```

---

## 🔄 Legacy APIs (V1, V2, V3)

**Note**: V1, V2, and V3 APIs are still available for backward compatibility but are **not recommended for new integrations**. Please use V4 APIs instead.

### Legacy Endpoints
- `POST /api/search-rates` (V1)
- `POST /api/prepare-quote` (V1)
- `POST /api/v2/search-rates` (V2)
- `POST /api/v2/prepare-quote` (V2)
- `POST /api/v3/prepare-quote` (V3 - Inland haulage only)

**Migration Guide**:
- Replace `pol_code`/`pod_code` with `origin`/`destination`
- Use `POST /api/v4/search-rates` instead of V1/V2
- Use `POST /api/v4/prepare-quote` instead of V1/V2/V3
- Inland haulage is now automatic in V4 (no separate API call needed)

For detailed legacy API documentation, see `API_DOCUMENTATION.md`.

---

## 📝 Examples

### Complete Workflow

```bash
# 1. Get Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000001","user_id":"user123"}' \
  | jq -r '.token')

# 2. Search Rates
curl -X POST http://localhost:3000/api/v4/search-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "container_type": "40HC",
    "cargo_ready_date": "2025-11-18",
    "include_earliest_departure": true
  }'

# 3. Prepare Quote (using rate_id from step 2)
curl -X POST http://localhost:3000/api/v4/prepare-quote \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 74,
    "container_count": 1,
    "cargo_ready_date": "2025-11-18",
    "include_earliest_departure": true
  }'

# 4. Search Schedules
curl -X POST http://localhost:3000/api/v4/schedules/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "departure_from": "2025-11-18",
    "weeks": 4
  }'
```

---

## 🔗 Support

For issues or questions:
- Check server health: `GET /health`
- Verify authentication token is valid
- Ensure all required fields are provided
- Review error messages in response

---

*Last Updated: 2025-11-12*  
*API Version: 4.0*


