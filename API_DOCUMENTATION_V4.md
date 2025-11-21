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

## 4. Schedule Metrics & Reporting

### 4.1 Get Schedule Source Statistics for a Search

**Endpoint**: `POST /api/v4/schedules/metrics`  
**Authentication**: Required (API Key)

**Description**: Provides statistics on where schedule data comes from for a specific search query. Returns counts and percentages for Database, Portcast, and Line API (Maersk) sources.

**Request**:
```json
{
  "origin": "INNSA",
  "destination": "NLRTM",
  "departure_from": "2025-11-18",
  "departure_to": "2025-12-18",
  "weeks": 4,
  "limit": 100
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "counts": {
      "database": 45,
      "portcast": 30,
      "maersk": 25,
      "unknown": 0,
      "total": 100
    },
    "percentages": {
      "database": "45.00",
      "portcast": "30.00",
      "maersk": "25.00",
      "unknown": "0.00"
    },
    "breakdown": {
      "from_database": 45,
      "from_line_api": 25,
      "from_portcast": 30,
      "unknown_source": 0,
      "total_schedules": 100
    }
  }
}
```

### 4.2 Get Historical Schedule Source Statistics

**Endpoint**: `GET /api/v4/schedules/audit-stats`  
**Authentication**: Required (API Key)

**Description**: Provides historical statistics based on the `schedule_source_audit` table. Tracks schedule ingestion, not search results.

**Query Parameters**:
- `carrier` (optional): Filter by carrier name
- `start_date` (optional): Filter from this date (YYYY-MM-DD)
- `end_date` (optional): Filter until this date (YYYY-MM-DD)
- `limit` (optional): Max records (default: 1000, max: 10000)

### 4.3 Get Carrier-Wise Schedule Source Breakdown

**Endpoint**: `GET /api/v4/schedules/carrier-breakdown`  
**Authentication**: Required (API Key)

**Description**: Provides a breakdown of schedule sources grouped by carrier.

**Query Parameters**:
- `start_date` (optional): Filter from this date (YYYY-MM-DD)
- `end_date` (optional): Filter until this date (YYYY-MM-DD)

---

## 5. LCL (Less than Container Load) APIs

### 5.1 Search LCL Rates

**Endpoint**: `POST /api/v4/search-lcl-rates`  
**Authentication**: Required

**Description**: Search for LCL (Less than Container Load) ocean freight rates with automatic slab-based pricing, surcharge application, and margin calculation.

**Request**:
```json
{
  "origin": "INNSA",                    // Required: Origin port UN/LOCODE
  "destination": "NLRTM",               // Required: Destination port UN/LOCODE
  "service_type": "CONSOLIDATED",       // Optional: Service type (default: CONSOLIDATED)
  "vendor_id": 1,                       // Optional: Filter by vendor
  "cargo_ready_date": "2025-11-20",    // Optional: Defaults to today
  "shipment_items": [                   // Required: Array of shipment items
    {
      "length_cm": 120,
      "width_cm": 80,
      "height_cm": 100,
      "gross_weight_kg": 500,
      "pieces": 2,
      "is_stackable": true,
      "description": "Electronics"
    },
    {
      "length_cm": 100,
      "width_cm": 60,
      "height_cm": 80,
      "gross_weight_kg": 300,
      "pieces": 3,
      "is_stackable": false,
      "description": "Furniture"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "rate_id": 1,
        "vendor_id": 1,
        "vendor_name": "Generic Carrier",
        "origin": "INNSA",
        "destination": "NLRTM",
        "origin_name": "Nhava Sheva",
        "destination_name": "Rotterdam",
        "service_type": "CONSOLIDATED",
        "pricing_model": "SLAB_BASED",
        "rate_basis": "CBM",
        "min_volume_cbm": 3.0,
        "max_volume_cbm": 5.0,
        "rate_per_cbm": 52.0,
        "max_weight_kg_per_cbm": 500.0,
        "minimum_charge": 150.0,
        "weight_per_cbm_conversion": 1000.0,
        "transit_days": 28,
        "currency": "USD",
        "valid_from": "2025-01-01",
        "valid_to": "2025-12-31",
        "pricing": {
          "total_volume_cbm": 3.72,
          "total_weight_kg": 1900.0,
          "chargeable_weight_kg": 3720.0,
          "freight_cost_usd": 193.44,
          "surcharges": [
            {
              "charge_code": "BAF",
              "charge_name": "Bunker Adjustment Factor",
              "amount_usd": 19.34
            },
            {
              "charge_code": "CAF",
              "charge_name": "Currency Adjustment Factor",
              "amount_usd": 9.67
            }
          ],
          "total_surcharges_usd": 29.01,
          "total_buy_usd": 222.45,
          "margin": {
            "type": "percentage",
            "value": 15.0,
            "amount_usd": 33.37
          },
          "total_sell_usd": 255.82
        }
      }
    ],
    "metadata": {
      "total_volume_cbm": 3.72,
      "total_weight_kg": 1900.0,
      "chargeable_weight_kg": 3720.0,
      "rates_found": 1,
      "generated_at": "2025-11-20T10:30:00.000Z"
    }
  }
}
```

