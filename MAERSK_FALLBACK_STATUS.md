# Maersk API Fallback Status

## Current Implementation

The Maersk API fallback is **implemented and should be working**, but it may not be triggering due to:

### 1. **Fallback Trigger Conditions**

The fallback now triggers when:
- ✅ Database view returns no data (`found: false`)
- ✅ Database transit time seems incorrect (< 5 days) - **NEW**

### 2. **What Should Happen**

When transit time < 5 days:
1. Code detects incorrect transit time
2. Logs: `[Schedule] Trying Maersk API fallback... because: transit time seems incorrect (1.4 days)`
3. Calls Maersk API: `fetchPointToPoint(INNSA, NLRTM)`
4. Logs: `[Schedule] Maersk API returned X routes`
5. If successful: `[Schedule] ✅ Maersk API fallback successful (transit: X days)`

### 3. **Possible Issues**

#### A. DCSA Client Not Initialized
- Check if `DCSAClient` is properly initialized
- Look for: `DCSA Client initialization failed` in server logs
- Requires: `MAERSK_API_KEY` in `.env`

#### B. Maersk Adapter Not Configured
- Check if Maersk adapter is registered
- Look for: `Maersk adapter not configured` in logs
- Requires: Proper adapter registration in `DCSAClient`

#### C. Maersk API Error
- Check for API errors in logs
- Look for: `Error calling Maersk API fallback` or HTTP errors
- Requires: Valid `MAERSK_API_KEY` and API access

#### D. API Returns No Routes
- Check if API returns empty array
- Look for: `No Maersk routes found from INNSA to NLRTM`
- May need to check API response format

### 4. **How to Verify**

Check server console logs for:
```
[Schedule] Trying Maersk API fallback for INNSA → NLRTM because: transit time seems incorrect (1.4 days)
[Schedule] Calling Maersk API: fetchPointToPoint(INNSA, NLRTM, fromDate=2025-01-07)
[Schedule] Maersk API returned X routes
```

If you see these logs, the fallback is working but may be:
- Returning no routes
- Returning routes but with errors
- API credentials issue

### 5. **Next Steps**

1. ✅ Check server console logs for `[Schedule]` messages
2. ⏳ Verify `MAERSK_API_KEY` is set in `.env`
3. ⏳ Test Maersk API directly to confirm it works
4. ⏳ Check if DCSA client initializes successfully

## Expected Behavior

**If working correctly:**
- Transit time should be ~20 days (from Maersk API)
- Server logs should show Maersk API call
- Response should have correct vessel/voyage info

**If not working:**
- Transit time stays at 1.4 days (from database)
- Check logs for error messages
- Verify API credentials

