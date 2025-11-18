# VM Code Alignment Check - Schedule APIs

## Current Situation

**Issue**: The schedule search LWC component calls `/api/v4/schedules/search`, but the VM hasn't been updated today, so it may not have the latest code.

## How Schedule APIs Work

### 1. **Salesforce → API Flow**

```
scheduleSearch LWC Component
  ↓
RMSScheduleService.searchSchedules() [Apex]
  ↓
RMSApiUtil.makeApiCall('/api/v4/schedules/search', 'POST', body)
  ↓
Named Credential: RMS_API → http://13.204.127.113:3000
  ↓
VM API Server: /api/v4/schedules/search [Fastify]
  ↓
ScheduleIntegrationService.searchSchedules()
  ↓
- Queries database (mv_schedules_with_legs)
- Queries Portcast API (if needed)
- Queries Maersk DCSA API (fallback for inland ports)
- Deduplicates and combines results
```

### 2. **Endpoint Used**

- **Apex Code**: `RMSScheduleService.cls` line 58
  ```apex
  HttpResponse res = RMSApiUtil.makeApiCall('/api/v4/schedules/search', 'POST', body);
  ```

- **API Route**: `src/routes/v4-routes.ts` line 37
  ```typescript
  fastify.post('/api/v4/schedules/search', async (request, reply) => {
    // Uses ScheduleIntegrationService
  });
  ```

### 3. **Dependencies**

The `/api/v4/schedules/search` endpoint requires:
- ✅ `ScheduleIntegrationService` class (`src/services/schedule-integration.service.ts`)
- ✅ `ScheduleDatabaseService` class (`src/services/schedule-database.service.ts`)
- ✅ `DCSAClient` for Maersk API fallback (`src/dcsa/dcsa-client-adapted.ts`)
- ✅ Routes registered in `src/index.ts`:
  - `addV4Routes(fastify, supabase)` - line ~2077
  - `addScheduleRoutes(fastify, supabase)` - line ~2078

---

## Potential Issues if VM is Not Updated

### ❌ Missing Endpoint
If VM doesn't have `/api/v4/schedules/search`:
- **Error**: `404 - Not Found` or `500 Internal Server Error`
- **Symptom**: Schedule search fails with "API call failed" error

### ❌ Missing Service Classes
If VM doesn't have `ScheduleIntegrationService`:
- **Error**: `Cannot find module '../services/schedule-integration.service.js'`
- **Symptom**: Server fails to start or endpoint crashes

### ❌ Missing Database Views
If VM database doesn't have `mv_schedules_with_legs`:
- **Error**: `relation "mv_schedules_with_legs" does not exist`
- **Symptom**: Database query fails, returns empty results

### ❌ Missing Maersk API Fallback
If VM doesn't have DCSA client configured:
- **Warning**: Inland ports won't have Maersk fallback
- **Symptom**: Fewer results for inland port searches

---

## How to Check if VM is Aligned

### Option 1: Check API Endpoint Exists

```bash
# SSH into VM
ssh user@13.204.127.113

# Check if endpoint exists (requires auth, so use curl with token)
curl -X POST http://localhost:3000/api/v4/schedules/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"origin":"INNSA"}'
```

### Option 2: Check Source Code on VM

```bash
# SSH into VM
ssh user@13.204.127.113

# Navigate to project directory
cd ~/RMS/rms-mcp-server

# Check if v4-routes.ts exists and has schedule endpoint
grep -n "api/v4/schedules/search" src/routes/v4-routes.ts

# Check if ScheduleIntegrationService exists
ls -la src/services/schedule-integration.service.ts

# Check git commit history (last update)
git log --oneline -10
```

### Option 3: Check Server Logs

```bash
# SSH into VM
ssh user@13.204.127.113

# Check Docker logs
docker-compose logs -f --tail=100

# Or if running with pm2
pm2 logs rms-mcp-server --lines 100
```

Look for:
- ✅ "V4 Schedule Search" logs = endpoint is working
- ❌ "Cannot find module" errors = missing files
- ❌ "relation does not exist" errors = missing database views

---

## How to Update VM

### Quick Update (Using Script)

```bash
# SSH into VM
ssh user@13.204.127.113

# Run update script
cd ~/RMS/rms-mcp-server
./update-vm.sh

# Or manually:
git pull origin master
npm install
npm run build
docker-compose restart  # or pm2 restart rms-mcp-server
```

