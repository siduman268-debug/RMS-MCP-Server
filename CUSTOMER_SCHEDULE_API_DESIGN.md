# Customer-Facing Schedule API Design

## Overview
APIs for customers to query shipping schedules, vessel movements, and transit times.

## Authentication
- API Key: `x-api-key` header or `Bearer` token
- Environment variable: `API_KEY`

---

## API Endpoints

### 1. Get Next N Sailings from a Port by Service
**Use Case:** "Show me the next 4 sailings on ME1 service from Mundra"

```
GET /api/customer/schedules/next-sailings
```

**Query Parameters:**
- `port_code` (required): UN/LOCODE (e.g., "INMUN")
- `service_code` (required): Carrier service code (e.g., "ME1", "MW1")
- `carrier` (optional): Carrier name (e.g., "MAERSK")
- `limit` (optional): Number of sailings (default: 4, max: 20)
- `from_date` (optional): Start date (ISO 8601, default: today)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "service_code": "ME1",
      "service_name": "MEWA",
      "carrier": "MAERSK",
      "voyage_number": "123E",
      "vessel_name": "MAERSK COLOMBO",
      "vessel_imo": "1234567",
      "port_of_departure": {
        "unlocode": "INMUN",
        "name": "Mundra",
        "planned_departure": "2025-11-15T10:00:00Z",
        "estimated_departure": "2025-11-15T11:00:00Z"
      },
      "port_calls": [
        {
          "sequence": 1,
          "unlocode": "INMUN",
          "name": "Mundra",
          "planned_departure": "2025-11-15T10:00:00Z"
        },
        {
          "sequence": 2,
          "unlocode": "AENJM",
          "name": "Jebel Ali",
          "planned_arrival": "2025-11-22T14:00:00Z"
        }
      ],
      "transit_time_days": 7
    }
  ],
  "count": 4
}
```

---

### 2. Search Port-to-Port Routes with Schedules
**Use Case:** "Find all sailings from Mundra to Jebel Ali in the next 30 days"

```
GET /api/customer/schedules/routes
```

**Query Parameters:**
- `pol_code` (required): Port of Loading UN/LOCODE
- `pod_code` (required): Port of Discharge UN/LOCODE
- `carrier` (optional): Filter by carrier name
- `service_code` (optional): Filter by service code
- `from_date` (optional): Start date (ISO 8601, default: today)
- `to_date` (optional): End date (ISO 8601, default: +90 days)
- `limit` (optional): Max results (default: 50)
- `include_transshipment` (optional): Include transshipment routes (default: "true")
- `route_type` (optional): Filter route type - "all" (default), "direct_only", or "transshipment_only"
- `min_connection_hours` (optional): Minimum connection time at transshipment port (default: 24)
- `same_carrier_only` (optional): Only show same-carrier connections (default: "false")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "route_type": "direct",
      "route_preference": "direct",
      "carrier": "MAERSK",
      "service_code": "ME1",
      "service_name": "MEWA",
      "voyage_number": "123E",
      "vessel_name": "MAERSK COLOMBO",
      "legs": [
        {
          "leg_number": 1,
          "carrier": "MAERSK",
          "service_code": "ME1",
          "service_name": "MEWA",
          "voyage_number": "123E",
          "vessel_name": "MAERSK COLOMBO",
          "pol": {
            "unlocode": "INMUN",
            "name": "Mundra",
            "planned_departure": "2025-11-15T10:00:00Z"
          },
          "pod": {
            "unlocode": "AENJM",
            "name": "Jebel Ali",
            "planned_arrival": "2025-11-22T14:00:00Z"
          }
        }
      ],
      "pol": {
        "unlocode": "INMUN",
        "name": "Mundra",
        "planned_departure": "2025-11-15T10:00:00Z"
      },
      "pod": {
        "unlocode": "AENJM",
        "name": "Jebel Ali",
        "planned_arrival": "2025-11-22T14:00:00Z"
      },
      "transit_time_days": 7,
      "transit_time_hours": 168
    },
    {
      "route_type": "transshipment",
      "route_preference": "transshipment",
      "transshipment_port": {
        "unlocode": "AENJM",
        "name": "Jebel Ali"
      },
      "legs": [
        {
          "leg_number": 1,
          "carrier": "MAERSK",
          "service_code": "ME1",
          "pol": { "unlocode": "INMUN", "planned_departure": "2025-11-20T10:00:00Z" },
          "pod": { "unlocode": "AENJM", "planned_arrival": "2025-11-27T14:00:00Z" }
        },
        {
          "leg_number": 2,
          "carrier": "MAERSK",
          "service_code": "AE1",
          "pol": { "unlocode": "AENJM", "planned_departure": "2025-11-29T10:00:00Z" },
          "pod": { "unlocode": "DEHAM", "planned_arrival": "2025-12-05T14:00:00Z" }
        }
      ],
      "connection_time_hours": 44,
      "total_transit_days": 15
    }
  ],
  "count": 12,
  "summary": {
    "direct_routes": 8,
    "transshipment_routes": 4,
    "filtered_direct": 8,
    "filtered_transshipment": 4,
    "route_type_filter": "all"
  },
  "note": "Both direct and transshipment routes are shown. Carriers may offer transshipment options for capacity, pricing, or service frequency reasons even when direct routes exist."
}
```

