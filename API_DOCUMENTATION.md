# RMS MCP Server - API Documentation

## Overview
The RMS MCP Server provides RESTful API endpoints for freight rate management, local charges retrieval, and quote generation. Built with Fastify and Supabase, it supports both MCP (Model Context Protocol) for Claude Desktop and HTTP API for n8n workflow automation.

**Base URL**: `http://13.204.127.113:3000` (Production Server)  
**Development**: `http://localhost:3000` (Local development)  
**Server**: Fastify with CORS enabled  
**Security**: JWT Authentication with Multi-Tenant Isolation

## 🔒 Authentication & Security

All API endpoints (except `/health` and `/api/auth/token`) require JWT authentication and tenant validation:

### Required Headers
- `Authorization: Bearer <jwt_token>`
- `x-tenant-id: <tenant_uuid>`

### JWT Token Generation
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

### Security Features
- ✅ **JWT Authentication**: All API calls require valid tokens
- ✅ **Tenant Isolation**: Each tenant can only access their own data
- ✅ **Row Level Security**: Database-level tenant isolation via Supabase RLS
- ✅ **Views & Materialized Views**: All database views include tenant_id filtering
- ✅ **Header Validation**: Both Authorization and x-tenant-id required
- ✅ **Token Expiration**: 1-hour token lifetime for security
- ✅ **Session Context**: Automatic tenant context setting for all database queries

### Error Responses
- **401 Unauthorized**: Missing or invalid authentication headers
- **403 Forbidden**: Tenant ID mismatch between token and header

---

## 🏗️ Database Architecture & Tenant Isolation

### Multi-Tenant Database Design
The RMS system implements comprehensive tenant isolation at multiple database levels:

#### **Base Tables**
All primary tables include `tenant_id` columns with Row Level Security (RLS) policies:
```sql
-- Example: Ocean freight rates table
CREATE TABLE ocean_freight_rate (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  pol_code VARCHAR(10),
  pod_code VARCHAR(10),
  -- ... other columns
);

-- RLS Policy
CREATE POLICY tenant_isolation_ocean_freight_rate ON ocean_freight_rate
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

#### **Views & Materialized Views**
All database views and materialized views automatically filter by `tenant_id`:
- **`mv_freight_sell_prices`**: Materialized view with tenant isolation
- **`v_local_charges_details`**: View with tenant filtering
- **`fx_rate`**: Exchange rates with tenant context

#### **Session Context Management**
Every API request automatically sets tenant context:
```typescript
// Automatically called for all authenticated requests
await supabase.rpc('set_tenant_context', {
  tenant_id: decoded.tenant_id,
  user_id: decoded.user_id
});
```

#### **Security Benefits**
- 🔒 **Database-Level Isolation**: Even direct database access respects tenant boundaries
- 🔒 **View-Level Filtering**: All aggregated data automatically filtered by tenant
- 🔒 **Session-Based Context**: Tenant ID set per request session
- 🔒 **RLS Enforcement**: Supabase automatically applies tenant policies

---

## Table of Contents
1. [🔒 Authentication & Security](#-authentication--security)
2. [🏗️ Database Architecture & Tenant Isolation](#️-database-architecture--tenant-isolation)
3. [Health Check](#health-check)
4. [API Version 1 (V1) Endpoints](#api-version-1-v1-endpoints)
   - [Search Rates](#search-rates)
   - [Get Local Charges](#get-local-charges)
   - [Prepare Quote](#prepare-quote)
5. [API Version 2 (V2) Endpoints](#api-version-2-v2-endpoints)
   - [V2 Search Rates](#v2-search-rates)
   - [V2 Prepare Quote](#v2-prepare-quote)
6. [API Version 3 (V3) Endpoints](#api-version-3-v3-endpoints)
   - [V3 Prepare Quote](#v3-prepare-quote-inland-haulage-only)
7. [Data Models](#data-models)
8. [Error Handling](#error-handling)
9. [FX Conversion](#fx-conversion)

---

## 🔐 Authentication Examples

### Complete Authentication Flow

```bash
# Step 1: Generate JWT Token
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "user_id": "user123"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "tenant_id": "00000000-0000-0000-0000-000000000001",
#   "expires_in": "1h"
# }

# Step 2: Use Token in API Call
curl -X POST http://localhost:3000/api/search-rates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC"
  }'
```

### Error Examples

```bash
# Missing Authentication Headers (401)
curl -X POST http://localhost:3000/api/search-rates \
  -H "Content-Type: application/json" \
  -d '{"pol_code":"INNSA","pod_code":"NLRTM"}'

# Response: 401 Unauthorized
# {
#   "error": "Missing required headers",
#   "required": ["authorization: Bearer <token>", "x-tenant-id: <tenant_id>"]
# }

# Wrong Tenant ID (403)
curl -X POST http://localhost:3000/api/search-rates \
  -H "Authorization: Bearer <valid_token>" \
  -H "x-tenant-id: wrong-tenant-id" \
  -d '{"pol_code":"INNSA","pod_code":"NLRTM"}'

# Response: 403 Forbidden
# {
#   "error": "Tenant ID mismatch",
#   "token_tenant": "00000000-0000-0000-0000-000000000001",
#   "header_tenant": "wrong-tenant-id"
# }
```

---

## API Version 1 (V1) Endpoints

The original API endpoints that provide comprehensive freight rate management functionality.

---

### Health Check

**Endpoint**: `GET /health`

**Description**: Check if the API server is running.

**Request**: No parameters required

**Response**:
```json
{
  "status": "ok",
  "service": "rms-api",
  "timestamp": "2025-10-13T06:00:00.000Z"
}
```

**Example**:
```bash
curl http://localhost:3000/health
```

---

### Search Rates

**Endpoint**: `POST /api/search-rates`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Search for ocean freight rates from the `mv_freight_sell_prices` view. Returns all matching rates with detailed pricing breakdown.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "pol_code": "INNSA",           // Required: Port of Loading UN/LOCODE
  "pod_code": "NLRTM",           // Required: Port of Discharge UN/LOCODE
  "container_type": "40HC",      // Optional: Container type (20GP, 40GP, 40HC, 45HC)
  "vendor_name": "MSC"           // Optional: Filter by carrier name (partial match)
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "vendor": "MSC",
      "route": "Nhava Sheva (JNPT) → Rotterdam",
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
      "rate_id": 71
    }
  ]
}
```

**Use Cases**:
- Find all available rates for a route
- Filter by container type
- Filter by specific carrier
- Compare pricing across vendors

**Example**:
```bash
curl -X POST http://localhost:3000/api/search-rates \
  -H "Content-Type: application/json" \
  -d '{"pol_code":"INNSA","pod_code":"NLRTM","container_type":"40HC"}'
```

---

### Get Local Charges