**Key Features**:
- ✅ Automatic volume and chargeable weight calculation from shipment items
- ✅ Slab-based pricing with weight limits per slab
- ✅ Flat rate per CBM pricing support
- ✅ Automatic surcharge application (PER_CBM, PERCENTAGE, PER_SHIPMENT, FLAT)
- ✅ On-the-fly margin calculation (global, port_pair, trade_zone priority)
- ✅ Sorted by total sell amount

**Chargeable Weight Logic**:
```
Volumetric Weight = volume_cbm * 1000 kg
Chargeable Weight = MAX(actual_weight_kg, volumetric_weight_kg)
```

---

### 5.2 Prepare LCL Quote

**Endpoint**: `POST /api/v4/prepare-lcl-quote`  
**Authentication**: Required

**Description**: Generate a detailed LCL quote with selected rate and shipment items breakdown.

**Request**:
```json
{
  "quote_id": "LCL-2025-001",          // Required: Your quote reference
  "rate_id": 1,                         // Required: Rate ID from search-lcl-rates
  "shipment_items": [                   // Required: Same items from search
    {
      "length_cm": 120,
      "width_cm": 80,
      "height_cm": 100,
      "gross_weight_kg": 500,
      "pieces": 2,
      "is_stackable": true,
      "description": "Electronics"
    }
  ],
  "cargo_ready_date": "2025-11-20"     // Optional: Defaults to today
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "quote_id": "LCL-2025-001",
    "lcl_shipment_id": 123,
    "rate_details": {
      "rate_id": 1,
      "vendor": "Generic Carrier",
      "origin": "INNSA",
      "destination": "NLRTM",
      "service_type": "CONSOLIDATED",
      "pricing_model": "SLAB_BASED",
      "transit_days": 28,
      "currency": "USD"
    },
    "shipment_summary": {
      "total_items": 2,
      "total_pieces": 2,
      "total_volume_cbm": 0.96,
      "total_weight_kg": 500.0,
      "chargeable_weight_kg": 960.0
    },
    "pricing_breakdown": {
      "freight": {
        "rate_per_cbm": 52.0,
        "volume_cbm": 0.96,
        "freight_cost_usd": 49.92,
        "minimum_charge": 150.0,
        "applied_amount_usd": 150.0
      },
      "surcharges": [
        {
          "charge_code": "THC_ORIGIN",
          "charge_name": "Terminal Handling Charge - Origin",
          "calc_method": "PER_CBM",
          "amount_usd": 9.6
        }
      ],
      "total_surcharges_usd": 9.6,
      "total_buy_usd": 159.6,
      "margin": {
        "type": "percentage",
        "value": 15.0,
        "amount_usd": 23.94
      },
      "total_sell_usd": 183.54
    },
    "validity": {
      "from": "2025-01-01",
      "to": "2025-12-31",
      "cargo_ready_date": "2025-11-20"
    },
    "metadata": {
      "generated_at": "2025-11-20T10:35:00.000Z",
      "api_version": "v4"
    }
  }
}
```

**Key Features**:
- ✅ Stores shipment items for future reference
- ✅ Complete pricing breakdown (freight + surcharges + margin)
- ✅ Minimum charge enforcement
- ✅ Detailed item-level volume and weight calculations

