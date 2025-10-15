# n8n Salesforce V2 Simplified Workflow Setup Guide

## Overview

This guide sets up the **simplified V2 RMS integration** with Salesforce using n8n. The new flow eliminates complex session management and provides a clean 2-step process:

1. **Search Rates** → Get available rates
2. **Prepare Quote** → Generate quote for selected rate

## 🚀 Simplified V2 Flow

```
Salesforce → n8n Webhook → RMS API → Response to Salesforce
```

### **Step 1: Search Rates**
```json
POST /webhook/salesforce-rms-v2
{
  "action": "search_rates",
  "pol_code": "INNSA",
  "pod_code": "NLRTM", 
  "container_type": "40HC",
  "vendor_name": "MSC"  // optional
}
```

### **Step 2: Prepare Quote**
```json
POST /webhook/salesforce-rms-v2
{
  "action": "prepare_quote",
  "salesforce_org_id": "00DBE000002eBzh",
  "rate_id": 77,
  "container_count": 1  // optional, defaults to 1
}
```

## 📋 Prerequisites

- ✅ n8n instance running
- ✅ RMS API server running on VM (13.204.127.113:3000)
- ✅ JWT authentication configured
- ✅ Salesforce webhook capability

## 🔧 Setup Instructions

### Step 1: Import the Workflow

1. **Open n8n** in your browser
2. **Click "Import from File"**
3. **Select** `n8n-salesforce-v2-simplified-workflow.json`
4. **Click "Import"**

### Step 2: Configure the Webhook

1. **Click on "Salesforce Webhook" node**
2. **Copy the Webhook URL** (e.g., `https://agents.propelor.io/webhook/salesforce-rms-v2`)
3. **Note the webhook ID**: `salesforce-rms-v2`

### Step 3: Test the Workflow

#### Test 1: Search Rates
```bash
curl -X POST https://agents.propelor.io/webhook/salesforce-rms-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_rates",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "vendor": "Hapag-Lloyd",
      "route": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
      "container_type": "40HC",
      "transit_days": 22,
      "pricing": {
        "all_in_freight_sell": 2765.84,
        "currency": "USD"
      },
      "is_preferred": false,
      "rate_id": 77
    },
    {
      "vendor": "MSC", 
      "route": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
      "container_type": "40HC",
      "transit_days": 18,
      "pricing": {
        "all_in_freight_sell": 2463.84,
        "currency": "USD"
      },
      "is_preferred": true,
      "rate_id": 71
    }
  ]
}
```

#### Test 2: Prepare Quote
```bash
curl -X POST https://agents.propelor.io/webhook/salesforce-rms-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "prepare_quote",
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 77,
    "container_count": 1
  }'
```

**Expected Response:**
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
        "transit_days": 22,
        "is_preferred": false
      },
      "origin_charges": {
        "charges": [...],
        "total_usd": 966666.67,
        "count": 4
      },
      "destination_charges": {
        "charges": [...],
        "total_usd": 375,
        "count": 4
      }
    },
    "totals": {
      "grand_total_usd": 969807.51,
      "currency": "USD",
      "fx_rates": {"INR": 0.012}
    }
  }
}
```

## 🔄 Workflow Logic

### **Node Flow:**
```
Salesforce Webhook
    ↓
Get JWT Token
    ↓
IF: Search Rates? ──YES──→ Call RMS Search Rates API ──→ Respond: Search Rates
    ↓ NO
IF: Prepare Quote? ──YES──→ Call RMS Prepare Quote API ──→ Respond: Prepare Quote
    ↓ NO
Respond: Error
```

### **Key Features:**
- ✅ **Automatic JWT token generation** for each request
- ✅ **Action-based routing** (search_rates vs prepare_quote)
- ✅ **Error handling** for invalid actions
- ✅ **Tenant isolation** with x-tenant-id header
- ✅ **V1-compatible response structure**

## 🎯 Salesforce Integration

### **In Salesforce Flow/Process Builder:**

#### **Step 1: Search Rates**
```javascript
// Salesforce Apex/Flow
Map<String, Object> request = new Map<String, Object>{
    'action' => 'search_rates',
    'pol_code' => '{!POL_Code__c}',
    'pod_code' => '{!POD_Code__c}',
    'container_type' => '{!Container_Type__c}'
};

HttpResponse response = callout('RMS_Search_Rates', request);
List<Object> rates = (List<Object>) response.getBody();
```

#### **Step 2: User Selects Rate**
```javascript
// User picks rate from the list returned in Step 1
// Store selected rate_id in Salesforce record
```

#### **Step 3: Prepare Quote**
```javascript
// Salesforce Apex/Flow
Map<String, Object> request = new Map<String, Object>{
    'action' => 'prepare_quote',
    'salesforce_org_id' => '{!$Organization.Id}',
    'rate_id' => '{!Selected_Rate_ID__c}',
    'container_count' => '{!Container_Count__c}'
};

HttpResponse response = callout('RMS_Prepare_Quote', request);
Map<String, Object> quote = (Map<String, Object>) response.getBody();
```

## 🔧 Configuration

### **Environment Variables (if needed):**
- `RMS_API_URL`: `http://13.204.127.113:3000`
- `TENANT_ID`: `00000000-0000-0000-0000-000000000001`
- `JWT_USER_ID`: `sf_00DBE000002eBzh`

### **Webhook Security:**
- Consider adding webhook signature verification
- Implement rate limiting if needed
- Add IP whitelisting for Salesforce

## 🚨 Troubleshooting

### **Common Issues:**

#### **1. JWT Token Errors**
```
Error: "Invalid or expired token"
```
**Solution:** Check if JWT token generation is working in the "Get JWT Token" node

#### **2. Rate Not Found**
```
Error: "Rate not found"
```
**Solution:** Verify the rate_id exists by calling search_rates first

#### **3. Authentication Errors**
```
Error: "401 Unauthorized"
```
**Solution:** Check x-tenant-id header and JWT token validity

#### **4. Invalid Action**
```
Error: "Invalid action. Use 'search_rates' or 'prepare_quote'"
```
**Solution:** Ensure action field is exactly "search_rates" or "prepare_quote"

## 📊 Monitoring

### **Key Metrics to Track:**
- ✅ **Response times** for each API call
- ✅ **Success rates** for search vs prepare operations
- ✅ **Error rates** by error type
- ✅ **Usage patterns** (most common routes, carriers)

### **Logs to Monitor:**
- n8n execution logs
- RMS API server logs
- Salesforce webhook delivery logs

## 🎉 Benefits of V2 Simplified Flow

### **Compared to V1:**
- ✅ **Simpler integration** - No complex session management
- ✅ **Better performance** - Single API call for quote generation
- ✅ **Easier debugging** - Clear action-based routing
- ✅ **More reliable** - No session state to manage

### **Compared to V2 Multi-Rate:**
- ✅ **Reduced complexity** - No quote sessions or rate collections
- ✅ **Faster development** - Simpler Salesforce integration
- ✅ **Better UX** - Direct rate selection and quote generation
- ✅ **Easier maintenance** - Fewer moving parts

## 🔄 Next Steps

1. **Test the workflow** with both search and prepare operations
2. **Configure Salesforce** to call the webhook endpoints
3. **Set up monitoring** and error handling
4. **Deploy to production** when ready

---

**Webhook URL:** `https://agents.propelor.io/webhook/salesforce-rms-v2`  
**RMS API:** `http://13.204.127.113:3000`  
**Version:** V2 Simplified  
**Last Updated:** October 15, 2025