**Endpoint**: `POST /api/get-local-charges`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Retrieve origin and/or destination local charges from `v_local_charges_details`. Supports flexible querying - can request origin only, destination only, or both.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "pol_code": "INNSA",           // Optional*: Origin port code
  "pod_code": "NLRTM",           // Optional*: Destination port code
  "container_type": "40HC",      // Optional: Filter by container type
  "vendor_name": "MSC"           // Optional: Filter by carrier name
}
```
**Note**: At least one of `pol_code` or `pod_code` must be provided.

**Response**:
```json
{
  "success": true,
  "data": {
    "origin_charges": [
      {
        "charge_name": "Documentation Fee",
        "charge_code": "DOC_FEE",
        "applies_scope": "origin",
        "charge_amount": 1800,
        "charge_currency": "INR",
        "amount_usd": 21.69,
        "uom": "per_bl",
        "vendor_name": "MSC",
        "port_code": "INNSA",
        "port_name": "Nhava Sheva (JNPT)",
        "container_type": "40HC"
      }
    ],
    "destination_charges": [
      {
        "charge_name": "Delivery Order Fee",
        "charge_code": "DO_FEE",
        "applies_scope": "dest",
        "charge_amount": 50,
        "charge_currency": "EUR",
        "amount_usd": 58.82,
        "uom": "per_bl",
        "vendor_name": "MSC",
        "port_code": "NLRTM",
        "port_name": "Rotterdam",
        "container_type": "40HC"
      }
    ],
    "origin_total_usd": 139.76,
    "destination_total_usd": 441.17,
    "origin_total_local": 11600,
    "destination_total_local": 375,
    "fx_rates": {
      "INR": 0.012048,
      "EUR": 1.176471
    },
    "summary": {
      "pol_code": "INNSA",
      "pod_code": "NLRTM",
      "container_type": "40HC",
      "vendor_filter": "MSC",
      "origin_charges_count": 4,
      "destination_charges_count": 4,
      "currencies_found": ["INR", "EUR"],
      "fx_date": "2025-10-13"
    }
  }
}
```

**Query Modes**:

1. **Origin Port Only**:
```json
{"pol_code": "INNSA"}
```
Returns all origin charges for INNSA (destination_charges will be empty)

2. **Destination Port Only**:
```json
{"pod_code": "NLRTM"}
```
Returns all destination charges for NLRTM (origin_charges will be empty)

3. **Both Ports (Route-specific)**:
```json
{"pol_code": "INNSA", "pod_code": "NLRTM"}
```
Returns origin charges for INNSA AND destination charges for NLRTM

**Use Cases**:
- Get all charges for a specific port
- Get route-specific charges
- Filter charges by vendor and container type
- Compare charges across different vendors

**Example**:
```bash
curl -X POST http://localhost:3000/api/get-local-charges \
  -H "Content-Type: application/json" \
  -d '{"pol_code":"INNSA","pod_code":"NLRTM","container_type":"40HC","vendor_name":"MSC"}'
```

---

### Prepare Quote

**Endpoint**: `POST /api/prepare-quote`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Generate a complete shipping quote by aggregating ocean freight from the preferred rate and associated local charges. Automatically deduplicates charges and converts currencies to USD.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",  // Required: Salesforce Organization ID
  "pol_code": "INNSA",                     // Required: Port of Loading
  "pod_code": "NLRTM",                     // Required: Port of Discharge
  "container_type": "40HC",                // Required: Container type
  "container_count": 2                     // Optional: Number of containers (default: 1)
}
```


{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "route": {
      "pol": "INNSA",
      "pod": "NLRTM",
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
      "origin_charges": {
        "charges": [
          {
            "charge_name": "Documentation Fee",
            "charge_code": "DOC_FEE",
            "charge_amount": 1800,
            "charge_currency": "INR",
            "amount_usd": 21.69,
            "uom": "per_bl"
          }
        ],
        "total_local": 11600,
        "total_usd": 139.76,
        "count": 4
      },
      "destination_charges": {
        "charges": [
          {
            "charge_name": "Delivery Order Fee",
            "charge_code": "DO_FEE",
            "charge_amount": 50,
            "charge_currency": "EUR",
            "amount_usd": 58.82,
            "uom": "per_bl"
          }
        ],
        "total_local": 375,
        "total_usd": 441.17,
        "count": 4
      },
      "other_charges": {
        "charges": [],
        "total_local": 0,
        "total_usd": 0,
        "count": 0
      }
    },
    "totals": {
      "ocean_freight_total": 4927.68,
      "origin_total_local": 23200,
      "origin_total_usd": 279.52,
      "destination_total_local": 750,
      "destination_total_usd": 882.34,
      "other_total_local": 0,
      "other_total_usd": 0,
      "grand_total_usd": 6089.54,
      "currency": "USD",
      "fx_rates": {
        "INR": 0.012048,
        "EUR": 1.176471
      },
      "currencies_used": ["INR", "EUR"]
    },
    "quote_summary": {
      "route_display": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
      "container_info": "2x 40HC",
      "total_charges_breakdown": {
        "ocean_freight_usd": 4927.68,
        "local_charges_usd": 1161.86
      },
      "vendor_info": {
        "carrier": "MSC",
        "transit_days": 18
      },
      "currency_conversion": {
        "fx_rates_applied": {
          "INR": 0.012048,
          "EUR": 1.176471
        },
        "fx_date": "2025-10-13",
        "currencies_converted": ["INR", "EUR"]
      }
    },
    "metadata": {
      "generated_at": "2025-10-13T06:30:00.000Z",
      "pol_code": "INNSA",
      "pod_code": "NLRTM",
      "container_type": "40HC",
      "container_count": 2
    }
  }
}
```

**Business Logic**:
1. Fetches the **preferred rate** (`is_preferred = true`) for the specified route and container type
2. Retrieves local charges that match the rate's **contract_id**, **pol_id/pod_id**, and **charge_location_type**
3. **Deduplicates charges** by `charge_code` (takes first occurrence only)
4. Converts all local currency amounts to USD using database rates or fallback rates
5. Multiplies all totals by `container_count`

**Use Cases**:
- Generate customer quotes
- Calculate total shipping costs
- Compare costs across different container counts
- Multi-currency quote generation

**Example**:
```bash
curl -X POST http://localhost:3000/api/prepare-quote \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 2
  }'
```

---

## API Version 2 (V2) Endpoints

The V2 API provides a simplified, single-rate quote flow designed for Salesforce integration. These endpoints support a streamlined workflow where users can search for rates and then create quotes for specific rate IDs.

### Key Differences from V1:
- **Simplified Flow**: Search rates → Select rate → Create quote
- **Rate ID Based**: Quotes are created for specific rate IDs rather than preferred rates
- **Salesforce Integration**: Optimized for Salesforce Org ID tracking
- **Container Count Validation**: Enforces 1-10 container limit
- **Same Response Structure**: V2 quotes match V1 structure for compatibility

---

### V2 Search Rates

**Endpoint**: `POST /api/v2/search-rates`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Search for ocean freight rates with enhanced validation and Salesforce Org ID support. Returns all matching rates with detailed pricing breakdown.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "pol_code": "INNSA",                    // Required: Port of Loading UN/LOCODE
  "pod_code": "NLRTM",                    // Required: Port of Discharge UN/LOCODE
  "container_type": "40HC",               // Optional: Container type (20GP, 40GP, 40HC, 45HC)
  "vendor_name": "MSC",                   // Optional: Filter by carrier name (partial match)
  "salesforce_org_id": "00DBE000002eBzh"  // Required: Salesforce Organization ID
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "vendor": "MSC",
      "route": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
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
      "rate_id": 71
    }
  ]
}
```

**Validation**:
- `pol_code` and `pod_code` are required and validated
- `salesforce_org_id` is required for tenant tracking
- Returns empty array if no rates found (not an error)

