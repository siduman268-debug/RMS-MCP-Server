# n8n Salesforce Integration V2 - Multi-Step Quote Flow Setup Guide

This guide provides step-by-step instructions to set up the new **V2 multi-step quote workflow** for Salesforce integration with the RMS API.

## 🎯 **V2 Workflow Overview**

The V2 workflow supports a sophisticated multi-step quote building process:

1. **Search Rates**: Find available rates for a route
2. **Add Rate to Quote**: Add selected rates to a quote session
3. **Create Quote**: Generate final quote from all selected rates

## 📋 **Prerequisites**

- ✅ **V1 workflow working** (as backup)
- ✅ **RMS API V2 endpoints deployed**
- ✅ **n8n instance running**

## 🚀 **Step 1: Deploy V2 API Endpoints**

The V2 endpoints have been added to your RMS API:

- `POST /api/v2/add-rate-to-quote`
- `POST /api/v2/get-quote-session`
- `POST /api/v2/prepare-quote`

**Deploy the updated API:**
```bash
# On your VM
cd /home/ec2-user/RMS/rms-mcp-server
git pull
docker-compose up -d --build
```

## 🔧 **Step 2: Import V2 n8n Workflow**

1. **Download the V2 workflow**: `n8n-salesforce-webhook-workflow-v2.json`
2. **Open n8n**: Go to your n8n instance
3. **Import V2 workflow**:
   - Click "Workflows" → "New" → "Import from JSON"
   - Paste the V2 workflow content
   - Click "Import"

## ⚙️ **Step 3: Configure V2 Workflow**

### **A. Update JWT Token Node**
- **Method**: `POST`
- **URL**: `http://13.204.127.113:3000/api/auth/token`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "user_id": "sf_00DBE000002eBzh"
  }
  ```

### **B. Activate V2 Workflow**
1. **Toggle to "Active"**
2. **Copy the V2 webhook URL** (e.g., `https://agents.propelor.io/webhook/salesforce-rms-v2`)

## 🧪 **Step 4: Test V2 Workflow**

### **Test 1: Search Rates**
```bash
curl -X POST https://agents.propelor.io/webhook/salesforce-rms-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_rates",
    "salesforce_org_id": "00DBE000002eBzh",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "vendor_name": "MSC"
  }'
```

**Expected Response**: List of available rates with rate IDs

### **Test 2: Add Rate to Quote**
```bash
curl -X POST https://agents.propelor.io/webhook/salesforce-rms-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add_rate_to_quote",
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 71,
    "quote_session_id": "quote_test_123"
  }'
```

**Expected Response**: Confirmation that rate was added

### **Test 3: Create Final Quote**
```bash
curl -X POST https://agents.propelor.io/webhook/salesforce-rms-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_quote",
    "salesforce_org_id": "00DBE000002eBzh",
    "quote_session_id": "quote_test_123"
  }'
```

**Expected Response**: Complete quote with all selected rates

## 📊 **V2 API Endpoints Reference**

### **1. Add Rate to Quote**
**Endpoint**: `POST /api/v2/add-rate-to-quote`

**Request**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "rate_id": 71,
  "quote_session_id": "quote_12345"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "quote_session_id": "quote_12345",
    "salesforce_org_id": "00DBE000002eBzh",
    "selected_rates": [71],
    "rate_count": 1,
    "message": "Rate 71 added to quote session"
  }
}
```

### **2. Get Quote Session**
**Endpoint**: `POST /api/v2/get-quote-session`

**Request**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "quote_session_id": "quote_12345"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "quote_session_id": "quote_12345",
    "salesforce_org_id": "00DBE000002eBzh",
    "selected_rates": [71, 72],
    "rate_count": 2,
    "created_at": "2025-01-15T12:00:00.000Z",
    "updated_at": "2025-01-15T12:05:00.000Z",
    "status": "building"
  }
}
```

### **3. Create Multi-Rate Quote**
**Endpoint**: `POST /api/v2/prepare-quote`

**Request**:
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "quote_session_id": "quote_12345"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "quote_session_id": "quote_12345",
    "quote_parts": [
      {
        "rate_id": 71,
        "route": {
          "pol": "INNSA",
          "pod": "NLRTM",
          "container_type": "40HC",
          "container_count": 1
        },
        "ocean_freight": {
          "carrier": "MSC",
          "all_in_freight_sell": 2463.84,
          "transit_days": 18
        },
        "origin_charges": {
          "charges": [...],
          "total": 150.00,
          "count": 3
        },
        "destination_charges": {
          "charges": [...],
          "total": 200.00,
          "count": 2
        },
        "rate_total": 2813.84
      }
    ],
    "totals": {
      "total_rates": 1,
      "grand_total": 2813.84,
      "currency": "USD"
    }
  }
}
```

## 🔄 **Salesforce Integration Flow**

### **Step 1: User Searches Rates**
1. User enters shipment details in Salesforce
2. Salesforce calls V2 webhook with `action: "search_rates"`
3. RMS returns available rates
4. Salesforce displays rates for user selection

### **Step 2: User Adds Rates to Quote**
1. User selects a rate and clicks "Add to Quote"
2. Salesforce calls V2 webhook with `action: "add_rate_to_quote"`
3. RMS stores the rate in the quote session
4. User can add multiple rates from different routes

### **Step 3: User Creates Final Quote**
1. User clicks "Create Quote"
2. Salesforce calls V2 webhook with `action: "create_quote"`
3. RMS generates complete quote with all selected rates
4. Salesforce displays final quote to user

## 🛡️ **Backup Strategy**

- **V1 Workflow**: Keep as backup (`salesforce-rms`)
- **V2 Workflow**: New multi-step flow (`salesforce-rms-v2`)
- **Rollback**: Simply switch Salesforce to use V1 webhook URL if needed

## 🎯 **Next Steps**

1. **Test V2 workflow** with the provided test commands
2. **Update Salesforce** to use V2 webhook URL
3. **Monitor performance** and user experience
4. **Implement database storage** for quote sessions (currently in-memory)

## 🚨 **Troubleshooting**

### **Common Issues**:

1. **"Quote session not found"**: Ensure `quote_session_id` is consistent across calls
2. **"No rates selected"**: Add rates using `add_rate_to_quote` before creating quote
3. **"Salesforce Org ID mismatch"**: Ensure same `salesforce_org_id` used throughout session

### **Debug Commands**:
```bash
# Check quote session status
curl -X POST https://agents.propelor.io/webhook/salesforce-rms-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_quote_session",
    "salesforce_org_id": "00DBE000002eBzh",
    "quote_session_id": "your_session_id"
  }'
```

## ✅ **Success Criteria**

- ✅ **V2 workflow imported and activated**
- ✅ **All three test commands return successful responses**
- ✅ **Quote sessions persist across multiple API calls**
- ✅ **Multi-rate quotes generate correctly**
- ✅ **V1 workflow remains as backup**

**Ready to test the V2 multi-step quote flow!** 🚀