**Important Notes:**
- **By default, both direct AND transshipment routes are shown** - even when direct routes exist
- This is intentional because carriers may offer transshipment for:
  - **Capacity**: Direct service might be full
  - **Pricing**: Transshipment might be cheaper
  - **Frequency**: More frequent sailings via hub
  - **Operational**: Cargo consolidation at hub ports
- Use `route_type=direct_only` to see only direct routes
- Use `route_type=transshipment_only` to see only transshipment routes (useful when direct is not available)
- Routes are sorted: Direct routes first, then transshipment routes

---

### 3. Get Service Schedule
**Use Case:** "Show me the complete schedule for ME1 service"

```
GET /api/customer/schedules/service
```

**Query Parameters:**
- `service_code` (required): Carrier service code
- `carrier` (optional): Carrier name (default: "MAERSK")
- `from_date` (optional): Start date
- `to_date` (optional): End date
- `limit` (optional): Max voyages (default: 20)

**Response:**
```json
{
  "success": true,
  "service": {
    "code": "ME1",
    "name": "MEWA",
    "carrier": "MAERSK"
  },
  "voyages": [
    {
      "voyage_number": "123E",
      "vessel_name": "MAERSK COLOMBO",
      "vessel_imo": "1234567",
      "port_calls": [
        {
          "sequence": 1,
          "unlocode": "INMUN",
          "name": "Mundra",
          "planned_departure": "2025-11-15T10:00:00Z"
        },
        {
          "sequence": 2,
          "unlocode": "AENJM",
          "name": "Jebel Ali",
          "planned_arrival": "2025-11-22T14:00:00Z",
          "planned_departure": "2025-11-23T10:00:00Z"
        }
      ]
    }
  ],
  "count": 15
}
```

---

### 4. Get Vessel Schedule
**Use Case:** "Where is vessel MAERSK COLOMBO and what's its schedule?"

```
GET /api/customer/schedules/vessel
```

**Query Parameters:**
- `vessel_imo` (optional): IMO number
- `vessel_name` (optional): Vessel name (partial match)
- `from_date` (optional): Start date
- `to_date` (optional): End date

**Response:**
```json
{
  "success": true,
  "vessel": {
    "name": "MAERSK COLOMBO",
    "imo": "1234567"
  },
  "current_voyage": {
    "service_code": "ME1",
    "voyage_number": "123E",
    "current_port": {
      "unlocode": "INMUN",
      "name": "Mundra",
      "status": "at_port",
      "planned_departure": "2025-11-15T10:00:00Z"
    }
  },
  "upcoming_voyages": [
    {
      "service_code": "ME1",
      "voyage_number": "124E",
      "next_port": {
        "unlocode": "INMUN",
        "name": "Mundra",
        "planned_departure": "2025-11-25T10:00:00Z"
      }
    }
  ]
}
```

---

### 5. Calculate Transit Time
**Use Case:** "How long does it take from Mundra to Jebel Ali on ME1?"

```
GET /api/customer/schedules/transit-time
```

**Query Parameters:**
- `pol_code` (required): Port of Loading
- `pod_code` (required): Port of Discharge
- `service_code` (optional): Specific service
- `carrier` (optional): Carrier name

**Response:**
```json
{
  "success": true,
  "pol": "INMUN",
  "pod": "AENJM",
  "transit_times": [
    {
      "service_code": "ME1",
      "average_days": 7,
      "min_days": 6,
      "max_days": 8,
      "sample_count": 12
    }
  ]
}
```

---

### 6. List Available Services
**Use Case:** "What services are available from Mundra?"

```
GET /api/customer/schedules/available-services
```

**Query Parameters:**
- `pol_code` (optional): Port of Loading
- `pod_code` (optional): Port of Discharge
- `carrier` (optional): Filter by carrier

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "carrier": "MAERSK",
      "service_code": "ME1",
      "service_name": "MEWA",
      "ports_served": ["INMUN", "AENJM", "DEHAM"]
    }
  ],
  "count": 10
}
```

---

## Error Responses

```json
{
  "success": false,
  "error": "Bad Request",
  "message": "port_code is required"
}
```

**Status Codes:**
- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (invalid API key)
- `404`: Not Found (service/port not found)
- `500`: Internal Server Error

---

## Example Usage

### Example 1: Next 4 sailings on ME1 from Mundra
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.yourdomain.com/api/customer/schedules/next-sailings?port_code=INMUN&service_code=ME1&limit=4"
```

### Example 2: Routes from Mundra to Jebel Ali
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.yourdomain.com/api/customer/schedules/routes?pol_code=INMUN&pod_code=AENJM&from_date=2025-11-15"
```

### Example 3: Service schedule
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.yourdomain.com/api/customer/schedules/service?service_code=ME1"
```