**Use Cases**:
- Salesforce integration for rate discovery
- Multi-vendor rate comparison
- Route-specific rate lookup

**Example**:
```bash
curl -X POST http://localhost:3000/api/v2/search-rates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "salesforce_org_id": "00DBE000002eBzh"
  }'
```

---

### V2 Prepare Quote

**Endpoint**: `POST /api/v2/prepare-quote`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Create a complete shipping quote for a specific rate ID. This endpoint fetches the exact rate details and calculates associated local charges, returning a V1-compatible quote structure.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",  // Required: Salesforce Organization ID
  "rate_id": 77,                           // Required: Specific rate ID from search results
  "container_count": 1                     // Optional: Number of containers (1-10, default: 1)
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 77,
    "route": {
      "pol": "INNSA",
      "pod": "NLRTM",
      "container_type": "40HC",
      "container_count": 1
    },
    "quote_parts": {
      "ocean_freight": {
        "carrier": "Hapag-Lloyd",
        "all_in_freight_sell": 2765.84,
        "ocean_freight_buy": 2200,
        "freight_surcharges": 314.4,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 251.44
        },
        "currency": "USD",
        "transit_days": 22,
        "validity": {
          "from": "2025-10-07",
          "to": "2026-01-05"
        },
        "is_preferred": false,
        "rate_id": 77
      },
      "origin_charges": {
        "charges": [
          {
            "charge_code": "DOC_FEE",
            "vendor_charge_name": "Documentation Fee",
            "charge_amount": 1800,
            "charge_currency": "INR",
            "amount_usd": 21.6,
            "uom": "per_bl"
          }
        ],
        "total_local": 11600,
        "total_usd": 139.2,
        "count": 4
      },
      "destination_charges": {
        "charges": [
          {
            "charge_code": "DO_FEE",
            "vendor_charge_name": "Delivery Order Fee",
            "charge_amount": 50,
            "charge_currency": "EUR",
            "amount_usd": 50,
            "uom": "per_bl"
          }
        ],
        "total_local": 375,
        "total_usd": 375,
        "count": 4
      },
      "other_charges": {
        "charges": [],
        "total_local": 0,
        "total_usd": 0,
        "count": 0
      }
    },
    "totals": {
      "ocean_freight_total": 2765.84,
      "origin_total_local": 11600,
      "origin_total_usd": 139.2,
      "destination_total_local": 375,
      "destination_total_usd": 375,
      "other_total_local": 0,
      "other_total_usd": 0,
      "grand_total_usd": 3280.04,
      "currency": "USD",
      "fx_rates": {
        "INR": 0.012
      },
      "currencies_used": ["INR", "EUR"]
    },
    "quote_summary": {
      "route_display": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
      "container_info": "1x 40HC",
      "total_charges_breakdown": {
        "ocean_freight_usd": 2765.84,
        "local_charges_usd": 514.2
      },
      "vendor_info": {
        "carrier": "Hapag-Lloyd",
        "transit_days": 22
      },
      "currency_conversion": {
        "fx_rates_applied": {
          "INR": 0.012
        },
        "fx_date": "2025-10-15",
        "currencies_converted": ["INR", "EUR"]
      }
    },
    "metadata": {
      "generated_at": "2025-10-15T10:34:05.508Z",
      "pol_code": "INNSA",
      "pod_code": "NLRTM",
      "container_type": "40HC",
      "container_count": 1
    }
  }
}
```

**Business Logic**:
1. Fetches the **specific rate** by `rate_id` from the database
2. Retrieves local charges that match the rate's **contract_id**, **pol_id/pod_id**, and **charge_location_type**
3. **Deduplicates charges** by `charge_code` (takes first occurrence only)
4. Converts all local currency amounts to USD using latest available FX rates
5. Multiplies all totals by `container_count`
6. Returns V1-compatible response structure

**Validation**:
- `salesforce_org_id` and `rate_id` are required
- `container_count` must be between 1 and 10 (inclusive)
- Returns 404 if rate_id not found

**Error Responses**:
```json
// Rate not found
{
  "success": false,
  "error": "Rate not found"
}

// Invalid container count
{
  "success": false,
  "error": "container_count must be between 1 and 10"
}

// Missing required parameters
{
  "success": false,
  "error": "salesforce_org_id and rate_id are required"
}
```

**Use Cases**:
- Salesforce quote generation workflow
- Single-rate quote creation
- Rate-specific cost calculation
- Multi-currency quote generation

**Example**:
```bash
curl -X POST http://localhost:3000/api/v2/prepare-quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 77,
    "container_count": 1
  }'
```

**V2 vs V1 Comparison**:

| Feature | V1 | V2 |
|---------|----|----|
| **Rate Selection** | Uses preferred rate (`is_preferred = true`) | Uses specific `rate_id` |
| **Input Parameters** | `pol_code`, `pod_code`, `container_type` | `rate_id`, `salesforce_org_id` |
| **Container Count** | Optional, no validation | Required, validated (1-10) |
| **Response Structure** | Full quote structure | Same as V1 (compatible) |
| **Use Case** | General quote generation | Salesforce integration |
| **Flexibility** | Route-based | Rate-specific |

### API Version Comparison

| Feature | V1 API | V2 API | V3 API |
|---------|--------|--------|--------|
| **Purpose** | Complete quotes (ocean + local) | Rate-specific quotes | Inland haulage only |
| **Input** | `pol_code`, `pod_code`, `container_type` | `rate_id`, `salesforce_org_id` | `pol_code`, `pod_code`, `cargo_weight_mt`, `haulage_type` |
| **Output** | Ocean freight + Local charges | Ocean freight + Local charges | IHE/IHI haulage charges |
| **Inland Support** | Basic port-to-port | Basic port-to-port | Specialized inland logic |
| **Currency** | Multi-currency (USD, EUR, INR) | Multi-currency (USD, EUR, INR) | INR to USD conversion |
| **Use Case** | General shipping quotes | Salesforce integration | Inland container depots |
| **Orchestration** | Standalone | Standalone | Designed for V1 + V3 |
| **Response Structure** | Full quote breakdown | Same as V1 | Haulage charges only |

---

## API Version 3 (V3) Endpoints

The V3 API provides specialized inland haulage pricing for Inland Container Depots (ICD). This API is designed to work in conjunction with V1 API to provide complete pricing for inland routes.

### Key Features:
- **IHE (Inland Haulage Export)**: When POL is inland, calculates haulage from inland to gateway port
- **IHI (Inland Haulage Import)**: When POD is inland, calculates haulage from gateway to inland port
- **Weight-based Pricing**: Considers cargo weight for haulage rate calculation
- **Currency Conversion**: Converts INR haulage charges to USD
- **Orchestrated with V1**: Designed to be called after V1 for complete inland quotes

### V3 Prepare Quote (Inland Haulage Only)

**Endpoint**: `POST /api/v3/prepare-quote`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Calculate inland haulage charges (IHE/IHI) for routes involving inland ports. This API only handles haulage charges and should be used in conjunction with V1 API for complete pricing.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "pol_code": "INTKD",                    // Required: Port of Loading (can be inland)
  "pod_code": "NLRTM",                    // Required: Port of Discharge (can be inland)
  "container_type": "40HC",               // Required: Container type
  "container_count": 1,                   // Optional: Number of containers (default: 1)
  "cargo_weight_mt": 25,                  // Required: Cargo weight in metric tons
  "haulage_type": "carrier"               // Required: "carrier" or "merchant"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "pol_code": "INTKD",
    "pod_code": "NLRTM",
    "pol_is_inland": true,
    "pod_is_inland": false,
    "container_type": "40HC",
    "container_count": 1,
    "haulage_type": "carrier",
    "ihe_charges": {
      "found": true,
      "rate_id": 3,
      "rate_per_container_inr": 52000,
      "total_amount_inr": 52000,
      "total_amount_usd": 624,
      "currency": "INR",
      "exchange_rate": 83.33,
      "vendor_name": "Inland Logistics Co",
      "route_name": "INTKD to INNSA",
      "haulage_type": "IHE"
    },
    "ihi_charges": {
      "found": false,
      "message": "POD is not inland, no IHI needed"
    },
    "exchange_rate": 83.33,
    "message": "V3 function - IHE and IHI haulage logic completed"
  },
  "metadata": {
    "generated_at": "2025-01-17T10:30:00.000Z",
    "pol_code": "INTKD",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 1,
    "api_version": "v3",
    "haulage_only": true
  }
}
```