### Manual Update

```bash
# 1. SSH into VM
ssh user@13.204.127.113

# 2. Navigate to project
cd ~/RMS/rms-mcp-server

# 3. Pull latest code
git pull origin master

# 4. Install dependencies (if needed)
npm install

# 5. Build TypeScript
npm run build

# 6. Restart server
# Option A: Docker
docker-compose down
docker-compose build
docker-compose up -d

# Option B: PM2
pm2 restart rms-mcp-server

# Option C: Direct Node.js
# Kill existing process, then:
npm start
```

---

## Testing After VM Update

### Test 1: Health Check

```bash
curl http://13.204.127.113:3000/health
# Expected: {"status":"ok","service":"rms-api",...}
```

### Test 2: Schedule Search Endpoint

```bash
# Get auth token first
TOKEN=$(curl -X POST http://13.204.127.113:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000001"}' \
  | jq -r '.token')

# Test schedule search
curl -X POST http://13.204.127.113:3000/api/v4/schedules/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "origin": "INNSA",
    "destination": "NLRTM",
    "departure_from": "2025-01-27",
    "limit": 10
  }'
```

### Test 3: From Salesforce (LWC)

1. Open `scheduleSearch` component in Salesforce
2. Search for schedules (e.g., Origin: INNSA, Destination: NLRTM)
3. Check browser console for errors
4. Verify schedules are displayed

---

## What Changed Today (That Might Not Be on VM)

Based on recent work, these files may have changed:

1. **Schedule Routes** (`src/routes/v4-routes.ts`)
   - Schedule search endpoint improvements
   - Better error handling
   - Inland port detection

2. **Schedule Integration Service** (`src/services/schedule-integration.service.ts`)
   - Maersk API fallback for inland ports
   - Better deduplication logic
   - Source tracking

3. **Schedule Database Service** (`src/services/schedule-database.service.ts`)
   - Audit trail for schedule sources
   - Better query optimization

4. **Main Server** (`src/index.ts`)
   - Route registration
   - MCP tool definitions for schedules

---

## Impact Assessment

### If VM is NOT Updated:

| Component | Impact | Severity |
|-----------|--------|----------|
| Missing `/api/v4/schedules/search` endpoint | Schedule search completely broken | 🔴 Critical |
| Missing `ScheduleIntegrationService` | Server won't start | 🔴 Critical |
| Missing database views | No schedule results | 🔴 Critical |
| Missing Maersk API fallback | Inland ports return fewer results | 🟡 Medium |
| Missing latest error handling | Poor error messages | 🟢 Low |

### If VM IS Updated:

✅ All features work as expected
✅ Inland ports have Maersk fallback
✅ Better error handling and logging
✅ Schedule source tracking works

---

## Recommendation

**YES, you should align the VM before testing schedule functionality.**

The schedule search depends on:
1. The `/api/v4/schedules/search` endpoint (must exist on VM)
2. The `ScheduleIntegrationService` class (must be deployed)
3. Database views and functions (must be up to date)

**Action Items:**

1. ✅ **Update VM code** using `update-vm.sh` or manual steps above
2. ✅ **Verify endpoint exists** by checking server logs or testing endpoint
3. ✅ **Test from Salesforce** to confirm schedule search works
4. ✅ **Check database views** if no results are returned

---

## Quick Verification Checklist

After updating VM:

- [ ] Server starts without errors (check logs)
- [ ] `/health` endpoint returns OK
- [ ] `/api/v4/schedules/search` endpoint exists (check logs or test)
- [ ] Schedule search from Salesforce returns results
- [ ] No "Cannot find module" errors in logs
- [ ] No "relation does not exist" errors in logs

---

## Troubleshooting

### Error: "404 - Not Found"
**Cause**: Endpoint doesn't exist on VM  
**Solution**: Update VM code, verify route is registered

### Error: "500 Internal Server Error"
**Cause**: Missing service class or database issue  
**Solution**: Check server logs, verify all files are deployed

### Error: "No schedules found" (but endpoint works)
**Cause**: Database views missing or no data  
**Solution**: Check database migrations, verify data exists

### Error: "Cannot find module"
**Cause**: TypeScript build failed or file missing  
**Solution**: Run `npm run build`, check all files exist

