# n8n Salesforce Integration Setup Guide

## 🎯 Overview

This workflow enables Salesforce to communicate with your RMS API through n8n webhooks. Salesforce can request quotes, search rates, and get local charges by sending HTTP requests to n8n, which then calls your RMS API and returns the response.

## 🔧 Setup Instructions

### Step 1: Import the Workflow

1. **Open n8n** at `https://agents.propelor.io/home/workflows`
2. **Click "Import from File"**
3. **Upload** `n8n-salesforce-webhook-workflow.json`
4. **Save** the workflow

### Step 2: Update JWT Token

⚠️ **IMPORTANT**: You need to update the JWT token in the workflow:

1. **Get a fresh JWT token**:
```bash
curl -X POST http://13.204.127.113:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "user_id": "sf_00DBE000002eBzh"
  }'
```

2. **In n8n workflow**, find all nodes with `YOUR_JWT_TOKEN_HERE`
3. **Replace** with your actual JWT token
4. **Save** the workflow

### Step 3: Activate the Workflow

1. **Toggle the workflow** to "Active"
2. **Copy the webhook URL** (something like: `https://agents.propelor.io/webhook/salesforce-rms`)

## 📋 API Endpoints Supported

### 1. Prepare Quote
**Salesforce Request**:
```json
{
  "action": "prepare_quote",
  "salesforce_org_id": "00DBE000002eBzh",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 2
}
```

**Response**: Complete quote with ocean freight, local charges, and totals

### 2. Search Rates
**Salesforce Request**:
```json
{
  "action": "search_rates",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "vendor_name": "MSC"
}
```

**Response**: Available ocean freight rates

### 3. Get Local Charges
**Salesforce Request**:
```json
{
  "action": "get_local_charges",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "vendor_name": "MSC"
}
```

**Response**: Origin and destination local charges

## 🧪 Testing the Integration

### Test from Salesforce (or Postman)

```bash
curl -X POST https://agents.propelor.io/webhook/salesforce-rms \
  -H "Content-Type: application/json" \
  -d '{
    "action": "prepare_quote",
    "salesforce_org_id": "00DBE000002eBzh",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 2
  }'
```

## 🔄 Workflow Logic

1. **Webhook Trigger**: Receives POST request from Salesforce
2. **Action Routing**: Determines which RMS API to call based on `action` field
3. **API Call**: Makes authenticated request to RMS API
4. **Response**: Returns RMS response back to Salesforce

## 🛡️ Security Features

- **JWT Authentication**: All RMS API calls are authenticated
- **Tenant Isolation**: Each request includes tenant ID
- **Error Handling**: Invalid actions return helpful error messages
- **Input Validation**: Required fields are validated

## 📊 Expected Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "route": {...},
    "quote_parts": {...},
    "totals": {...},
    "quote_summary": {...}
  }
}
```

### Error Response
```json
{
  "error": "Invalid action",
  "supported_actions": ["prepare_quote", "search_rates", "get_local_charges"]
}
```

## 🔧 Troubleshooting

### Common Issues

1. **JWT Token Expired**
   - **Solution**: Get a new token and update the workflow

2. **Connection Refused**
   - **Solution**: Check if RMS API server is running on VM

3. **Invalid Action**
   - **Solution**: Use one of the supported actions: `prepare_quote`, `search_rates`, `get_local_charges`

### Monitoring

- **Check n8n logs** for execution details
- **Monitor RMS API logs** on VM
- **Test individual endpoints** directly on RMS API

## 🚀 Next Steps

1. **Test all three endpoints** from Salesforce
2. **Set up error handling** in Salesforce
3. **Configure Salesforce** to use the webhook URL
4. **Monitor performance** and optimize as needed

## 📞 Support

If you encounter issues:
1. Check n8n workflow execution logs
2. Verify RMS API is running and accessible
3. Ensure JWT token is valid and not expired
4. Test RMS API endpoints directly first
