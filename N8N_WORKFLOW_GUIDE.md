# n8n Workflow Guide - RMS Freight Quote Automation

## Overview

This guide will help you set up an automated freight quote workflow using n8n and the RMS MCP Server API endpoints.

## Workflow Architecture

```
┌──────────────┐
│   Webhook    │ ← Customer enquiry (email/form/API)
│   Trigger    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Search Rates     │ ← Find preferred freight rates
│ (POST /api/...)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Rates Found?     │ ← Check if rates available
└──────┬───────────┘
       │
       ├─── Yes ───▶ ┌────────────────────┐
       │             │ Get Local Charges  │
       │             └─────────┬──────────┘
       │                       │
       │                       ▼
       │             ┌────────────────────┐
       │             │ Prepare Quote      │
       │             └─────────┬──────────┘
       │                       │
       │                       ▼
       │             ┌────────────────────┐
       │             │ Format Quote       │
       │             └─────────┬──────────┘
       │                       │
       │                       ├──▶ Send Email
       │                       └──▶ Save to DB
       │
       └─── No ────▶ Send "No Rates" Message
```

---

## Prerequisites

1. **n8n installed** (self-hosted or cloud)
2. **RMS MCP Server running** on `http://localhost:3000`
3. **Email credentials** configured in n8n (Gmail, SMTP, etc.)
4. **Supabase credentials** (optional, for quote tracking)

---

## Quick Start

### Step 1: Import the Workflow

1. Open n8n interface
2. Click **"Add workflow"** → **"Import from file"**
3. Select `n8n-workflow-example.json`
4. Click **"Import"**

### Step 2: Configure Nodes

#### 1. Webhook Trigger
- **Path**: `/rms-enquiry`
- **Method**: POST
- **Authentication**: None (or add Basic Auth for security)

**Test Payload**:
```json
{
  "customer_name": "Acme Corp",
  "customer_email": "john@acme.com",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 2
}
```

#### 2. Search Freight Rates
- **URL**: `http://localhost:3000/api/search-rates`
- **Method**: POST
- **Body**: Maps from webhook input

#### 3. Get Local Charges
- **URL**: `http://localhost:3000/api/get-local-charges`
- **Depends on**: Preferred vendor from Search Rates

#### 4. Prepare Quote
- **URL**: `http://localhost:3000/api/prepare-quote`
- **Generates**: Complete quote with all charges

#### 5. Format Quote (Code Node)
- Transforms API response into customer-friendly format
- Generates quote number
- Formats pricing for display

#### 6. Send Quote Email
- **Configure**: Your email credentials
- **Template**: HTML email with quote details

