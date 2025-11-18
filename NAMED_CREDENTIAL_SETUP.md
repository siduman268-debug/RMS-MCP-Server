# Named Credential Setup Guide

## Overview

The RMS Salesforce integration uses a **Named Credential** (`RMS_API`) to connect to the RMS API server running on your VM. You must configure this **before** any database connections will work.

## ⚠️ Prerequisites

1. **VM must be running** and accessible
2. **API server must be deployed** on the VM
3. **Network connectivity** from Salesforce org to VM (or VPN if in private network)

---

## Step 1: Verify VM is Running

### Check API Server Health

```bash
# Test if VM API is accessible
curl http://13.204.127.113:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-27T..."}
```

### Verify API Endpoints

```bash
# Test auth endpoint
curl -X POST http://13.204.127.113:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000001"}'

# Should return: {"token":"...","expires_in":3600}
```

---

## Step 2: Configure Named Credential in Salesforce

### A. Navigate to Setup

1. Go to **Setup** (gear icon → Setup)
2. Search for **"Named Credentials"** in Quick Find
3. Click **"Named Credentials"**

### B. Create/Edit Named Credential

1. **Find or Create** `RMS_API`:
   - If it exists, click **Edit**
   - If it doesn't exist, click **New Named Credential**

2. **Configure Settings**:
   - **Label**: `RMS_API`
   - **Name**: `RMS_API` (must match exactly)
   - **URL**: `http://13.204.127.113:3000` (your VM IP:port)
   - **Identity Type**: `Named Principal`
   - **Authentication Protocol**: `No Authentication` (the API handles JWT auth)

3. **Allow Merge Fields in HTTP Header**: ✅ Checked

4. **Allow Merge Fields in HTTP Body**: ✅ Checked

5. **Generate Authorization Header**: ❌ Unchecked (we handle auth manually)

### C. Save and Test

1. Click **Save**
2. Test connection (if option available)
3. Note: The actual authentication happens via JWT tokens, so the Named Credential just provides the base URL

---

## Step 3: Verify Configuration

### Test from Apex (Anonymous Apex)

```apex
// Run in Developer Console → Anonymous Apex
String endpoint = 'callout:RMS_API/health';
HttpRequest req = new HttpRequest();
req.setEndpoint(endpoint);
req.setMethod('GET');

Http http = new Http();
HttpResponse res = http.send(req);

System.debug('Status Code: ' + res.getStatusCode());
System.debug('Response: ' + res.getBody());
// Should return: {"status":"ok",...}
```

### Test from LWC Component

1. Open **RMS Management** component
2. Go to **Rates** tab
3. Try to load rates
4. Check browser console for any connection errors

---

## Step 4: Troubleshooting

### Error: "Unable to Connect to Remote Server"

**Possible Causes**:
- ❌ VM is not running
- ❌ API server is not deployed on VM
- ❌ Firewall blocking port 3000
- ❌ Network connectivity issue

**Solutions**:
1. **Verify VM is running**:
   ```bash
   ssh user@13.204.127.113
   # Check if API server process is running
   ps aux | grep node
   # Or check Docker containers
   docker ps
   ```

2. **Verify API server is accessible**:
   ```bash
   curl http://13.204.127.113:3000/health
   ```

3. **Check firewall rules** (on VM):
   ```bash
   # Allow port 3000
   sudo ufw allow 3000/tcp
   # Or if using AWS/Azure security groups, update rules
   ```

### Error: "404 - Not Found"

**Cause**: Named Credential URL is incorrect or API endpoint path is wrong

**Solution**: Verify Named Credential URL matches your VM endpoint

### Error: "401 - Unauthorized" or "403 - Forbidden"

**Cause**: Authentication issue (though this shouldn't happen with `/health` endpoint)

**Solution**: Check if JWT token generation is working:
```apex
// Test auth endpoint
String endpoint = 'callout:RMS_API/api/auth/token';
HttpRequest req = new HttpRequest();
req.setEndpoint(endpoint);
req.setMethod('POST');
req.setHeader('Content-Type', 'application/json');
req.setBody('{"tenant_id":"00000000-0000-0000-0000-000000000001"}');

Http http = new Http();
HttpResponse res = http.send(req);
System.debug('Auth Response: ' + res.getBody());
```

---

## Alternative: Using Localhost (Development Only)

If testing locally (not recommended for production):

1. **Named Credential URL**: `http://localhost:3000`
   - ⚠️ **Note**: This only works if Salesforce org can access your local machine
   - Usually requires VPN or port forwarding
   - Not recommended for production use

2. **Use VM endpoint for production**: Always use `http://13.204.127.113:3000`

---

## Configuration Checklist

Before testing the RMS Management component:

- [ ] VM is running and accessible
- [ ] API server is deployed on VM (`curl http://13.204.127.113:3000/health` works)
- [ ] Named Credential `RMS_API` is created in Salesforce
- [ ] Named Credential URL is set to VM endpoint (`http://13.204.127.113:3000`)
- [ ] Named Credential authentication is set to "No Authentication"
- [ ] Test connection from Anonymous Apex succeeds
- [ ] RMS Management component can load data

---

## Next Steps

After Named Credential is configured:

1. **Test Rates Tab**: Open RMS Management → Rates tab → Verify rates load
2. **Test Vendors Tab**: Verify vendors load
3. **Test Contracts Tab**: Verify contracts load
4. **Test Filters**: Use rate filters to verify API calls work correctly

---

## Related Documentation

- **API Documentation**: See `API_DOCUMENTATION_V4.md` for endpoint details
- **VM Setup**: See `CLAUDE_VM_SETUP.md` for VM configuration
- **Deployment**: See `RMS_DEPLOYMENT_CHECKLIST.md` for full deployment steps