---

### 5.3 LCL CRUD APIs

#### 5.3.1 LCL Ocean Freight Rates

**List Rates**: `GET /api/lcl-rates?origin=INNSA&destination=NLRTM&limit=50`  
**Get by ID**: `GET /api/lcl-rates/:id`  
**Create**: `POST /api/lcl-rates`  
**Update**: `PUT /api/lcl-rates/:id`  
**Delete**: `DELETE /api/lcl-rates/:id`  
**Bulk Create**: `POST /api/lcl-rates/bulk`

**Create/Update Request**:
```json
{
  "vendor_id": 1,
  "contract_id": 1,
  "origin": "INNSA",
  "destination": "NLRTM",
  "service_type": "CONSOLIDATED",
  "pricing_model": "SLAB_BASED",      // SLAB_BASED or FLAT_RATE
  "rate_basis": "CBM",
  "min_volume_cbm": 3.0,              // For SLAB_BASED only
  "max_volume_cbm": 5.0,              // For SLAB_BASED only
  "rate_per_cbm": 52.0,
  "max_weight_kg_per_cbm": 500.0,     // For SLAB_BASED only
  "minimum_charge": 150.0,
  "weight_per_cbm_conversion": 1000.0,
  "transit_days": 28,
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31",
  "currency": "USD",
  "is_active": true
}
```

---

#### 5.3.2 LCL Surcharges

**List Surcharges**: `GET /api/lcl-surcharges?vendor_id=1&limit=50`  
**Get by ID**: `GET /api/lcl-surcharges/:id`  
**Create**: `POST /api/lcl-surcharges`  
**Update**: `PUT /api/lcl-surcharges/:id`  
**Delete**: `DELETE /api/lcl-surcharges/:id`  
**Bulk Create**: `POST /api/lcl-surcharges/bulk`

**Create/Update Request**:
```json
{
  "vendor_id": 1,
  "contract_id": 1,
  "charge_code": "BAF",
  "origin": "INNSA",                   // Optional: for origin-specific charges
  "destination": "NLRTM",              // Optional: for destination-specific charges
  "applies_scope": "freight",          // freight, origin, destination, other
  "calc_method": "PERCENTAGE",         // PER_CBM, PERCENTAGE, PER_SHIPMENT, FLAT
  "amount": null,                      // For PER_CBM, PER_SHIPMENT, FLAT
  "percentage": 10.0,                  // For PERCENTAGE only
  "currency": "USD",
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31",
  "is_active": true
}
```

---

#### 5.3.3 LCL Shipment Items

**List Items**: `GET /api/lcl-items?shipment_id=123&limit=50`  
**Get by ID**: `GET /api/lcl-items/:id`  
**Create**: `POST /api/lcl-items`  
**Update**: `PUT /api/lcl-items/:id`  
**Delete**: `DELETE /api/lcl-items/:id`  
**Bulk Create**: `POST /api/lcl-items/bulk`

**Create/Update Request**:
```json
{
  "shipment_id": 123,
  "length_cm": 120,
  "width_cm": 80,
  "height_cm": 100,
  "gross_weight_kg": 500,
  "pieces": 2,
  "is_stackable": true,
  "description": "Electronics",
  "hs_code": "8471.30.00",
  "commodity": "Laptops"
}
```

**Note**: `volume_cbm`, `total_volume_cbm`, `total_weight_kg`, `volumetric_weight_kg`, and `chargeable_weight_kg` are auto-calculated by the database.

---

## 6. FCL Inland Haulage Pricing Models 🚨 NEW

### Overview

The V4 API now supports **3 different inland haulage pricing models** to prevent double-charging when carriers include inland haulage in their ocean freight rates.

**Problem Solved**: Previously, if a carrier quoted a door-to-door rate (e.g., INSON-NLRTM for $2000 with IHE included), the API would add IHE again, resulting in $2200 (WRONG).

**Solution**: The `ocean_freight_rate` table now has an `includes_inland_haulage` JSONB column that tells the API how to handle inland charges.

---

### 6.1 Three Pricing Models

#### Model 1: Gateway Port Pricing (Traditional) ✅ DEFAULT

