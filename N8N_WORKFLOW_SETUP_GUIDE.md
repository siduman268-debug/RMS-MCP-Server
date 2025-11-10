# N8N Workflow Setup Guide

Complete guide for setting up and managing N8N workflows for schedule synchronization.

## Overview

N8N workflows automate the synchronization of vessel schedule data from carrier APIs (Maersk) into the RMS database. Each carrier has its own workflow.

---

## Prerequisites

1. **N8N Installed** (self-hosted or cloud)
2. **API Credentials:**
   - Maersk Consumer Key
   - Maersk API Secret
3. **Backend API Access:**
   - RMS API URL (e.g., `http://<vm-ip>:3000`)
   - API Key (if configured)

---

## Maersk Schedule Sync Workflow

### Workflow Structure

```
Set Parameters → Get Port Schedules → Extract Service Codes → 
Fetch Vessel Schedules → Normalize to DCSA → Save to Supabase
```

### Node-by-Node Setup

#### 1. Set Parameters (Code Node)

**Purpose:** Generate date ranges and port combinations for API calls.

**Code:** Use `n8n-set-parameters-maersk-indian-ports.js`

**Output:** Array of items with:
- `fromDate` - Start date (ISO format)
- `toDate` - End date (ISO format)
- `location` - Port UNLOCODE (e.g., 'INMUN', 'INNSA')

**Configuration:**
- Set date range (e.g., 210 days ahead)
- List of ports to sync
- Weekly intervals for date generation

**Example Output:**
```json
[
  {
    "fromDate": "2025-11-06",
    "toDate": "2025-11-13",
    "location": "INMUN"
  },
  {
    "fromDate": "2025-11-06",
    "toDate": "2025-11-13",
    "location": "INNSA"
  }
]
```

#### 2. Get Port Schedules (Code Node)

**Purpose:** Call Maersk Port Schedules API for each date/port combination.

**Code:** Use `n8n-get-port-schedules-code-node.js`

**API Endpoint:** `https://api.maersk.com/dcsa/v2/port-schedules`

**Authentication:**
- Header: `Consumer-Key: {{ $env.MAERSK_CONSUMER_KEY }}`
- Header: `Consumer-Secret: {{ $env.MAERSK_API_SECRET }}`

**Query Parameters:**
- `location` - Port UNLOCODE
- `fromDate` - Start date
- `toDate` - End date

**Output:** Port schedule responses with service codes

**Important:** Uses Code node (not HTTP Request) to ensure all items are processed.

#### 3. Extract Service Codes (Code Node)

**Purpose:** Aggregate unique service codes from all port schedule responses.

**Code:** Use `n8n-extract-service-codes-correct.js`

**Input:** All items from "Get Port Schedules" (`$input.all()`)

**Processing:**
- Parse nested API response structure
- Extract unique service codes
- Preserve `fromDate` and `toDate` for vessel schedule calls

**Output:** Unique service codes with date ranges

**Example Output:**
```json
[
  {
    "serviceCode": "471",
    "fromDate": "2025-11-06",
    "toDate": "2025-11-13"
  },
  {
    "serviceCode": "600",
    "fromDate": "2025-11-06",
    "toDate": "2025-11-13"
  }
]
```

#### 4. Fetch Vessel Schedules (Code Node)

**Purpose:** Call Maersk Vessel Schedules API for each service code.

**Code:** Use `n8n-fetch-vessel-schedules-working.js`

**API Endpoint:** `https://api.maersk.com/dcsa/v2/vessel-schedules`

**Authentication:**
- Header: `Consumer-Key: {{ $env.MAERSK_CONSUMER_KEY }}`
- Header: `Consumer-Secret: {{ $env.MAERSK_API_SECRET }}`

**Query Parameters:**
- `carrierServiceCode` - Service code (e.g., '471')
- `fromDate` - Start date
- `toDate` - End date

**Output:** Vessel schedule responses

**Important:** Uses Code node to ensure all service codes are processed individually.

#### 5. Normalize to DCSA (Code Node)

**Purpose:** Transform Maersk API response to DCSA-compatible format.

**Code:** Use `n8n-normalize-dcsa-code.js`

**Input:** All items from "Fetch Vessel Schedules" (`$input.all()`)

**Transformations:**
- Extract vessel information (IMO, name)
- Extract port calls with sequence numbers
- Map timestamps:
  - `ARRI` → `ARRIVAL`
  - `DEPA` → `DEPARTURE`
  - `PLN` → `PLANNED`
  - `EST` → `ESTIMATED`
  - `ACT` → `ACTUAL`
- Handle alternative timestamp formats
- Extract facility information (SMDG codes)

**Output:** Normalized schedule objects

**Example Output:**
```json
{
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
      "carrierExportVoyageNumber": "544W",
      "times": {
        "plannedArrival": "2025-10-05T10:00:00+05:30",
        "plannedDeparture": "2025-10-06T02:00:00+05:30"
      }
    }
  ]
}
```

#### 6. Save to Supabase (HTTP Request Node)

**Purpose:** Send normalized data to backend API for database insertion.

**Method:** `POST`