**Business Logic**:
1. **Location Detection**: Determines if POL/POD are inland ports
2. **IHE Calculation**: If POL is inland AND haulage_type is 'carrier', calculates haulage from inland to gateway
3. **IHI Calculation**: If POD is inland AND haulage_type is 'carrier', calculates haulage from gateway to inland
4. **Weight Matching**: Finds haulage rates that match cargo weight (handles null weight ranges)
5. **Currency Conversion**: Converts INR charges to USD using current exchange rates
6. **Route Validation**: Ensures haulage routes exist between inland and gateway ports

**Use Cases**:
- **Inland to Seaport**: INTKD → NLRTM (IHE needed)
- **Seaport to Inland**: NLRTM → INTKD (IHI needed)  
- **Inland to Inland**: INTKD → INTKD (Both IHE and IHI needed)
- **Seaport to Seaport**: INNSA → NLRTM (No haulage needed)

**Example**:
```bash
curl -X POST http://localhost:3000/api/v3/prepare-quote \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "pol_code": "INTKD",
    "pod_code": "NLRTM", 
    "container_type": "40HC",
    "container_count": 1,
    "cargo_weight_mt": 25,
    "haulage_type": "carrier"
  }'
```

**Integration with V1**:
The V3 API is designed to be used in conjunction with V1 API for complete inland pricing:

1. **Call V1 API**: Get ocean freight + local charges
2. **Check if inland**: Determine if POL/POD are inland ports
3. **Call V3 API**: Get IHE/IHI haulage charges (if needed)
4. **Combine results**: V1 + V3 = Complete inland quote

**n8n Orchestration**:
The `n8n-orchestrated-v1-v3-workflow.json` provides a complete workflow that:
- Calls V1 API for ocean freight + local charges
- Checks if route involves inland ports
- Calls V3 API for haulage charges (if needed)
- Combines results into complete quote
- Sends email response

---

## Data Models

### Container Types
- `20GP` - 20ft General Purpose
- `40GP` - 40ft General Purpose
- `40HC` - 40ft High Cube
- `45HC` - 45ft High Cube

### Charge Scopes (applies_scope)
- `origin` - Charges at origin port
- `dest` - Charges at destination port
- Other values may exist for special charges

### Unit of Measure (UOM)
- `per_bl` - Per Bill of Lading
- `per_cntr` - Per Container
- Other custom units may exist

### Charge Location Types
- `Origin Charges` - Charges at POL
- `Destination Charges` - Charges at POD

---

## Error Handling

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `500` - Server Error (database or processing error)

### Common Errors

**Missing Required Parameters**:
```json
{
  "success": false,
  "error": "At least one of pol_code or pod_code must be provided"
}
```

**No Preferred Rate Found**:
```json
{
  "success": true,
  "data": {
    "quote_parts": {
      "ocean_freight": {
        "carrier": "N/A",
        "all_in_freight_sell": 0,
        ...
      }
    }
  }
}
```
Note: The endpoint returns success but with empty/zero values when no preferred rate is found.

---

## FX Conversion

### Database FX Rates
The system attempts to fetch current exchange rates from the `fx_rate` table:
- **Table**: `fx_rate`
- **Fields**: `rate_date`, `base_ccy`, `quote_ccy`, `rate`
- **Query**: Matches `rate_date` to current date and `quote_ccy = 'USD'`

### Fallback Rates
If no database rate is found, the system uses these fallback rates:

| Currency | Rate (to USD) | Example |
|----------|---------------|---------|
| INR | 0.012048 | 1000 INR = $12.05 |
| EUR | 1.176471 | 100 EUR = $117.65 |
| AED | 0.272480 | 100 AED = $27.25 |
| GBP | 1.369863 | 100 GBP = $136.99 |
| JPY | 0.009091 | 1000 JPY = $9.09 |
| CNY | 0.138889 | 100 CNY = $13.89 |

### Rounding
All USD amounts are rounded to 2 decimal places using banker's rounding.

---

## Usage Examples

### n8n Workflow Integration

**1. Search for Available Rates**:
```javascript
// HTTP Request Node
{
  "method": "POST",
  "url": "http://localhost:3000/api/search-rates",
  "body": {
    "pol_code": "{{$json.origin_port}}",
    "pod_code": "{{$json.destination_port}}",
    "container_type": "{{$json.container_type}}"
  }
}
```

**2. Get Local Charges for a Port**:
```javascript
// HTTP Request Node
{
  "method": "POST",
  "url": "http://localhost:3000/api/get-local-charges",
  "body": {
    "pol_code": "{{$json.port_code}}",
    "vendor_name": "{{$json.carrier}}"
  }
}
```

**3. Generate Complete Quote**:
```javascript
// HTTP Request Node
{
  "method": "POST",
  "url": "http://localhost:3000/api/prepare-quote",
  "body": {
    "salesforce_org_id": "{{$json.salesforce_org_id}}",
    "pol_code": "{{$json.origin}}",
    "pod_code": "{{$json.destination}}",
    "container_type": "{{$json.container}}",
    "container_count": "{{$json.quantity}}"
  }
}
```

---

## Database Views Used

### mv_freight_sell_prices
Materialized view containing ocean freight rates with pricing:
- `pol_code`, `pod_code` - Port codes
- `container_type` - Container type
- `carrier` - Vendor/carrier name
- `all_in_freight_sell` - Total sell price
- `is_preferred` - Preferred rate flag
- `contract_id`, `pol_id`, `pod_id` - Relationship IDs

### v_local_charges_details
View containing local charges at origin/destination:
- `origin_port_code`, `destination_port_code` - Port codes
- `charge_code`, `vendor_charge_name` - Charge identification
- `charge_amount`, `charge_currency` - Pricing
- `applies_scope` - origin/dest indicator
- `charge_location_type` - "Origin Charges" or "Destination Charges"
- `contract_id`, `pol_id`, `pod_id` - Links to rates
- `surcharge_container_type` - Container applicability
- `uom` - Unit of measure

### fx_rate
Currency exchange rates:
- `rate_date` - Effective date
- `base_ccy` - Source currency
- `quote_ccy` - Target currency (USD)
- `rate` - Exchange rate