**Scenario**: Ocean freight is priced from a gateway port (e.g., INNSA-NLRTM), and inland haulage is billed separately.

**Example**:
- Ocean: INNSA-NLRTM = $1500
- IHE: INSON-INNSA = $200
- Total: $1700

**Configuration**: No `includes_inland_haulage` tag needed (default behavior).

**API Behavior**:
```json
{
  "ocean_freight_cost_usd": 1500,
  "inland_haulage": {
    "pricing_model": "gateway_port",
    "ihe_charges": {
      "found": true,
      "total_amount_usd": 200
    },
    "total_haulage_usd": 200
  },
  "grand_total_usd": 1700
}
```

---

#### Model 2: All-Inclusive Pricing 🚨 PREVENTS DOUBLE-CHARGING

**Scenario**: Ocean freight is priced door-to-door and **already includes** inland haulage in the rate.

**Example** (Maersk):
- Ocean: INSON-NLRTM = $2000 (IHE included)
- IHE: $0 (bundled)
- Total: $2000

**Configuration**:
```sql
UPDATE ocean_freight_rate
SET includes_inland_haulage = jsonb_build_object(
  'ihe_included', true,
  'pricing_model', 'all_inclusive',
  'notes', 'Door-to-door all-inclusive rate'
)
WHERE vendor_id = 1 AND origin_code = 'INSON';
```

**API Behavior**:
```json
{
  "ocean_freight_cost_usd": 2000,
  "inland_haulage": {
    "pricing_model": "all_inclusive",
    "ihe_charges": {
      "found": false,
      "bundled": true,
      "total_amount_usd": 0,
      "message": "IHE is included in ocean freight rate"
    },
    "total_haulage_usd": 0,
    "notes": "Inland haulage bundled in ocean rate"
  },
  "grand_total_usd": 2000
}
```

✅ **Result**: No double-charging!

---

#### Model 3: Inland Origin Pricing

**Scenario**: Ocean freight is priced **from** an inland point, but carrier **still bills IHE separately**.

**Example** (Some carriers):
- Ocean: INSON-NLRTM = $1800 (priced from inland)
- IHE: INSON-INNSA = $200 (billed separately)
- Total: $2000

**Configuration**:
```sql
UPDATE ocean_freight_rate
SET includes_inland_haulage = jsonb_build_object(
  'ihe_included', false,
  'ihe_from_location', 'INSON',
  'ihe_to_location', 'INNSA',
  'pricing_model', 'inland_origin',
  'notes', 'Ocean priced from inland, IHE billed separately'
)
WHERE id = 123;
```

**API Behavior**:
```json
{
  "ocean_freight_cost_usd": 1800,
  "inland_haulage": {
    "pricing_model": "inland_origin",
    "ihe_charges": {
      "found": true,
      "route": "INSON → INNSA",
      "total_amount_usd": 200
    },
    "total_haulage_usd": 200
  },
  "grand_total_usd": 2000
}
```

---

### 6.2 Detection Logic

The API automatically detects the pricing model based on the `includes_inland_haulage` JSONB column:

```typescript
if (!includes_inland_haulage) {
  // Model 1: Gateway Port (default)
  pricing_model = 'gateway_port';
  shouldCalculateIHE = originIsInland;
  shouldCalculateIHI = destinationIsInland;
}
else if (includes_inland_haulage.pricing_model === 'all_inclusive') {
  // Model 2: All-Inclusive
  shouldCalculateIHE = false; // Don't add IHE
  shouldCalculateIHI = false; // Don't add IHI
}
else if (includes_inland_haulage.pricing_model === 'inland_origin') {
  // Model 3: Inland Origin
  shouldCalculateIHE = !includes_inland_haulage.ihe_included;
  shouldCalculateIHI = !includes_inland_haulage.ihi_included;
}
```

---

### 6.3 Migration Path (Safe Rollout)

**Phase 1: Deploy Code** ✅ DONE
- New logic deployed
- All existing rates have `includes_inland_haulage = NULL`
- **Zero customer impact** (default = gateway_port)

**Phase 2: Identify Problem Rates**
```sql
-- Find rates that might be double-charging
SELECT 
  id, 
  vendor_id, 
  origin_code, 
  destination_code,
  sell_amount
FROM ocean_freight_rate
WHERE origin_code IN (
  SELECT unlocode FROM locations WHERE location_type = 'INLAND'
)
AND includes_inland_haulage IS NULL;
```

