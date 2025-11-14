# Schedule System Documentation

Complete documentation for the RMS Schedule Management System, including APIs, N8N workflows, and database structure.

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Structure (Supabase)](#database-structure-supabase)
3. [N8N Workflows](#n8n-workflows)
4. [Customer-Facing APIs](#customer-facing-apis)
5. [Internal APIs](#internal-apis)
6. [Data Flow](#data-flow)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

The Schedule Management System syncs vessel schedule data from carrier APIs (Maersk DCSA) into Supabase and exposes it through customer-facing APIs. The system uses:

- **N8N Workflows**: Automate data synchronization from carrier APIs
- **Supabase (PostgreSQL)**: Store schedule data in normalized DCSA-compatible format
- **Fastify API Server**: Expose REST APIs for customers and internal use
- **Database Views**: Pre-built queries for common schedule queries

### Key Features

- ✅ Multi-carrier support (currently Maersk, extensible to others)
- ✅ Port call time tracking (PLANNED, ESTIMATED, ACTUAL)
- ✅ Transit time calculations
- ✅ Point-to-point route queries
- ✅ Transshipment route detection
- ✅ Weekly vessel schedule views
- ✅ Automatic duplicate handling

---

## Database Structure (Supabase)

### Core Tables

#### 1. `carrier`
Stores carrier information.

```sql
CREATE TABLE carrier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,  -- e.g., 'MAERSK'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Notes:**
- Carrier names are normalized to UPPERCASE
- Unique constraint on `name` prevents duplicates

#### 2. `service`
Stores service/route information.

```sql
CREATE TABLE service (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID NOT NULL REFERENCES carrier(id),
    carrier_service_code VARCHAR(50) NOT NULL,  -- e.g., '471' for ME1
    carrier_service_name VARCHAR(255),           -- e.g., 'ME1'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(carrier_id, carrier_service_code)
);
```

#### 3. `vessel`
Stores vessel information.

```sql
CREATE TABLE vessel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imo VARCHAR(20) UNIQUE NOT NULL,  -- IMO number
    name VARCHAR(255) NOT NULL,      -- Vessel name
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. `voyage`
Stores voyage information (a vessel's journey on a service).

```sql
CREATE TABLE voyage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES service(id),
    vessel_id UUID NOT NULL REFERENCES vessel(id),
    carrier_voyage_number VARCHAR(50) NOT NULL,  -- e.g., '544W', '550E'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, carrier_voyage_number)
);
```

**Notes:**
- Voyage numbers often end with 'W' (westbound/export) or 'E' (eastbound/import)
- Same vessel can have multiple voyages on different services

#### 5. `transport_call`
Stores port call information (a voyage's stop at a port).

```sql
CREATE TABLE transport_call (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voyage_id UUID NOT NULL REFERENCES voyage(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    facility_id UUID REFERENCES facility(id),
    sequence_no INTEGER NOT NULL,  -- Port sequence in voyage (1, 2, 3...)
    carrier_import_voyage_number VARCHAR(50),
    carrier_export_voyage_number VARCHAR(50),
    transport_call_reference VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(voyage_id, sequence_no)  -- Prevents duplicate port calls
);
```

**Notes:**
- `sequence_no` determines port order in the voyage
- Unique constraint prevents duplicate port calls for same voyage/sequence

#### 6. `port_call_time`
Stores timestamps for port calls.

```sql
CREATE TABLE port_call_time (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transport_call_id UUID NOT NULL REFERENCES transport_call(id),
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('ARRIVAL', 'DEPARTURE')),
    time_kind event_time_kind NOT NULL,  -- Enum: 'PLANNED', 'ESTIMATED', 'ACTUAL'
    event_datetime TIMESTAMPTZ NOT NULL,
    delay_reason_code VARCHAR(50),
    change_remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transport_call_id, event_type, time_kind)
);
```

**Enum Type:**
```sql
CREATE TYPE event_time_kind AS ENUM ('PLANNED', 'ESTIMATED', 'ACTUAL');
```

**Notes:**
- Each transport call can have up to 6 time records:
  - PLANNED ARRIVAL
  - PLANNED DEPARTURE
  - ESTIMATED ARRIVAL
  - ESTIMATED DEPARTURE
  - ACTUAL ARRIVAL (if voyage completed)
  - ACTUAL DEPARTURE (if voyage completed)
- Unique constraint prevents duplicate time entries

#### 7. `schedule_source_audit`
Audit trail for schedule data.

```sql
CREATE TABLE schedule_source_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_name VARCHAR(255) NOT NULL,
    carrier_service_code VARCHAR(50) NOT NULL,
    carrier_voyage_number VARCHAR(50) NOT NULL,
    raw_payload JSONB NOT NULL,  -- Original API response
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 8. `preferred_service_routes`
Stores preferred services from point-to-point API.

```sql
CREATE TABLE preferred_service_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID NOT NULL REFERENCES carrier(id),
    origin_unlocode VARCHAR(5) NOT NULL,
    destination_unlocode VARCHAR(5) NOT NULL,
    preferred_service_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(carrier_id, origin_unlocode, destination_unlocode)
);
```

### Database Views

#### 1. `v_weekly_vessel_schedule`
Weekly vessel sailing schedule with all timestamps.

**Columns:**
- `sailing_week` - Week start date
- `carrier_name`, `carrier_service_code`, `carrier_service_name`
- `vessel_name`, `vessel_imo`, `carrier_voyage_number`
- `port_sequence`, `unlocode`, `location_name`, `country`
- `planned_arrival`, `planned_departure`
- `estimated_arrival`, `estimated_departure`
- `actual_arrival`, `actual_departure`

**Usage:**
```sql
SELECT * FROM v_weekly_vessel_schedule
WHERE carrier_service_code = '471'  -- ME1
  AND sailing_week >= CURRENT_DATE
ORDER BY sailing_week, carrier_voyage_number, port_sequence;
```

#### 2. `v_voyage_routes_with_transit`
Complete voyage routes with calculated transit times.

**Columns:**
- `voyage_id`, `carrier_name`, `carrier_service_code`
- `origin_unlocode`, `origin_port`, `origin_departure`
- `destination_unlocode`, `destination_port`, `destination_arrival`
- `transit_time_days` - Calculated transit time

**Usage:**
```sql
SELECT * FROM v_voyage_routes_with_transit
WHERE origin_unlocode = 'INNSA'
  AND destination_unlocode = 'NLRTM'
ORDER BY transit_time_days;
```

#### 3. `v_service_weekly_summary`
Aggregated service summary by week.

**Columns:**
- `sailing_week`
- `carrier_name`, `carrier_service_code`, `carrier_service_name`
- `voyage_count`, `vessel_count`, `port_call_count`, `unique_ports`
- `ports_served` - Comma-separated list of UNLOCODEs
- `first_departure`, `last_departure`

#### 4. `v_port_to_port_routes`
Direct port-to-port routes with transit times.

**Columns:**
- `carrier_name`, `carrier_service_code`
- `origin_unlocode`, `origin_port`, `origin_departure`
- `destination_unlocode`, `destination_port`, `destination_arrival`
- `transit_time_days`
- `route` - e.g., 'INNSA → NLRTM'

**Usage:**
```sql
SELECT * FROM v_port_to_port_routes
WHERE origin_unlocode = 'INMUN'
  AND destination_unlocode = 'USNYC'
  AND origin_departure >= CURRENT_DATE
ORDER BY origin_departure
LIMIT 5;
```

### Database Permissions

**Required Permissions:**
```sql
-- Grant USAGE on schedules schema (to avoid permission errors)
GRANT USAGE ON SCHEMA schedules TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

---

## N8N Workflows

### Workflow Architecture

**One workflow per carrier** - This allows:
- Independent scheduling and error handling
- Carrier-specific API configurations
- Easy addition of new carriers

### Maersk Schedule Sync Workflow

**Workflow Name:** `Maersk Schedule Sync`

**Nodes:**

1. **Set Parameters**
   - **Type:** Code Node
   - **Purpose:** Generate date ranges and port combinations
   - **Output:** Array of items with `fromDate`, `toDate`, `location` (UNLOCODE)
   - **Code:** `n8n-set-parameters-maersk-indian-ports.js`

2. **Get Port Schedules**
   - **Type:** Code Node
   - **Purpose:** Call Maersk Port Schedules API for each date/port combination
   - **API Endpoint:** `https://api.maersk.com/dcsa/v2/port-schedules`
   - **Code:** `n8n-get-port-schedules-code-node.js`
   - **Output:** Port schedule responses with service codes

3. **Extract Service Codes**
   - **Type:** Code Node
   - **Purpose:** Aggregate unique service codes from all port schedule responses
   - **Input:** All items from "Get Port Schedules"
   - **Output:** Unique service codes with `fromDate` and `toDate`
   - **Code:** `n8n-extract-service-codes-correct.js`

4. **Fetch Vessel Schedules**
   - **Type:** Code Node
   - **Purpose:** Call Maersk Vessel Schedules API for each service code
   - **API Endpoint:** `https://api.maersk.com/dcsa/v2/vessel-schedules`
   - **Code:** `n8n-fetch-vessel-schedules-working.js`
   - **Output:** Vessel schedule responses

5. **Normalize to DCSA**
   - **Type:** Code Node
   - **Purpose:** Transform Maersk API response to DCSA-compatible format
   - **Input:** All items from "Fetch Vessel Schedules"
   - **Output:** Normalized schedule objects
   - **Code:** `n8n-normalize-dcsa-code.js`
   - **Key Transformations:**
     - Extract vessel information
     - Extract port calls with timestamps
     - Map event types (ARRI → ARRIVAL, DEPA → DEPARTURE)
     - Map event classifiers (PLN → PLANNED, EST → ESTIMATED, ACT → ACTUAL)

6. **Save to Supabase**
   - **Type:** HTTP Request Node
   - **Method:** POST
   - **URL:** `http://<vm-ip>:3000/api/dcsa/webhook`
   - **Headers:**
     - `Content-Type: application/json`
     - `Authorization: Bearer <api-key>` (if configured)
   - **Body:**
     ```json
     {
       "schedule": {{ $json }}
     }
     ```

### Maersk Point-to-Point Workflow

**Workflow Name:** `Maersk Point-to-Point Sync`

**Purpose:** Sync preferred services from Maersk's point-to-point API

**Nodes:**

1. **Set Parameters**
   - Generate POL/POD combinations
   - **Code:** `n8n-set-parameters-point-to-point.js`

2. **Call Point-to-Point API**
   - **API Endpoint:** `https://api.maersk.com/dcsa/v2/point-to-point`
   - **Code:** `n8n-call-point-to-point-api.js`

3. **Extract Preferred Services**
   - Parse API response and extract preferred services
   - **Code:** `n8n-extract-preferred-services.js`

4. **Save to Database**
   - Save to `preferred_service_routes` table

### Workflow Configuration

**Environment Variables (n8n):**
- `MAERSK_CONSUMER_KEY` - Maersk API consumer key
- `MAERSK_API_SECRET` - Maersk API secret
- `RMS_API_URL` - Backend API URL (e.g., `http://<vm-ip>:3000`)
- `RMS_API_KEY` - Backend API key (if configured)

**Scheduling:**
- Port schedules sync: Weekly (every Monday)
- Vessel schedules sync: Daily
- Point-to-point sync: Monthly

**Error Handling:**
- Workflows continue on individual item errors
- Failed items are logged for manual review
- Duplicate key errors are handled gracefully by backend

---

## Customer-Facing APIs

### Base URL
```
http://<vm-ip>:3000/api/customer/schedules
```

### Authentication
Currently open (no authentication required). Add JWT authentication for production.

### 1. Get Next Sailings

**Endpoint:** `GET /api/customer/schedules/next-sailings`

**Description:** Get the next N sailings for a service from a specific port.

**Query Parameters:**
- `service_code` (required) - Carrier service code (e.g., '471' for ME1)
- `port_unlocode` (required) - Origin port UNLOCODE (e.g., 'INMUN')
- `limit` (optional) - Number of sailings to return (default: 4)
- `carrier` (optional) - Carrier name filter (e.g., 'MAERSK')

**Example Request:**
```bash
GET /api/customer/schedules/next-sailings?service_code=471&port_unlocode=INMUN&limit=4
```

**Example Response:**
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

### 2. Search Port-to-Port Routes

**Endpoint:** `GET /api/customer/schedules/routes`

**Description:** Find routes between two ports with transit times.

**Query Parameters:**
- `origin` (required) - Origin port UNLOCODE
- `destination` (required) - Destination port UNLOCODE
- `limit` (optional) - Number of routes to return (default: 10)
- `route_type` (optional) - Filter by route type: `all`, `direct_only`, `transshipment_only` (default: `all`)
- `carrier` (optional) - Carrier name filter

**Example Request:**
```bash
GET /api/customer/schedules/routes?origin=INNSA&destination=NLRTM&limit=5&route_type=all
```

**Example Response:**
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
    },
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
  ]
}
```

**Transshipment Logic:**
- Routes are connected by same vessel and same base voyage number (without W/E suffix)
- Example: Voyage 544W connects to 550E if same vessel and base number 544/550

### 3. Get Service Schedule (Future)

**Endpoint:** `GET /api/customer/schedules/service/:service_code`

**Description:** Get complete schedule for a service.

**Status:** Not yet implemented

### 4. Track Vessel (Future)

**Endpoint:** `GET /api/customer/schedules/vessel/:vessel_imo`

**Description:** Get current location and schedule for a vessel.

**Status:** Not yet implemented

---

## Internal APIs

### 1. DCSA Webhook

**Endpoint:** `POST /api/dcsa/webhook`

**Description:** Receive normalized DCSA schedule data from n8n workflows.

**Authentication:** None (internal use only)

**Request Body:**
```json
{
  "schedule": {
    "carrierName": "MAERSK",
    "carrierServiceCode": "471",
    "carrierServiceName": "ME1",
    "carrierVoyageNumber": "544W",
    "vesselIMO": "9525883",
    "vesselName": "ALULA EXPRESS",
    "portCalls": [
      {
        "unlocode": "INMUN",
        "sequence": 2,
        "facilitySMDG": "ACMTPL",
        "facilityName": "Adani CMA Mundra container terminal",
        "carrierExportVoyageNumber": "544W",
        "transportCallReference": "15773055",
        "times": {
          "plannedArrival": "2025-10-05T10:00:00+05:30",
          "plannedDeparture": "2025-10-06T02:00:00+05:30",
          "estimatedArrival": "2025-10-05T10:00:00+05:30",
          "estimatedDeparture": "2025-10-06T19:49:00+05:30",
          "actualArrival": "2025-10-06T03:49:00+05:30",
          "actualDeparture": "2025-10-06T18:28:00+05:30"
        }
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule processed successfully"
}
```

**Error Handling:**
- Duplicate carriers: Normalized to UPPERCASE and merged
- Duplicate services: Updated if exists
- Duplicate transport calls: Updated if exists (handles race conditions)
- Missing locations: Skipped with warning log

---

## Data Flow

### 1. Schedule Sync Flow

```
Maersk API (Port Schedules)
    ↓
N8N: Get Port Schedules
    ↓
N8N: Extract Service Codes
    ↓
Maersk API (Vessel Schedules)
    ↓
N8N: Fetch Vessel Schedules
    ↓
N8N: Normalize to DCSA
    ↓
Backend API: /api/dcsa/webhook
    ↓
ScheduleDatabaseService
    ↓
Supabase Tables:
  - carrier
  - service
  - vessel
  - voyage
  - transport_call
  - port_call_time
  - schedule_source_audit
```

### 2. Customer Query Flow

```
Customer API Request
    ↓
CustomerScheduleRoutes
    ↓
Database Views / Direct Queries
    ↓
Calculate Transit Times
    ↓
Format Response
    ↓
Return to Customer
```

---

## Troubleshooting

### Common Issues

#### 1. Port Call Times Not Inserting

**Symptoms:**
- `[Port Call X] Inserted 0 time record(s)`
- No time records in database

**Solutions:**
- Check schema permissions: Run `fix_public_schema_access.sql`
- Verify times are in n8n payload: Check n8n normalization logs
- Check Docker logs: `docker-compose logs --tail=500 | grep -i "port call"`

#### 2. Duplicate Key Errors

**Symptoms:**
- `duplicate key value violates unique constraint`

**Solutions:**
- Already handled in code - should update existing records
- If persists, check for case sensitivity issues (carrier names)
- Verify unique constraints in database

#### 3. Missing UNLOCODEs

**Symptoms:**
- `UNLOCODE XXXX not found in locations; skipping port call`

**Solutions:**
- Add missing ports to `locations` table
- Verify UNLOCODE format (5 characters, uppercase)
- Check `location_type` is 'SEAPORT'

#### 4. N8N Workflow Only Processing First Item

**Symptoms:**
- Only 1 service processed instead of 10

**Solutions:**
- Use Code nodes instead of HTTP Request nodes for API calls
- Ensure `$input.all()` is used in Code nodes
- Check n8n node settings for "Process All Items"

#### 5. Container Not Updating After Rebuild

**Symptoms:**
- Code changes not reflected after rebuild

**Solutions:**
- Use `docker-compose up -d --build --force-recreate` (not just `restart`)
- Verify container creation time: `docker-compose ps`
- Check logs to confirm new code is running

### Diagnostic Queries

**Check port call time coverage:**
```sql
SELECT 
    time_kind,
    event_type,
    COUNT(*) as record_count
FROM public.port_call_time
GROUP BY time_kind, event_type;
```

**Check recent sync activity:**
```sql
SELECT 
    carrier_name,
    carrier_service_code,
    COUNT(*) as voyage_count,
    MAX(created_at) as latest_sync
FROM public.voyage
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY carrier_name, carrier_service_code;
```

**Find missing locations:**
```sql
SELECT DISTINCT 
    tc.sequence_no,
    l.unlocode
FROM public.transport_call tc
JOIN public.locations l ON l.id = tc.location_id
WHERE l.unlocode NOT IN (
    SELECT unlocode FROM public.locations WHERE location_type = 'SEAPORT'
);
```

---

## Future Enhancements

1. **Additional Carriers**
   - MSC, CMA CGM, Hapag-Lloyd, etc.
   - One n8n workflow per carrier

2. **Real-time Updates**
   - WebSocket support for live schedule updates
   - Push notifications for schedule changes

3. **Advanced Analytics**
   - On-time performance metrics
   - Transit time trends
   - Port congestion analysis

4. **API Enhancements**
   - GraphQL endpoint
   - Bulk queries
   - Schedule comparison tools

5. **Data Quality**
   - Automated data validation
   - Missing data alerts
   - Data completeness reports

---

## Maintenance

### Regular Tasks

1. **Weekly:**
   - Review sync logs for errors
   - Check data completeness
   - Verify new ports are added

2. **Monthly:**
   - Review and clean up old audit records
   - Update carrier API credentials if needed
   - Review and optimize database queries

3. **Quarterly:**
   - Review and update documentation
   - Performance optimization
   - Security audit

### Backup Strategy

- Supabase automatic backups (daily)
- Manual backup before major changes
- Export schedule data for archival

---

## Support Contacts

- **Technical Issues:** Check logs and run diagnostic queries
- **API Questions:** Refer to this documentation
- **Database Issues:** Check Supabase dashboard and logs

---

**Last Updated:** 2025-11-06
**Version:** 1.0.0





