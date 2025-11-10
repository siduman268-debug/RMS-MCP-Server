# n8n Workflow Architecture: One Workflow Per Carrier

## Recommended Architecture

**One n8n workflow per carrier** is the best approach for the following reasons:

### Benefits

1. **Separation of Concerns**
   - Each carrier has different API endpoints, authentication, and data formats
   - Easier to maintain and update carrier-specific logic
   - Changes to one carrier don't affect others

2. **Independent Scheduling**
   - Different carriers may need different sync frequencies
   - Some carriers update schedules daily, others weekly
   - Can run workflows at different times

3. **Independent Execution**
   - If one carrier's API is down, others continue working
   - Failures are isolated
   - Easier to debug carrier-specific issues

4. **Different API Keys**
   - Each carrier has its own Consumer Key/API credentials
   - Easier to manage and rotate keys per carrier
   - Security: if one key is compromised, others are safe

5. **Carrier-Specific Logic**
   - Different carriers may require different data transformations
   - Some may have different response formats
   - Easier to customize per carrier

6. **Scalability**
   - Can add new carriers without modifying existing workflows
   - Can run multiple carriers in parallel
   - Resource allocation per carrier

## Workflow Structure

### Example: Maersk Workflow
```
Workflow Name: "Maersk Schedule Sync"
├── Set Parameters (Maersk-specific ports, dates)
├── Loop Over Items #1
├── Get Port Schedules (Maersk API endpoint)
├── Extract Service Codes
├── Loop Over Items #2
├── Fetch Vessel Schedules (Maersk API)
├── Normalize to DCSA
└── Save to Supabase
```

### Example: MSC Workflow (Future)
```
Workflow Name: "MSC Schedule Sync"
├── Set Parameters (MSC-specific ports, dates)
├── Loop Over Items #1
├── Get Port Schedules (MSC API endpoint - different URL)
├── Extract Service Codes (MSC-specific format)
├── Loop Over Items #2
├── Fetch Vessel Schedules (MSC API)
├── Normalize to DCSA
└── Save to Supabase
```

## Implementation Guide

### Step 1: Create Carrier-Specific Workflows

1. **Duplicate the Maersk workflow** for each new carrier
2. **Rename** the workflow: `"[Carrier] Schedule Sync"`
3. **Update carrier-specific values**:
   - API endpoints
   - Consumer Key/API credentials
   - Port lists (if carrier-specific)
   - Date ranges (if different)

### Step 2: Update "Set Parameters" Node

Each workflow should have carrier-specific parameters:

**Maersk:**
```javascript
const carrier = 'MAERSK';
const apiBaseUrl = 'https://api.maersk.com/ocean/commercial-schedules/dcsa/v1';
const consumerKey = 'YOUR_MAERSK_KEY';
const ports = ['INMUN', 'INNSA', 'INMAA', ...]; // Maersk-served ports
```

**MSC (Example):**
```javascript
const carrier = 'MSC';
const apiBaseUrl = 'https://api.msc.com/schedules/v1'; // Different endpoint
const consumerKey = 'YOUR_MSC_KEY';
const ports = ['INMUN', 'INNSA', ...]; // MSC-served ports
```

### Step 3: Update API Endpoints

In "Get Port Schedules" and "Fetch Vessel Schedules" nodes:
- Use carrier-specific API URLs
- Use carrier-specific Consumer Keys
- Handle carrier-specific response formats

### Step 4: Schedule Workflows Independently

In n8n:
- **Maersk**: Run daily at 2 AM
- **MSC**: Run daily at 3 AM
- **CMA CGM**: Run twice weekly
- etc.

## Workflow Naming Convention

```
[Carrier Name] Schedule Sync
```

Examples:
- `Maersk Schedule Sync`
- `MSC Schedule Sync`
- `CMA CGM Schedule Sync`
- `COSCO Schedule Sync`

## Shared Components

While workflows are separate, you can share:

1. **"Normalize to DCSA" Code Node**
   - Same DCSA format for all carriers
   - Can copy/paste the same code

2. **"Save to Supabase" HTTP Request**
   - Same webhook endpoint
   - Same authentication
   - Database handles carrier identification

3. **"Extract Service Codes" Logic**
   - May need carrier-specific adjustments
   - But core logic can be similar

## Current Setup

### Maersk Workflow
- **Name**: "Maersk Schedule Sync" (or your current name)
- **Status**: ✅ Working
- **Ports**: Currently INMUN, can expand to all Indian ports
- **Frequency**: As needed (can schedule daily/weekly)

### Future Workflows
When adding new carriers:
1. Duplicate Maersk workflow
2. Update carrier name, API endpoints, keys
3. Test with one port first
4. Expand to all ports
5. Schedule independently

## Database Impact

The database already supports multiple carriers:
- `carrier` table stores all carriers
- `service` table links to `carrier_id`
- `schedule_source_audit` tracks which carrier each schedule came from
- All schedules are stored together, queryable by carrier

## Example: Adding MSC

1. **Create new workflow**: "MSC Schedule Sync"
2. **Copy Maersk workflow structure**
3. **Update**:
   - API endpoints to MSC URLs
   - Consumer Key to MSC key
   - Port list (if different)
4. **Test** with one port
5. **Schedule** independently from Maersk

## Monitoring

Track each workflow separately:
- Execution history per carrier
- Success/failure rates per carrier
- Data volume per carrier
- API response times per carrier

## Summary

✅ **One workflow per carrier** is the recommended architecture
- Better separation of concerns
- Independent scheduling and execution
- Easier maintenance and debugging
- More scalable

The current Maersk workflow is a good template for future carriers.