**Phase 3: Tag Rates (Controlled)**
```sql
-- Test with ONE rate first
UPDATE ocean_freight_rate
SET includes_inland_haulage = jsonb_build_object(
  'ihe_included', true,
  'pricing_model', 'all_inclusive',
  'notes', 'Testing new logic - Maersk door rate'
)
WHERE id = 123;

-- Test with prepare-quote
-- Verify IHE is NOT added
-- If good, tag more rates
```

**Phase 4: Monitor (Gradual)**
- Tag 5 rates → Test → Monitor
- Tag 50 rates → Test → Monitor
- Tag all applicable rates

---

### 6.4 Affected Endpoints

**Updated Endpoints**:
- `POST /api/v4/prepare-quote` ← Primary update
- `POST /api/v4/search-rates` ← No change yet (uses MV)

**Backward Compatibility**: ✅
- All untagged rates work as before
- Only tagged rates use new logic
- Zero breaking changes

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

## 🗂️ RMS Data Management - CRUD APIs

### Vendors

#### List Vendors
**Endpoint**: `GET /api/vendors`

**Query Parameters**:
- `vendor_type` (optional): Filter by vendor type (e.g., "carrier")
- `page` (default: 1): Page number
- `limit` (default: 100): Records per page

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "MAERSK",
      "alias": "Maersk Line",
      "vendor_type": "carrier",
      "mode": "ocean",
      "external_ref": "MSK",
      "Logo_URL": "https://...",
      "tenant_id": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 50
  }
}
```

#### Get Single Vendor
**Endpoint**: `GET /api/vendors/:vendorId`

#### Create Vendor
**Endpoint**: `POST /api/vendors`

**Request Body**:
```json
{
  "name": "MSC",
  "alias": "Mediterranean Shipping Company",
  "vendor_type": "carrier",
  "mode": "ocean",
  "external_ref": "MSC"
}
```

#### Update Vendor
**Endpoint**: `PUT /api/vendors/:vendorId`

**Request Body**: (only include fields to update)
```json
{
  "alias": "MSC Mediterranean Shipping Company",
  "Logo_URL": "https://..."
}
```

#### Delete Vendor
**Endpoint**: `DELETE /api/vendors/:vendorId`

---

### Contracts

#### List Contracts
**Endpoint**: `GET /api/contracts`

**Query Parameters**:
- `vendor_id` (optional): Filter by vendor ID
- `page` (default: 1): Page number
- `limit` (default: 100): Records per page

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "contract_number": "1-SPOT-202511-001",
      "vendor_id": 1,
      "vendor_name": "MAERSK",
      "vendor_logo": "https://...",
      "name": "Spot Ocean Base",
      "mode": "ocean",
      "effective_from": "2025-10-07",
      "effective_to": "2026-01-05",
      "is_spot": true,
      "currency": "USD",
      "tenant_id": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 25
  }
}
```

#### Get Single Contract
**Endpoint**: `GET /api/contracts/:contractId`

#### Create Contract
**Endpoint**: `POST /api/contracts`

**Request Body**:
```json
{
  "vendor_id": 1,
  "name": "Annual Contract 2025",
  "mode": "ocean",
  "effective_from": "2025-01-01",
  "effective_to": "2025-12-31",
  "is_spot": false,
  "currency": "USD",
  "terms": {}
}
```

**Note**: `contract_number` is auto-generated using format: `{vendor_id}-{SPOT|CNTR}-{YYYYMM}-{sequence}`

#### Update Contract
**Endpoint**: `PUT /api/contracts/:contractId`

#### Delete Contract
**Endpoint**: `DELETE /api/contracts/:contractId`

---

### Ocean Freight Rates

#### List Ocean Freight Rates
**Endpoint**: `GET /api/ocean-freight-rates`