---

## Best Practices

### For n8n Integration

1. **Error Handling**: Always check the `success` field before processing data
2. **Rate Availability**: Check if `ocean_freight.carrier` is not "N/A" before using quote
3. **Currency Display**: Show both local and USD amounts for transparency
4. **Deduplication**: The API automatically deduplicates charges, no client-side logic needed
5. **Container Count**: Always specify `container_count` to get accurate totals

### Performance Tips

1. **Caching**: Cache location lookups and vendor lists
2. **Batch Requests**: Use separate endpoints in parallel for better performance
3. **Filter Early**: Use `container_type` and `vendor_name` filters to reduce data transfer
4. **Health Checks**: Monitor `/health` endpoint for server availability

### Data Validation

**Required Fields for Quote**:
- `pol_code` and `pod_code` must be valid UN/LOCODEs in database
- `container_type` must match available types
- `container_count` must be positive integer

**Optional Filters**:
- All optional filters use partial matching (case-insensitive)
- Invalid filters return empty results (not errors)

---

## Integration Architecture

```
┌─────────────┐
│   n8n       │
│  Workflow   │
└──────┬──────┘
       │ HTTP REST API
       │
┌──────▼──────────────┐
│  RMS MCP Server     │
│  (Fastify)          │
│  Port: 3000         │
└──────┬──────────────┘
       │ Supabase Client
       │
┌──────▼──────────────┐
│  Supabase Database  │
│  - mv_freight_sell  │
│  - v_local_charges  │
│  - fx_rate          │
└─────────────────────┘
```

### Parallel with Claude Desktop

The same server also runs an MCP interface for Claude Desktop via stdio, allowing both integrations simultaneously:
- **Claude Desktop**: Uses MCP tools via stdio
- **n8n**: Uses HTTP REST API via port 3000

---

## Support & Troubleshooting

### Server Not Responding
1. Check if server is running: `GET /health`
2. Verify environment variables are set
3. Check Supabase connection

### Empty Results
1. Verify port codes exist in database
2. Check if preferred rates exist for the route
3. Ensure container type matches available rates

### Incorrect Totals
1. Check if deduplication is working (one charge per code)
2. Verify FX rates are being applied
3. Ensure container_count is correct

### FX Conversion Issues
1. Check if `fx_rate` table has current rates
2. System will use fallback rates if database rates unavailable
3. Verify currency codes match (INR, EUR, USD, etc.)

---

## CRUD APIs

The RMS MCP Server provides comprehensive CRUD (Create, Read, Update, Delete) APIs for managing Ocean Freight Rates, Surcharges, and Margin Rules. These endpoints support full lifecycle management of rate data with proper tenant isolation.

---

### Ocean Freight Rate CRUD APIs

#### Create Ocean Freight Rate

**Endpoint**: `POST /api/ocean-freight-rates`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Create a new ocean freight rate with automatic location lookup by UN/LOCODE.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "pol_code": "INNSA",              // Required: Port of Loading UN/LOCODE
  "pod_code": "USLSA",              // Required: Port of Discharge UN/LOCODE
  "container_type": "40HC",         // Required: Container type (20GP, 40GP, 40HC, 45HC)
  "buy_amount": 1950,               // Required: Buy rate amount
  "currency": "USD",                // Required: Currency code
  "contract_id": 4,                 // Required: Contract ID
  "tt_days": 18,                    // Optional: Transit time in days
  "is_preferred": false,            // Optional: Preferred rate flag (default: false)
  "valid_from": "2025-10-28",       // Optional: Validity start date (default: today)
  "valid_to": "2026-10-28",         // Optional: Validity end date (default: 1 year from today)
  "via_port_code": "USNYC"          // Optional: Via port UN/LOCODE
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "contract_id": 4,
    "pol_id": 45,
    "pod_id": 78,
    "container_type": "40HC",
    "buy_amount": 1950,
    "currency": "USD",
    "tt_days": 18,
    "via_port_id": null,
    "is_preferred": false,
    "valid_from": "2025-10-28",
    "valid_to": "2026-10-28",
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Validation**:
- `pol_code`, `pod_code`, `container_type`, `buy_amount`, `currency`, and `contract_id` are required
- Location codes must exist and be active in the `locations` table
- Duplicate rates (same `contract_id`, `pol_id`, `pod_id`, `container_type`) are prevented by unique constraint

**Error Responses**:
```json
// Missing required fields
{
  "success": false,
  "error": "Missing required fields: pol_code, pod_code, container_type, buy_amount, currency, contract_id"
}

// Location not found
{
  "success": false,
  "error": "POL location not found: INNSA"
}

// Duplicate rate
{
  "success": false,
  "error": "duplicate key value violates unique constraint..."
}
```

**Example**:
```bash
curl -X POST http://13.204.127.113:3000/api/ocean-freight-rates \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "USLSA",
    "container_type": "40HC",
    "buy_amount": 1950,
    "currency": "USD",
    "contract_id": 4,
    "tt_days": 18,
    "is_preferred": false,
    "valid_from": "2025-10-28",
    "valid_to": "2026-10-28"
  }'
```

---

#### Update Ocean Freight Rate