#### 7. Save Quote to Database (Optional)
- **Configure**: Supabase credentials
- **Table**: `quotes` (you'll need to create this)

---

## Workflow Variations

### Variation 1: Simple Rate Lookup

Just check rates without creating a full quote:

```json
{
  "nodes": [
    "Webhook Trigger",
    "Search Freight Rates",
    "Send Rate Summary Email"
  ]
}
```

**Use Case**: Quick rate checks for sales team

---

### Variation 2: Multi-Vendor Comparison

Compare rates from multiple vendors:

1. **Search Rates** (without vendor filter)
2. **Loop** through all returned rates
3. **Get Local Charges** for each vendor
4. **Compare** and select best option
5. **Send Comparison Report**

**Implementation**:
```javascript
// In Code node after Search Rates
const rates = $input.item.json.data;
const comparisons = [];

for (const rate of rates) {
  // Get local charges for this vendor
  const localCharges = await $http.request({
    method: 'POST',
    url: 'http://localhost:3000/api/get-local-charges',
    body: {
      pol_code: rate.pol_code,
      pod_code: rate.pod_code,
      container_type: rate.container_type,
      vendor_name: rate.vendor
    }
  });
  
  comparisons.push({
    vendor: rate.vendor,
    freight: rate.pricing.all_in_freight_sell,
    local_charges: localCharges.data.origin_total_usd + localCharges.data.destination_total_usd,
    total: rate.pricing.all_in_freight_sell + localCharges.data.origin_total_usd + localCharges.data.destination_total_usd
  });
}

return comparisons.sort((a, b) => a.total - b.total);
```

---

### Variation 3: Bulk Quote Generation

Process multiple enquiries from a CSV/spreadsheet:

1. **Read Spreadsheet** (Google Sheets, Excel, Airtable)
2. **Loop** through each row
3. **Prepare Quote** for each enquiry
4. **Aggregate** all quotes
5. **Send Batch Report**

---

### Variation 4: Salesforce Integration (Future)

When ready for Salesforce integration:

1. **Salesforce Trigger** - New Opportunity created
2. **Extract** shipping details from Opportunity
3. **Search Rates** via RMS API
4. **Prepare Quote**
5. **Update Opportunity** with quote details
6. **Create Quote PDF** attachment
7. **Send Email** to customer via Salesforce

---

## Example Enquiry Payloads

### Basic Enquiry
```json
{
  "customer_name": "Acme Corp",
  "customer_email": "john@acme.com",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 1
}
```

### With Vendor Preference
```json
{
  "customer_name": "Global Shipping Ltd",
  "customer_email": "quotes@globalship.com",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "20GP",
  "container_count": 5,
  "preferred_vendor": "MSC"
}
```

### Origin Charges Only
```json
{
  "pol_code": "INNSA",
  "container_type": "40HC",
  "vendor_name": "Maersk"
}
```

---

## Testing the Workflow

### 1. Test via Webhook URL

Once you activate the workflow, n8n will provide a webhook URL like:
```
https://your-n8n-instance.com/webhook/rms-enquiry
```

Test with curl:
```bash
curl -X POST https://your-n8n-instance.com/webhook/rms-enquiry \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "customer_email": "test@example.com",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 2
  }'
```

### 2. Test Individual Nodes

In n8n:
1. Click on each node
2. Click **"Execute Node"**
3. Check the output in the right panel
4. Verify data is flowing correctly

### 3. Monitor Execution

- **Execution List**: View all workflow runs
- **Error Logs**: Check for failed executions
- **Data Inspector**: View data passed between nodes

---

## Advanced Features

### 1. Add Rate Caching

Cache rates for 1 hour to reduce API calls:

```javascript
// Code node before Search Rates
const cacheKey = `${pol_code}-${pod_code}-${container_type}`;
const cachedRate = $cache.get(cacheKey);

if (cachedRate && Date.now() - cachedRate.timestamp < 3600000) {
  return cachedRate.data;
}

// Otherwise, fetch from API and cache
const result = await $http.request({...});
$cache.set(cacheKey, {
  data: result,
  timestamp: Date.now()
});

return result;
```

### 2. Add Price Alerts

Notify when rates change significantly:

```javascript
// Code node to compare with historical rates
const currentRate = $json.totals.grand_total_usd;
const historicalRate = await getHistoricalRate(pol, pod, container);

if (Math.abs(currentRate - historicalRate) / historicalRate > 0.1) {
  // Price changed by more than 10%
  await sendPriceAlert({
    route: `${pol} → ${pod}`,
    old_price: historicalRate,
    new_price: currentRate,
    change_pct: ((currentRate - historicalRate) / historicalRate * 100).toFixed(2)
  });
}
```

### 3. Auto-Quote Approval

For small quotes, auto-approve and book:

```javascript
// IF node condition
$json.totals.grand_total_usd < 5000 && 
$json.quote_summary.vendor_info.carrier === 'Preferred Vendor'

// Then auto-create booking
```

### 4. Multi-Currency Quotes

Generate quotes in customer's preferred currency:

```javascript
// Code node after Prepare Quote
const customerCurrency = $json.body.preferred_currency || 'USD';
const usdTotal = $json.data.totals.grand_total_usd;

// Get reverse FX rate
const fxRate = await getExchangeRate('USD', customerCurrency);
const convertedTotal = usdTotal * fxRate;

return {
  ...quote,
  customer_currency: customerCurrency,
  grand_total_customer_currency: convertedTotal.toFixed(2)
};
```

---

## Integration Examples

### Email-to-Quote Automation

**Trigger**: Email received at quotes@yourcompany.com  
**Process**:
1. Parse email body for route details (using AI or regex)
2. Extract: POL, POD, container type, quantity
3. Search rates
4. Generate quote
5. Reply to customer email with quote

**n8n Nodes**:
```
Email Trigger → 
AI Extract (ChatGPT/Claude) → 
Search Rates → 
Prepare Quote → 
Reply Email
```

### Slack Bot Integration

**Trigger**: `/quote INNSA NLRTM 40HC 2`  
**Process**:
1. Parse Slack command
2. Generate quote
3. Reply in Slack thread

**n8n Nodes**:
```
Slack Trigger → 
Parse Command → 
Prepare Quote → 
Format for Slack → 
Reply in Thread
```

### Web Form Integration

**Trigger**: Customer submits quote request form  
**Process**:
1. Receive form data (from Typeform, Google Forms, etc.)
2. Validate inputs
3. Generate quote
4. Email quote + Update CRM

**n8n Nodes**:
```
Form Webhook → 
Validate Data → 
Prepare Quote → 
[Email + CRM Update]
```

---

## Error Handling

### Retry Failed API Calls

Add error handling to each HTTP Request node:

**Settings** → **On Error**:
- Continue execution
- Retry: 3 times
- Wait: 2 seconds between retries

### Handle Missing Rates

```javascript
// After Search Rates node
if (!$json.success || $json.data.length === 0) {
  // Send "no rates available" notification
  return {
    status: 'no_rates',
    message: 'No preferred rates found for this route'
  };
}
```

### Validate Input Data

```javascript
// Code node after Webhook Trigger
const requiredFields = ['pol_code', 'pod_code', 'container_type'];
const missing = requiredFields.filter(field => !$json.body[field]);

if (missing.length > 0) {
  throw new Error(`Missing required fields: ${missing.join(', ')}`);
}

return $json;
```

---

## Performance Optimization

### 1. Parallel Execution

Run independent API calls in parallel:

```
Prepare Quote
     ├──▶ Get Local Charges (Origin)
     └──▶ Get Local Charges (Destination)
          ↓ ↓
        Merge Results
```

### 2. Batch Processing

Process multiple enquiries efficiently:

```javascript
// Split into batches of 10
const batchSize = 10;
const batches = [];

for (let i = 0; i < enquiries.length; i += batchSize) {
  batches.push(enquiries.slice(i, i + batchSize));
}

// Process each batch
for (const batch of batches) {
  await Promise.all(batch.map(e => processEnquiry(e)));
  await sleep(1000); // Rate limiting
}
```

### 3. Use Webhooks for Async Operations

For long-running operations:
1. Return immediate acknowledgment
2. Process quote in background
3. Send email when ready

---

## Monitoring & Analytics

### Track Quote Metrics

Add a final node to log metrics:

```javascript
// Code node - Log Metrics
return {
  metric: 'quote_generated',
  timestamp: Date.now(),
  route: `${pol_code}-${pod_code}`,
  vendor: carrier,
  total_usd: grand_total_usd,
  container_count: container_count,
  processing_time_ms: Date.now() - startTime
};
```

### Dashboard Integration

Connect to analytics tools:
- **Google Sheets**: Log all quotes
- **Airtable**: Track quote pipeline
- **Grafana**: Real-time dashboards
- **Slack**: Daily summaries

---

## Security Best Practices

### 1. Webhook Authentication

Add authentication to your webhook:

**n8n Settings**:
- Header Auth: `X-API-Key`
- Basic Auth: username/password
- IP Whitelist: Restrict to known IPs

### 2. Environment Variables

Store sensitive data in n8n credentials:
- Supabase URL and keys
- Email credentials
- API keys

### 3. Rate Limiting

Prevent abuse:

```javascript
// Code node - Rate Limiter
const clientIp = $json.headers['x-forwarded-for'];
const requestCount = $cache.get(`rate_limit_${clientIp}`) || 0;

if (requestCount > 100) { // 100 requests per hour
  throw new Error('Rate limit exceeded');
}

$cache.set(`rate_limit_${clientIp}`, requestCount + 1, 3600);
```

---

## Sample Workflows

### 1. Basic Quote Automation

**Input** (Webhook):
```json
{
  "customer_email": "john@acme.com",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 2
}
```

**Output** (Email):
```
Subject: Your Freight Quote - QT-123456

Dear Customer,

Route: INNSA → NLRTM
Container: 2x 40HC
Carrier: MSC
Transit: 18 days

Ocean Freight: $4,927.68
Origin Charges: $279.52 (23,200 INR)
Dest Charges: $882.34 (750 EUR)

GRAND TOTAL: $6,089.54 USD

Valid until: 2026-01-05
```

---

### 2. Multi-Route Comparison

**Input**:
```json
{
  "customer_email": "quotes@company.com",
  "routes": [
    {"pol": "INNSA", "pod": "NLRTM"},
    {"pol": "INNSA", "pod": "USNYC"},
    {"pol": "INNSA", "pod": "GBFXT"}
  ],
  "container_type": "40HC",
  "container_count": 1
}
```

**Process**:
- Loop through all routes
- Generate quote for each
- Compare and rank by price
- Send comparison table

---

### 3. Scheduled Rate Updates

**Trigger**: Every day at 9 AM  
**Process**:
1. Query all active routes
2. Get latest rates for each
3. Compare with yesterday's rates
4. Send rate change report to sales team

**n8n Nodes**:
```
Schedule Trigger (Cron: 0 9 * * *) →
Get Active Routes (from DB) →
Loop: Search Rates for each →
Compare with Historical →
Format Report →
Send to Slack/Email
```

---

### 4. Customer Portal Integration

**Trigger**: API call from customer portal  
**Process**:
1. Authenticate customer
2. Get saved shipping preferences
3. Generate instant quote
4. Return JSON response
5. Log in customer history

**Response**:
```json
{
  "quote_id": "QT-789012",
  "status": "success",
  "total_usd": 6089.54,
  "breakdown": {
    "freight": 4927.68,
    "origin": 279.52,
    "destination": 882.34
  },
  "carrier": "MSC",
  "transit_days": 18,
  "valid_until": "2026-01-05"
}
```

---

## Troubleshooting

### Workflow Not Triggering

**Check**:
1. Workflow is activated (toggle switch ON)
2. Webhook URL is correct
3. RMS MCP Server is running (`GET /health`)
4. Firewall allows connections

### Empty Quote Results

**Debug Steps**:
1. Check Search Rates output - are rates found?
2. Verify pol_code/pod_code are correct
3. Confirm container_type matches available rates
4. Check if preferred rates exist

### Email Not Sending

**Check**:
1. Email credentials configured correctly
2. SMTP settings valid
3. From/To addresses formatted properly
4. Check n8n execution logs for errors

### FX Conversion Not Working

**Check**:
1. RMS Server logs show fallback rates being used
2. Currency codes match (INR, EUR, USD)
3. Amounts are being rounded correctly

---

## Production Deployment

### 1. Environment Setup

**Development**:
- n8n: `http://localhost:5678`
- RMS API: `http://localhost:3000`

**Production**:
- n8n: Cloud or self-hosted with SSL
- RMS API: Deploy to Heroku/Railway/Cloud Run
- Update all URLs in workflow

### 2. Update API URLs

Replace `localhost:3000` with production URL:
```
http://localhost:3000 → https://rms-api.yourcompany.com
```

### 3. Add Monitoring

- **Uptime**: Monitor `/health` endpoint
- **Errors**: Alert on failed executions
- **Performance**: Track response times

### 4. Backup & Version Control

- Export workflow JSON regularly
- Store in git repository
- Tag versions for rollback

---

## Webhook Testing

### Using Postman

1. Create new POST request
2. URL: `https://your-n8n.com/webhook/rms-enquiry`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "customer_name": "Test Corp",
  "customer_email": "test@example.com",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 1
}
```

### Using PowerShell

```powershell
$body = @{
  customer_name = "Test Corp"
  customer_email = "test@example.com"
  pol_code = "INNSA"
  pod_code = "NLRTM"
  container_type = "40HC"
  container_count = 1
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://your-n8n.com/webhook/rms-enquiry" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## Best Practices

### 1. Data Validation

Always validate input data before processing:
- Port codes exist in database
- Container types are valid
- Email addresses are formatted correctly
- Quantities are positive integers

### 2. Error Notifications

Send alerts when workflows fail:
- Email to ops team
- Slack notification
- PagerDuty for critical failures

### 3. Audit Trail

Log all quote generations:
- Customer details
- Route and pricing
- Timestamp
- Quote sent (yes/no)

### 4. Customer Communication

- Send immediate acknowledgment
- Provide estimated response time
- Include contact information
- Add disclaimer about rate validity

---

## Next Steps

1. **Import the workflow** into n8n
2. **Configure credentials** (email, Supabase)
3. **Test with sample data**
4. **Customize email template**
5. **Deploy to production**
6. **Monitor and optimize**

---

## Support Resources

- **RMS API Docs**: See `API_DOCUMENTATION.md`
- **n8n Documentation**: https://docs.n8n.io
- **GitHub Repository**: https://github.com/siduman268-debug/RMS-MCP-Server

---

*Generated for RMS MCP Server - n8n Integration Guide*