**Query Parameters**:
- `origin` (optional): Origin port code (e.g., "INNSA")
- `destination` (optional): Destination port code (e.g., "NLRTM")
- `vendor_id` (optional): Filter by vendor ID
- `contract_id` (optional): Filter by contract ID
- `container_type` (optional): Filter by container type (e.g., "40HC")
- `is_preferred` (optional): Filter by preferred status (true/false)
- `page` (default: 1): Page number
- `limit` (default: 50): Records per page

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "contract_id": 1,
      "origin_code": "INNSA",
      "destination_code": "NLRTM",
      "origin_name": "Nhava Sheva",
      "destination_name": "Rotterdam",
      "container_type": "40HC",
      "buy_amount": 1500.00,
      "currency": "USD",
      "tt_days": 28,
      "is_preferred": false,
      "valid_from": "2025-01-01",
      "valid_to": "2025-12-31",
      "vendor_id": 1,
      "contract_name": "Spot Ocean Base",
      "is_spot": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "count": 45
  }
}
```

**Note**: This endpoint queries the `ocean_freight_rate` table directly with JOINs to `locations` and `rate_contract` tables for real-time data.

#### Get Single Ocean Freight Rate
**Endpoint**: `GET /api/ocean-freight-rates/:rateId`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "contract_id": 1,
    "origin_code": "INNSA",
    "destination_code": "NLRTM",
    "origin_name": "Nhava Sheva",
    "destination_name": "Rotterdam",
    "container_type": "40HC",
    "buy_amount": 1500.00,
    "currency": "USD",
    "tt_days": 28,
    "is_preferred": false,
    "valid_from": "2025-01-01",
    "valid_to": "2025-12-31"
  }
}
```

#### Create Ocean Freight Rate
**Endpoint**: `POST /api/ocean-freight-rates`

**Request Body**:
```json
{
  "contract_id": 1,
  "origin_code": "INNSA",
  "destination_code": "NLRTM",
  "container_type": "40HC",
  "buy_amount": 1500.00,
  "currency": "USD",
  "tt_days": 28,
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31",
  "is_preferred": false
}
```

**Note**: The API automatically looks up `pol_id` and `pod_id` from the `locations` table based on `origin_code` and `destination_code`.

#### Update Ocean Freight Rate
**Endpoint**: `PUT /api/ocean-freight-rates/:rateId`

**Request Body**: (only include fields to update)
```json
{
  "buy_amount": 1600.00,
  "tt_days": 26,
  "valid_to": "2026-01-31"
}
```

#### Delete Ocean Freight Rate
**Endpoint**: `DELETE /api/ocean-freight-rates/:rateId`

#### Mark Rate as Preferred
**Endpoint**: `PUT /api/ocean-freight-rates/:rateId`

**Request Body**:
```json
{
  "is_preferred": true
}
```

---

### Surcharges

#### List Surcharges
**Endpoint**: `GET /api/surcharges`

**Query Parameters**:
- `location_code` (optional): Filter by location UN/LOCODE
- `vendor_id` (optional): Filter by vendor ID
- `contract_id` (optional): Filter by contract ID
- `applies_scope` (optional): Filter by scope (global/location/contract)
- `page` (default: 1): Page number
- `limit` (default: 50): Records per page

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Terminal Handling Charge",
      "code": "THC",
      "amount": 150.00,
      "currency": "USD",
      "applies_scope": "location",
      "location_code": "INNSA",
      "vendor_id": null,
      "contract_id": null,
      "container_type": null,
      "valid_from": "2025-01-01",
      "valid_to": "2025-12-31",
      "tenant_id": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "count": 25
  }
}
```

#### Get Single Surcharge
**Endpoint**: `GET /api/surcharges/:surchargeId`

#### Create Surcharge
**Endpoint**: `POST /api/surcharges`

**Request Body**:
```json
{
  "name": "Terminal Handling Charge",
  "code": "THC",
  "amount": 150.00,
  "currency": "USD",
  "applies_scope": "location",
  "location_code": "INNSA",
  "container_type": null,
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31"
}
```

**Scope Types**:
- `global`: Applies to all rates
- `location`: Applies to specific location (requires `location_code`)
- `contract`: Applies to specific contract (requires `contract_id`)
- `vendor`: Applies to specific vendor (requires `vendor_id`)

#### Update Surcharge
**Endpoint**: `PUT /api/surcharges/:surchargeId`

#### Delete Surcharge
**Endpoint**: `DELETE /api/surcharges/:surchargeId`

---

### Margin Rules

#### List Margin Rules
**Endpoint**: `GET /api/margin-rules`

**Query Parameters**:
- `level` (optional): Filter by level (global/trade_zone/port_pair)
- `mark_kind` (optional): Filter by type (percentage/fixed/multiplier)
- `component_type` (optional): Filter by component type
- `page` (default: 1): Page number
- `limit` (default: 50): Records per page

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "level": "port_pair",
      "pol_id": 123,
      "pod_id": 456,
      "origin_code": "INNSA",
      "origin_name": "Nhava Sheva",
      "origin_country": "IN",
      "destination_code": "NLRTM",
      "destination_name": "Rotterdam",
      "destination_country": "NL",
      "tz_o": null,
      "tz_d": null,
      "mode": "ocean",
      "container_type": null,
      "component_type": "ocean_freight",
      "mark_kind": "percentage",
      "mark_value": 15.5,
      "valid_from": "2025-01-01",
      "valid_to": "2025-12-31",
      "priority": 100,
      "tenant_id": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "count": 13
  }
}
```