**Endpoint**: `PUT /api/ocean-freight-rates/:rateId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Update an existing ocean freight rate.

**Path Parameters**:
- `rateId` (integer, required): The ID of the rate to update

**Request Body** (all fields optional):
```json
{
  "buy_amount": 2000,               // Optional: Updated buy amount
  "currency": "USD",                // Optional: Updated currency
  "tt_days": 20,                    // Optional: Updated transit days
  "is_preferred": true,             // Optional: Updated preferred flag
  "valid_from": "2025-11-01",       // Optional: Updated validity start
  "valid_to": "2026-11-01"          // Optional: Updated validity end
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "contract_id": 4,
    "pol_id": 45,
    "pod_id": 78,
    "container_type": "40HC",
    "buy_amount": 2000,
    "currency": "USD",
    "tt_days": 20,
    "via_port_id": null,
    "is_preferred": true,
    "valid_from": "2025-11-01",
    "valid_to": "2026-11-01",
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Example**:
```bash
curl -X PUT http://13.204.127.113:3000/api/ocean-freight-rates/123 \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "buy_amount": 2000,
    "is_preferred": true
  }'
```

---

#### Get Ocean Freight Rate by ID

**Endpoint**: `GET /api/ocean-freight-rates/:rateId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Retrieve a single ocean freight rate by ID from the materialized view (includes pricing details).

**Path Parameters**:
- `rateId` (integer, required): The ID of the rate to retrieve

**Response**:
```json
{
  "success": true,
  "data": {
    "rate_id": 123,
    "pol_code": "INNSA",
    "pod_code": "USLSA",
    "container_type": "40HC",
    "carrier": "MSC",
    "ocean_freight_buy": 1950,
    "freight_surcharges": 289.85,
    "all_in_freight_buy": 2239.85,
    "all_in_freight_sell": 2463.84,
    "currency": "USD",
    "transit_days": 18,
    "is_preferred": false,
    "valid_from": "2025-10-28",
    "valid_to": "2026-10-28"
  }
}
```

**Example**:
```bash
curl -X GET http://13.204.127.113:3000/api/ocean-freight-rates/123 \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>"
```

---

#### List Ocean Freight Rates

**Endpoint**: `GET /api/ocean-freight-rates`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: List ocean freight rates with optional filtering and pagination.

**Query Parameters** (all optional):
- `pol_code` (string): Filter by Port of Loading code
- `pod_code` (string): Filter by Port of Discharge code
- `container_type` (string): Filter by container type (20GP, 40GP, 40HC, 45HC)
- `vendor_name` (string): Filter by carrier/vendor name (exact match)
- `is_preferred` (boolean): Filter by preferred rate flag
- `is_active` (string): Filter by active status (default: 'true')
- `page` (integer): Page number for pagination (default: 1)
- `limit` (integer): Results per page (default: 50)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "rate_id": 123,
      "pol_code": "INNSA",
      "pod_code": "USLSA",
      "container_type": "40HC",
      "carrier": "MSC",
      "ocean_freight_buy": 1950,
      "all_in_freight_sell": 2463.84,
      "currency": "USD",
      "transit_days": 18,
      "is_preferred": false,
      "valid_from": "2025-10-28",
      "valid_to": "2026-10-28"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "count": 1
  }
}
```

**Example**:
```bash
curl -X GET "http://13.204.127.113:3000/api/ocean-freight-rates?pol_code=INNSA&pod_code=USLSA&container_type=40HC&page=1&limit=10" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>"
```

---

#### Delete Ocean Freight Rate

**Endpoint**: `DELETE /api/ocean-freight-rates/:rateId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Soft delete an ocean freight rate by setting `is_active` to false.

**Path Parameters**:
- `rateId` (integer, required): The ID of the rate to delete

**Response**:
```json
{
  "success": true,
  "message": "Ocean freight rate 123 deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE http://13.204.127.113:3000/api/ocean-freight-rates/123 \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>"
```

---

### Surcharge CRUD APIs

#### Create Surcharge

**Endpoint**: `POST /api/surcharges`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Create a new surcharge with automatic location lookup based on `applies_scope`.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "vendor_id": 5,                   // Required: Vendor ID
  "charge_code": "THC",             // Required: Charge code (e.g., THC, BAF, DOC_FEE)
  "amount": 100,                    // Required: Charge amount
  "currency": "USD",                // Optional: Currency (default: "USD")
  "uom": "per_cntr",                // Optional: Unit of measure (default: "per_cntr")
  "contract_id": 4,                 // Optional: Contract ID (default: 1)
  "applies_scope": "origin",        // Required: Scope (origin, port, freight, dest, door, other)
  "pol_code": "INNSA",              // Optional: POL code (required if applies_scope is "origin" or "port")
  "pod_code": "USLSA",              // Optional: POD code (required if applies_scope is "dest" or "door")
  "container_type": "40HC",         // Optional: Container type filter
  "valid_from": "2025-10-28",       // Required: Validity start date
  "valid_to": "2026-10-28"          // Required: Validity end date
}
```

**Valid Values**:
- `applies_scope`: `"origin"`, `"port"`, `"freight"`, `"dest"`, `"door"`, `"other"`
- `uom`: `"per_cntr"`, `"per_bl"`, `"per_shipment"`, `"per_kg"`, `"per_cbm"`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 456,
    "vendor_id": 5,
    "contract_id": 4,
    "charge_code": "THC",
    "amount": 100,
    "currency": "USD",
    "uom": "per_cntr",
    "calc_method": "flat",
    "pol_id": 45,
    "pod_id": null,
    "container_type": "40HC",
    "applies_scope": "origin",
    "valid_from": "2025-10-28",
    "valid_to": "2026-10-28",
    "is_active": true,
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Location Lookup Logic**:
- If `applies_scope` is `"origin"` or `"port"` → `pol_code` is required, creates `pol_id`
- If `applies_scope` is `"dest"` or `"door"` → `pod_code` is required, creates `pod_id`
- If `applies_scope` is `"freight"` or `"other"` → no location lookup needed

**Example**:
```bash
curl -X POST http://13.204.127.113:3000/api/surcharges \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 5,
    "charge_code": "THC",
    "amount": 100,
    "currency": "USD",
    "uom": "per_cntr",
    "applies_scope": "origin",
    "pol_code": "INNSA",
    "container_type": "40HC",
    "valid_from": "2025-10-28",
    "valid_to": "2026-10-28"
  }'
```

---

#### Update Surcharge

**Endpoint**: `PUT /api/surcharges/:surchargeId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Update an existing surcharge (updatable fields only).

**Path Parameters**:
- `surchargeId` (integer, required): The ID of the surcharge to update

**Request Body** (all fields optional):
```json
{
  "amount": 120,                    // Optional: Updated charge amount
  "currency": "EUR",                // Optional: Updated currency
  "uom": "per_bl",                  // Optional: Updated unit of measure
  "valid_from": "2025-11-01",       // Optional: Updated validity start
  "valid_to": "2026-11-01"          // Optional: Updated validity end
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 456,
    "vendor_id": 5,
    "contract_id": 4,
    "charge_code": "THC",
    "amount": 120,
    "currency": "EUR",
    "uom": "per_bl",
    "calc_method": "flat",
    "pol_id": 45,
    "container_type": "40HC",
    "applies_scope": "origin",
    "valid_from": "2025-11-01",
    "valid_to": "2026-11-01",
    "is_active": true,
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

---

#### Get Surcharge by ID

**Endpoint**: `GET /api/surcharges/:surchargeId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Retrieve a single surcharge by ID.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 456,
    "vendor_id": 5,
    "contract_id": 4,
    "charge_code": "THC",
    "amount": 100,
    "currency": "USD",
    "uom": "per_cntr",
    "calc_method": "flat",
    "pol_id": 45,
    "container_type": "40HC",
    "applies_scope": "origin",
    "valid_from": "2025-10-28",
    "valid_to": "2026-10-28",
    "is_active": true,
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

---

#### List Surcharges

**Endpoint**: `GET /api/surcharges`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: List surcharges with optional filtering and pagination.

**Query Parameters** (all optional):
- `vendor_id` (integer): Filter by vendor ID
- `charge_code` (string): Filter by charge code
- `container_type` (string): Filter by container type
- `applies_scope` (string): Filter by applies scope
- `page` (integer): Page number (default: 1)
- `limit` (integer): Results per page (default: 50)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "vendor_id": 5,
      "charge_code": "THC",
      "amount": 100,
      "currency": "USD",
      "uom": "per_cntr",
      "applies_scope": "origin",
      "container_type": "40HC",
      "valid_from": "2025-10-28",
      "valid_to": "2026-10-28",
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "count": 1
  }
}
```

---

#### Delete Surcharge

**Endpoint**: `DELETE /api/surcharges/:surchargeId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Delete a surcharge permanently.

**Response**:
```json
{
  "success": true,
  "message": "Surcharge 456 deleted successfully"
}
```

---

### Margin Rule CRUD APIs

#### Create Margin Rule

**Endpoint**: `POST /api/margin-rules`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Create a new margin rule with support for global, port-pair, or trade zone scopes.

**Headers**:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "level": "port-pair",             // Required: Rule level (global, port-pair, trade-zone)
  "pol_code": "INNSA",              // Optional: Port of Loading code (for port-pair rules)
  "pod_code": "USLSA",              // Optional: Port of Discharge code (for port-pair rules)
  "tz_o": "ASIA",                   // Optional: Origin trade zone code
  "tz_d": "NORTH_AMERICA",          // Optional: Destination trade zone code
  "mode": "FCL",                    // Optional: Mode (FCL, LCL)
  "container_type": "40HC",         // Optional: Container type filter
  "component_type": "freight",      // Optional: Component type
  "mark_kind": "pct",               // Required: Margin type ("pct" or "flat")
  "mark_value": 15,                 // Required: Margin value (15 for 15% or 500 for $500)
  "valid_from": "2025-10-28",       // Optional: Validity start (default: today)
  "valid_to": "2026-10-28",         // Optional: Validity end (default: 2099-12-31)
  "priority": 100                   // Optional: Priority (default: 100, higher = applied first)
}
```

**Valid Values**:
- `level`: `"global"`, `"port-pair"`, `"trade-zone"`
- `mark_kind`: `"pct"` (percentage), `"flat"` (fixed amount)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 789,
    "level": "port-pair",
    "pol_id": 45,
    "pod_id": 78,
    "tz_o": null,
    "tz_d": null,
    "mode": "FCL",
    "container_type": "40HC",
    "component_type": "freight",
    "mark_kind": "pct",
    "mark_value": 15,
    "valid_from": "2025-10-28",
    "valid_to": "2026-10-28",
    "priority": 100,
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**Example - Global Rule**:
```bash
curl -X POST http://13.204.127.113:3000/api/margin-rules \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "global",
    "mark_kind": "pct",
    "mark_value": 10
  }'
```

**Example - Port-Pair Rule**:
```bash
curl -X POST http://13.204.127.113:3000/api/margin-rules \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "port-pair",
    "pol_code": "INNSA",
    "pod_code": "USLSA",
    "mark_kind": "pct",
    "mark_value": 15,
    "container_type": "40HC"
  }'
```

---

#### Update Margin Rule

**Endpoint**: `PUT /api/margin-rules/:ruleId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Update an existing margin rule.

**Request Body** (all fields optional):
```json
{
  "mark_value": 20,                 // Optional: Updated margin value
  "priority": 150,                  // Optional: Updated priority
  "valid_from": "2025-11-01",       // Optional: Updated validity start
  "valid_to": "2026-11-01",         // Optional: Updated validity end
  "is_active": false                // Optional: Deactivate rule
}
```

---

#### Get Margin Rule by ID

**Endpoint**: `GET /api/margin-rules/:ruleId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Retrieve a single margin rule by ID.

---

#### List Margin Rules

**Endpoint**: `GET /api/margin-rules`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: List margin rules with optional filtering.

**Query Parameters** (all optional):
- `level` (string): Filter by rule level
- `mark_kind` (string): Filter by margin type ("pct" or "flat")
- `pol_code` (string): Filter by POL code
- `pod_code` (string): Filter by POD code
- `page` (integer): Page number (default: 1)
- `limit` (integer): Results per page (default: 50)

---

#### Delete Margin Rule

**Endpoint**: `DELETE /api/margin-rules/:ruleId`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Delete a margin rule permanently.

---

## V4 API Endpoints

### Overview

V4 APIs introduce new field names (`origin`/`destination` instead of `pol_code`/`pod_code`), automatic inland haulage detection, and Maersk schedule integration for earliest departure information.

**Key Features:**
- ✅ New field names: `origin`/`destination` (instead of `pol_code`/`pod_code`)
- ✅ Automatic inland port detection (ICD)
- ✅ Automatic inland haulage calculation (IHE/IHI)
- ✅ Optional earliest departure from Maersk schedules
- ✅ Cargo readiness filtering for rates and schedules
- ✅ Database migration support for origin/destination columns
- ✅ Backward compatible (V1/V2/V3 unchanged)

---

### V4 Search Rates

**Endpoint**: `POST /api/v4/search-rates`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Search for ocean freight rates using new field names with automatic inland haulage detection and optional schedule information.

**Request Body**:
```json
{
  "origin": "INNSA",                    // Required: Origin port UN/LOCODE
  "destination": "NLRTM",               // Required: Destination port UN/LOCODE
  "container_type": "40HC",             // Optional: Filter by container type
  "vendor_name": "Maersk",              // Optional: Filter by carrier/vendor
  "cargo_ready_date": "2025-11-18",     // Optional: Cargo ready date (defaults to today)
  "cargo_weight_mt": 10,                 // Required if origin/destination is inland
  "haulage_type": "carrier",            // Required if inland: "carrier" or "merchant"
  "include_earliest_departure": false   // Optional: Include schedule info (default: false)
}
```

**Field Notes:**
- `origin`/`destination`: Use UN/LOCODE (e.g., "INNSA", "NLRTM")
- `cargo_ready_date`: Defaults to current date if omitted. Filters rates (`valid_from` ≤ date ≤ `valid_to`) and schedules (departures on/after date).
- `cargo_weight_mt`: Required when origin or destination is an inland port (ICD)
- `haulage_type`: "carrier" for IHE/IHI charges, "merchant" for no charges
- `include_earliest_departure`: If `true`, includes earliest departure for each carrier

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
      "earliest_departure": {           // Only if include_earliest_departure = true
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
    "generated_at": "2025-11-07T06:37:09.433Z",
    "cargo_ready_date": "2025-11-18"
  }
}
```

**Inland Port Example**:
```json
{
  "origin": "INTKD",                    // Inland port (ICD)
  "destination": "AEJEA",
  "container_type": "40HC",
  "cargo_weight_mt": 10,                // Required for inland
  "haulage_type": "carrier"              // Required for inland
}
```

**Response with Inland Haulage**:
```json
{
  "inland_haulage": {
    "ihe_charges": {
      "found": true,
      "total_amount_usd": 624,
      "charges": [...]
    },
    "ihi_charges": {
      "found": false,
      "message": "Destination is not inland, no IHI needed"
    },
    "total_haulage_usd": 624
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields or invalid parameters
- `400 Bad Request`: Inland port detected but `cargo_weight_mt`/`haulage_type` missing
- **Empty result**: `data: []` with `message: "No rates found for cargo_ready_date …"` when no valid rates exist.
- **No schedules**: `earliest_departure.found = false` with a descriptive `message` when no sailings are available on or after the cargo readiness date.

---

### V4 Prepare Quote

**Endpoint**: `POST /api/v4/prepare-quote`  
**Authentication**: Required (JWT + Tenant ID)

**Description**: Generate a complete quote for a specific rate with automatic inland haulage and optional schedule information. Uses `rate_id` (like V2) instead of auto-selecting preferred rate.

**Request Body**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",  // Required: Salesforce Org ID
  "rate_id": 74,                           // Required: Rate ID from search-rates
  "container_count": 1,                    // Optional: Number of containers (default: 1, max: 10)
  "cargo_ready_date": "2025-11-18",        // Optional: Defaults to today. Must fall within rate validity.
  "cargo_weight_mt": 10,                   // Required if origin/destination is inland
  "haulage_type": "carrier",                // Required if inland: "carrier" or "merchant"
  "include_earliest_departure": true        // Optional: Include schedule info (default: true)
}
```

**Field Notes:**
- `rate_id`: Get from `POST /api/v4/search-rates` response
- `cargo_ready_date`: Defaults to current date. The chosen rate must be valid for this date; the quote also filters sailings to departures on/after the date.
- `cargo_weight_mt`: Required when origin or destination is an inland port (ICD)
- `haulage_type`: "carrier" for IHE/IHI charges, "merchant" for no charges
- `include_earliest_departure`: If `true`, includes earliest departure for the rate's carrier

**Response**:
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 74,
    "route": {
      "origin": "INNSA",                  // ✅ NEW field name
      "destination": "NLRTM",             // ✅ NEW field name
      "origin_name": "Nhava Sheva (INNSA)", // ✅ NEW field
      "destination_name": "Rotterdam (NLRTM)", // ✅ NEW field
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
        "is_preferred": false,
        "rate_id": 74
      },
      "origin_charges": {
        "charges": [...],
        "total_local": 139.76,
        "total_usd": 139.76,
        "count": 4
      },
      "destination_charges": {
        "charges": [...],
        "total_local": 420,
        "total_usd": 420,
        "count": 4
      },
      "other_charges": {
        "charges": [],
        "total_local": 0,
        "total_usd": 0,
        "count": 0
      }
    },
    "totals": {
      "ocean_freight_total": 2530,
      "origin_total_local": 139.76,
      "origin_total_usd": 139.76,
      "destination_total_local": 420,
      "destination_total_usd": 420,
      "other_total_local": 0,
      "other_total_usd": 0,
      "inland_haulage_total_usd": 0,      // ✅ NEW: Inland haulage total
      "grand_total_usd": 3089.76,
      "currency": "USD",
      "fx_rates": {...},
      "currencies_used": [...]
    },
    "inland_haulage": {                    // ✅ NEW: Always included
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
    "earliest_departure": {                // ✅ NEW: If include_earliest_departure = true
      "found": true,
      "carrier": "MAERSK",
      "etd": "2025-11-06T21:12:00+05:30",
      "planned_departure": "2025-11-06T21:12:00+05:30",
      "estimated_departure": "2025-11-06T21:12:00+05:30",
      "carrier_service_code": "471",
      "carrier_voyage_number": "544W",
      "vessel_name": "ALULA EXPRESS",
      "vessel_imo": "9667162",
      "transit_time_days": 34.4
    },
    "upcoming_departures": [               // ✅ NEW: Next sailings (up to 4)
      {
        "carrier": "MAERSK",
        "etd": "2025-11-13T17:00:00+05:30",
        "carrier_voyage_number": "545W",
        "vessel_name": "AL RIFFA",
        "transit_time_days": 34.6
      },
      {
        "carrier": "MAERSK",
        "etd": "2025-11-20T22:00:00+05:30",
        "carrier_voyage_number": "546W",
        "vessel_name": "ATLANTA EXPRESS",
        "transit_time_days": 34.5
      }
    ],
    "quote_summary": {
      "route_display": "Nhava Sheva (INNSA) → Rotterdam (NLRTM)",
      "container_info": "1x 40HC",
      "total_charges_breakdown": {
        "ocean_freight_usd": 2530,
        "local_charges_usd": 559.76,
        "inland_haulage_usd": 0
      },
      "vendor_info": {
        "carrier": "Maersk",
        "transit_days": 20
      }
    },
    "metadata": {
      "generated_at": "2025-11-07T06:37:09.433Z",
      "origin": "INNSA",
      "destination": "NLRTM",
      "container_type": "40HC",
      "cargo_ready_date": "2025-11-18"
    }
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing `salesforce_org_id` or `rate_id`
- `400 Bad Request`: Invalid `container_count` (must be 1-10)
- `400 Bad Request`: Inland port detected but `cargo_weight_mt`/`haulage_type` missing
- `400 Bad Request`: Rate is not valid for the supplied `cargo_ready_date`
- `404 Not Found`: Rate not found for provided `rate_id`

---

### V4 API Differences from V1/V2/V3

| Feature | V1/V2/V3 | V4 |
|---------|----------|-----|
| **Field Names** | `pol_code`, `pod_code` | `origin`, `destination` |
| **Rate Selection** | Auto-select preferred (V1/V3) or by `rate_id` (V2) | By `rate_id` only |
| **Inland Detection** | Manual (separate API call) | Automatic |
| **Inland Haulage** | Separate endpoint (`/api/v3/get-inland-haulage`) | Included automatically |
| **Earliest Departure** | Not available | Optional (Maersk schedules) |
| **Cargo Readiness Date** | Not supported | Filters rates/schedules based on `cargo_ready_date` |
| **Local Charges** | Same logic | Same logic (fixed to match V2) |

---

## Changelog

### Version 4.0.0 (2025-01-07)
- **NEW**: V4 API endpoints with `origin`/`destination` field names
- **NEW**: `POST /api/v4/search-rates` - Enhanced search with automatic inland detection
- **NEW**: `POST /api/v4/prepare-quote` - Rate-specific quotes with inland haulage
- **NEW**: Automatic inland port detection (ICD)
- **NEW**: Automatic inland haulage calculation (IHE/IHI)
- **NEW**: Maersk point-to-point API integration for earliest departure
- **NEW**: `cargo_ready_date` filtering for rates and schedules
- **NEW**: Prepare-quote returns next four sailings (when schedules available)
- **NEW**: Database migration for `origin_code`/`destination_code` columns
- **ENHANCED**: Transit time calculation from schedule dates (more accurate)
- **FIXED**: Local charges calculation to match V2 behavior
- **FIXED**: Added `applies_scope` filters for origin/destination charges
- **FIXED**: Added "Other Charges" query and processing
- **FEATURE**: Maersk API fallback when database transit time is incorrect
- **COMPATIBLE**: V1/V2/V3 APIs remain unchanged

### Version 3.0.0 (2025-10-28)
- **NEW**: Ocean Freight Rate CRUD APIs (POST, PUT, GET, DELETE)
- **NEW**: Surcharge CRUD APIs (POST, PUT, GET, DELETE)
- **NEW**: Margin Rule CRUD APIs (POST, PUT, GET, DELETE)
- **ENHANCED**: Automatic location lookup by UN/LOCODE for all CRUD operations
- **ENHANCED**: Comprehensive validation and error handling for CRUD endpoints
- **FEATURE**: Pagination support for list endpoints
- **FEATURE**: Flexible filtering options for list queries

### Version 2.0.0 (2025-10-15)
- **NEW**: V2 API endpoints for Salesforce integration
- **NEW**: `POST /api/v2/search-rates` - Enhanced rate search with Salesforce Org ID
- **NEW**: `POST /api/v2/prepare-quote` - Rate-specific quote generation
- **FIXED**: FX rate calculation (multiply instead of divide for currency conversion)
- **ENHANCED**: Container count validation (1-10 range)
- **IMPROVED**: Error handling and validation for V2 endpoints
- **COMPATIBLE**: V2 responses match V1 structure for seamless integration

### Version 1.0.0 (2025-10-13)
- Initial release with three endpoints
- FX conversion with fallback rates
- Charge deduplication by charge_code
- Support for both single-port and route queries
- Rounded USD amounts to 2 decimal places

---

## Contact & Support

For issues, feature requests, or questions:
- Check server logs for detailed error messages
- Verify Supabase connection and credentials
- Ensure all required views and tables exist in database

---

*Generated for RMS MCP Server - n8n Integration*

