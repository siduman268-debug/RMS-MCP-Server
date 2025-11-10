# Schedule API Quick Reference

Quick reference guide for the Schedule Management APIs.

## Base URL
```
http://<vm-ip>:3000/api/customer/schedules
```

---

## 1. Get Next Sailings

Get the next N sailings for a service from a specific port.

### Request
```http
GET /api/customer/schedules/next-sailings?service_code=471&port_unlocode=INMUN&limit=4
```

### Parameters
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `service_code` | string | Yes | Carrier service code | `471` (ME1) |
| `port_unlocode` | string | Yes | Origin port UNLOCODE | `INMUN` |
| `limit` | integer | No | Number of sailings (default: 4) | `10` |
| `carrier` | string | No | Filter by carrier name | `MAERSK` |

### Response
```json
{
  "service_code": "471",
  "service_name": "ME1",
  "port_unlocode": "INMUN",
  "port_name": "Mundra",
  "sailings": [
    {
      "voyage_number": "544W",
      "vessel_name": "ALULA EXPRESS",
      "vessel_imo": "9525883",
      "departure_time": "2025-11-10T10:00:00Z",
      "departure_time_type": "PLANNED",
      "estimated_departure": "2025-11-10T12:00:00Z"
    }
  ]
}
```

### Example: cURL
```bash
curl "http://localhost:3000/api/customer/schedules/next-sailings?service_code=471&port_unlocode=INMUN&limit=4"
```

### Example: JavaScript
```javascript
const response = await fetch(
  'http://localhost:3000/api/customer/schedules/next-sailings?service_code=471&port_unlocode=INMUN&limit=4'
);
const data = await response.json();
console.log(data.sailings);
```

---

## 2. Search Port-to-Port Routes

Find routes between two ports with transit times.

### Request
```http
GET /api/customer/schedules/routes?origin=INNSA&destination=NLRTM&limit=5&route_type=all
```

### Parameters
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `origin` | string | Yes | Origin port UNLOCODE | `INNSA` |
| `destination` | string | Yes | Destination port UNLOCODE | `NLRTM` |
| `limit` | integer | No | Number of routes (default: 10) | `5` |
| `route_type` | string | No | Filter: `all`, `direct_only`, `transshipment_only` | `all` |
| `carrier` | string | No | Filter by carrier name | `MAERSK` |

### Response

**Direct Route:**
```json
{
  "origin": "INNSA",
  "destination": "NLRTM",
  "routes": [
    {
      "route_type": "direct",
      "carrier": "MAERSK",
      "service_code": "471",
      "service_name": "ME1",
      "voyage_number": "544W",
      "vessel_name": "ALULA EXPRESS",
      "departure_time": "2025-11-10T10:00:00Z",
      "arrival_time": "2025-11-25T14:00:00Z",
      "transit_time_days": 15.2,
      "port_calls": [
        {
          "unlocode": "INNSA",
          "port_name": "Nhava Sheva",
          "sequence": 3,
          "departure_time": "2025-11-10T10:00:00Z"
        },
        {
          "unlocode": "NLRTM",
          "port_name": "Rotterdam",
          "sequence": 1,
          "arrival_time": "2025-11-25T14:00:00Z"
        }
      ]
    }
  ]
}
```

**Transshipment Route:**
```json
{
  "route_type": "transshipment",
  "carrier": "MAERSK",
  "service_code": "471",
  "service_name": "ME1",
  "legs": [
    {
      "origin": "INNSA",
      "destination": "OMSLL",
      "voyage_number": "544W",
      "departure_time": "2025-11-10T10:00:00Z",
      "arrival_time": "2025-11-15T08:00:00Z",
      "transit_time_days": 4.9
    },
    {
      "origin": "OMSLL",
      "destination": "NLRTM",
      "voyage_number": "550E",
      "departure_time": "2025-11-20T12:00:00Z",
      "arrival_time": "2025-11-25T14:00:00Z",
      "transit_time_days": 5.1
    }
  ],
  "total_transit_time_days": 10.0,
  "transshipment_port": "OMSLL"
}
```

### Example: cURL
```bash
curl "http://localhost:3000/api/customer/schedules/routes?origin=INNSA&destination=NLRTM&limit=5"
```

### Example: Python
```python
import requests

url = "http://localhost:3000/api/customer/schedules/routes"
params = {
    "origin": "INNSA",
    "destination": "NLRTM",
    "limit": 5,
    "route_type": "all"
}

response = requests.get(url, params=params)
data = response.json()

for route in data["routes"]:
    print(f"{route['route_type']}: {route['transit_time_days']} days")
```

---

## Common UNLOCODEs

### Indian Ports
- `INMUN` - Mundra
- `INNSA` - Nhava Sheva
- `INCCU` - Kolkata
- `INCOK` - Cochin
- `INMAA` - Chennai

### European Ports
- `NLRTM` - Rotterdam
- `DEHAM` - Hamburg
- `GBLGP` - London Gateway
- `BEANR` - Antwerp

### US Ports
- `USNYC` - New York
- `USLGB` - Long Beach
- `USSAV` - Savannah
- `USHOU` - Houston

### Middle East
- `AEJEA` - Jebel Ali
- `OMSLL` - Salalah

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Missing required parameter: service_code"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "No sailings found for service 471 from port INMUN"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Database query failed"
}
```

---

## Rate Limiting

Currently: **No rate limiting** (add for production)

Recommended limits:
- 100 requests/minute per IP
- 1000 requests/hour per IP

---

## Best Practices

1. **Use appropriate limits:** Don't request more data than needed
2. **Cache responses:** Schedule data doesn't change frequently
3. **Handle errors gracefully:** Check response status codes
4. **Use filters:** Filter by carrier/service when possible
5. **Check timestamps:** Verify departure times are in the future

---

## Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### Test Next Sailings
```bash
curl "http://localhost:3000/api/customer/schedules/next-sailings?service_code=471&port_unlocode=INMUN&limit=2"
```

### Test Routes
```bash
curl "http://localhost:3000/api/customer/schedules/routes?origin=INNSA&destination=NLRTM&limit=3"
```

---

**Last Updated:** 2025-11-06