**URL:** `http://<vm-ip>:3000/api/dcsa/webhook`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <api-key>` (if configured)

**Body:**
```json
{
  "schedule": {{ $json }}
}
```

**Response Handling:**
- Success: Continue to next item
- Error: Log and continue (don't fail entire workflow)

---

## Environment Variables

Set these in N8N's environment variables or workflow settings:

```bash
MAERSK_CONSUMER_KEY=your_consumer_key_here
MAERSK_API_SECRET=your_api_secret_here
RMS_API_URL=http://<vm-ip>:3000
RMS_API_KEY=your_api_key_here  # Optional
```

---

## Workflow Scheduling

### Recommended Schedule

**Port Schedules Sync:**
- Frequency: Weekly
- Day: Monday
- Time: 02:00 AM UTC
- Purpose: Get latest service codes

**Vessel Schedules Sync:**
- Frequency: Daily
- Time: 03:00 AM UTC
- Purpose: Get latest voyage and port call data

### Setting Up Cron

In N8N workflow settings:
- **Trigger:** Cron
- **Expression:** `0 3 * * *` (daily at 3 AM)
- Or: `0 2 * * 1` (weekly on Monday at 2 AM)

---

## Error Handling

### Common Errors and Solutions

#### 1. "Only processing first item"

**Problem:** HTTP Request node only processes first input item.

**Solution:** Use Code node with manual iteration:
```javascript
const items = $input.all();
const results = [];

for (const item of items) {
  // Process each item
  const result = await makeApiCall(item.json);
  results.push({ json: result });
}

return results;
```

#### 2. "URL is not defined"

**Problem:** Using `URL` class in Code node (not available).

**Solution:** Use `encodeURIComponent`:
```javascript
const url = `https://api.example.com?param=${encodeURIComponent(value)}`;
```

#### 3. "$http is not defined"

**Problem:** Using `$http` in Code node (not available).

**Solution:** Use `this.helpers.request`:
```javascript
const response = await this.helpers.request({
  method: 'GET',
  url: url,
  headers: headers
});
```

#### 4. "Duplicate key error"

**Problem:** Backend returns duplicate key error.

**Solution:** Already handled in backend - workflow should continue. If persists, check:
- Carrier name normalization
- Unique constraints in database

#### 5. "UNLOCODE not found"

**Problem:** Port UNLOCODE not in locations table.

**Solution:** Add missing ports to `locations` table:
```sql
INSERT INTO locations (unlocode, location_name, country_code, location_type)
VALUES ('XXXXX', 'Port Name', 'XX', 'SEAPORT');
```

---

## Monitoring

### Check Workflow Execution

1. **N8N Dashboard:**
   - View execution history
   - Check success/failure rates
   - Review execution logs

2. **Backend Logs:**
   ```bash
   docker-compose logs --tail=500 | grep -i "port call\|error"
   ```

3. **Database Queries:**
   ```sql
   -- Check recent syncs
   SELECT 
       carrier_name,
       carrier_service_code,
       COUNT(*) as voyage_count,
       MAX(created_at) as latest_sync
   FROM public.voyage
   WHERE created_at >= NOW() - INTERVAL '24 hours'
   GROUP BY carrier_name, carrier_service_code;
   ```

### Success Indicators

- ✅ All workflow nodes show green (success)
- ✅ No error messages in execution logs
- ✅ Database has recent voyage records
- ✅ Port call times are being inserted

---

## Adding New Ports

### Update Set Parameters Node

Edit `n8n-set-parameters-maersk-indian-ports.js`:

```javascript
const ports = [
  'INMUN',  // Mundra
  'INNSA',  // Nhava Sheva
  'INCCU',  // Kolkata (add new port)
  // ... more ports
];
```

### Verify Ports in Database

```sql
SELECT unlocode, location_name, country
FROM locations
WHERE location_type = 'SEAPORT'
  AND country = 'India'
ORDER BY unlocode;
```

---

## Adding New Carriers

### 1. Create New Workflow

- Duplicate Maersk workflow
- Rename to new carrier (e.g., "MSC Schedule Sync")

### 2. Update API Endpoints

- Change API base URL
- Update authentication headers
- Adjust response parsing if needed

### 3. Update Normalization Code

- Adapt to carrier's API response format
- Map carrier-specific fields to DCSA format

### 4. Test Workflow

- Run manually first
- Verify data in database
- Check for errors

---

## Best Practices

1. **One Workflow Per Carrier**
   - Easier to manage and debug
   - Independent scheduling
   - Carrier-specific configurations

2. **Use Code Nodes for API Calls**
   - Ensures all items are processed
   - Better error handling
   - More control over requests

3. **Handle Errors Gracefully**
   - Don't fail entire workflow on single item error
   - Log errors for review
   - Continue processing remaining items

4. **Monitor Regularly**
   - Check execution logs daily
   - Review error rates
   - Verify data completeness

5. **Keep Code Updated**
   - Store code in version control
   - Document changes
   - Test before deploying

---

## Troubleshooting Checklist

- [ ] Check N8N workflow execution status
- [ ] Verify API credentials are correct
- [ ] Check backend API is accessible
- [ ] Review backend logs for errors
- [ ] Verify database has recent data
- [ ] Check for missing UNLOCODEs
- [ ] Verify port call times are inserting
- [ ] Check for duplicate key errors
- [ ] Review n8n execution logs
- [ ] Test API endpoints manually

---

## Code Files Reference

All code files are stored in the repository root:

- `n8n-set-parameters-maersk-indian-ports.js` - Parameter generation
- `n8n-get-port-schedules-code-node.js` - Port schedules API calls
- `n8n-extract-service-codes-correct.js` - Service code extraction
- `n8n-fetch-vessel-schedules-working.js` - Vessel schedules API calls
- `n8n-normalize-dcsa-code.js` - DCSA normalization

---

**Last Updated:** 2025-11-06




