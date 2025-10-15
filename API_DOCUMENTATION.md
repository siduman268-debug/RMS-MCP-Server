# RMS MCP Server - API Documentation

## Overview
The RMS MCP Server provides RESTful API endpoints for freight rate management, local charges retrieval, and quote generation. Built with Fastify and Supabase, it supports both MCP (Model Context Protocol) for Claude Desktop and HTTP API for n8n workflow automation.

**Base URL**: `http://localhost:3000`  
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
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [FX Conversion](#fx-conversion)

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

**Response**:
```json
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

## Changelog

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