**Note**: The API enriches margin rules with port names by joining with the `locations` table. It returns `origin_code`/`origin_name` instead of `pol_code`/`pol_name` to align with the pricing migration strategy.

#### Get Single Margin Rule
**Endpoint**: `GET /api/margin-rules/:ruleId`

#### Create Margin Rule
**Endpoint**: `POST /api/margin-rules`

**Request Body** (Port Pair):
```json
{
  "level": "port_pair",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "mode": "ocean",
  "container_type": null,
  "component_type": "ocean_freight",
  "mark_kind": "percentage",
  "mark_value": 15.5,
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31",
  "priority": 100
}
```

**Request Body** (Trade Zone):
```json
{
  "level": "trade_zone",
  "tz_o": "ISC-W",
  "tz_d": "GULF",
  "mode": "ocean",
  "container_type": null,
  "component_type": "ocean_freight",
  "mark_kind": "percentage",
  "mark_value": 10.0,
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31",
  "priority": 50
}
```

**Request Body** (Global):
```json
{
  "level": "global",
  "mode": null,
  "container_type": null,
  "component_type": "ocean_freight",
  "mark_kind": "percentage",
  "mark_value": 15.0,
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31",
  "priority": 10
}
```

**Level Types**:
- `global`: Applies to all routes
- `trade_zone`: Applies to specific trade zone pair (requires `tz_o` and `tz_d`)
- `port_pair`: Applies to specific port pair (requires `pol_code` and `pod_code`)

**Mark Kind Types**:
- `percentage`: Markup as percentage (e.g., 15 = 15%)
- `fixed`: Fixed amount markup
- `multiplier`: Multiplier (e.g., 1.2 = 20% markup)

#### Update Margin Rule
**Endpoint**: `PUT /api/margin-rules/:ruleId`

**Request Body**: (only include fields to update)
```json
{
  "mark_value": 17.5,
  "priority": 110
}
```

#### Delete Margin Rule
**Endpoint**: `DELETE /api/margin-rules/:ruleId`

---

## 🔍 Field Name Migration Strategy

### Origin/Destination vs POL/POD

The RMS system uses the following naming convention:

- **`origin`/`destination`**: Used for pricing and cargo location (where cargo starts/ends)
- **`pol`/`pod`**: Reserved for routing perspective (where vessel loads/discharges)

**Current Implementation**:
- Ocean Freight Rates: Use `origin_code`/`destination_code` in API, but store as `pol_id`/`pod_id` in database (initially same values)
- Margin Rules: Database uses `pol_id`/`pod_id`, but API exposes as `origin_code`/`origin_name` and `destination_code`/`destination_name`
- Future: `pol`/`pod` may diverge from `origin`/`destination` for inland/routing scenarios

**Migration Document**: See `DATABASE_MIGRATION_STRATEGY.md` for full details.

---

## 🔗 Support

For issues or questions:
- Check server health: `GET /health`
- Verify authentication token is valid
- Ensure all required fields are provided
- Review error messages in response

---

*Last Updated: 2025-11-18*  
*API Version: 4.0*


