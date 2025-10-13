# n8n Workflow Setup - Step-by-Step Guide

## Quick Setup for RMS Freight Quote Automation

### Prerequisites
- ✅ n8n Community Edition running on VM
- ✅ RMS MCP Server running on `http://localhost:3000` (or accessible IP)
- 📝 Note: If RMS server is on a different machine, replace `localhost:3000` with the actual IP/hostname

---

## Workflow 1: Simple Quote Generator

### Step 1: Create New Workflow

1. Open n8n web interface
2. Click **"+ Add workflow"**
3. Name it: **"RMS Quote Generator"**

---

### Step 2: Add Webhook Trigger

1. Click **"+"** to add first node
2. Search for **"Webhook"**
3. Select **"Webhook"** trigger
4. Configure:
   - **HTTP Method**: POST
   - **Path**: `rms-quote`
   - **Response Mode**: Last Node
5. Click **"Execute Node"** to get the webhook URL
6. **Copy the webhook URL** (you'll need this for testing)

---

### Step 3: Add HTTP Request - Search Rates

1. Click **"+"** after Webhook node
2. Search for **"HTTP Request"**
3. Configure:
   - **Method**: POST
   - **URL**: `http://localhost:3000/api/search-rates`
   - **Send Body**: ON
   - **Body Content Type**: JSON
   - **JSON/RAW Parameters**:
     ```json
     {
       "pol_code": "={{ $json.body.pol_code }}",
       "pod_code": "={{ $json.body.pod_code }}",
       "container_type": "={{ $json.body.container_type }}"
     }
     ```
4. Click **"Execute Node"** to test

---

### Step 4: Add HTTP Request - Prepare Quote

1. Click **"+"** after Search Rates node
2. Add another **"HTTP Request"**
3. Configure:
   - **Method**: POST
   - **URL**: `http://localhost:3000/api/prepare-quote`
   - **Send Body**: ON
   - **Body Content Type**: JSON
   - **JSON/RAW Parameters**:
     ```json
     {
       "customer_name": "={{ $('Webhook').item.json.body.customer_name }}",
       "pol_code": "={{ $('Webhook').item.json.body.pol_code }}",
       "pod_code": "={{ $('Webhook').item.json.body.pod_code }}",
       "container_type": "={{ $('Webhook').item.json.body.container_type }}",
       "container_count": "={{ $('Webhook').item.json.body.container_count || 1 }}"
     }
     ```
4. Rename this node to **"Prepare Quote"**

---

### Step 5: Add Code Node - Format Response

1. Click **"+"** after Prepare Quote
2. Search for **"Code"**
3. Select **"Code"** node
4. Mode: **Run Once for All Items**
5. Paste this code:
```javascript
const quote = $input.first().json.data;

return [{
  json: {
    success: true,
    quote_number: `QT-${Date.now().toString().slice(-6)}`,
    customer: quote.customer_name || 'N/A',
    route: quote.quote_summary.route_display,
    carrier: quote.quote_summary.vendor_info.carrier,
    transit_days: quote.quote_summary.vendor_info.transit_days,
    containers: quote.quote_summary.container_info,
    
    pricing: {
      ocean_freight: quote.totals.ocean_freight_total.toFixed(2),
      origin_charges_usd: quote.totals.origin_total_usd.toFixed(2),
      destination_charges_usd: quote.totals.destination_total_usd.toFixed(2),
      grand_total: quote.totals.grand_total_usd.toFixed(2)
    },
    
    origin_charges: quote.quote_parts.origin_charges.charges.map(c => ({
      name: c.charge_name,
      amount: `${c.charge_amount} ${c.charge_currency}`,
      usd: c.amount_usd.toFixed(2)
    })),
    
    destination_charges: quote.quote_parts.destination_charges.charges.map(c => ({
      name: c.charge_name,
      amount: `${c.charge_amount} ${c.charge_currency}`,
      usd: c.amount_usd.toFixed(2)
    })),
    
    validity: quote.quote_parts.ocean_freight.validity
  }
}];
```
6. Rename to **"Format Quote"**

---

### Step 6: Save & Activate

1. Click **"Save"** (top right)
2. Toggle **"Active"** switch ON
3. Your webhook is now live!

---

## Testing the Workflow

### Test Payload

Use this JSON to test your webhook:

```json
{
  "customer_name": "Acme Corporation",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 2
}
```

### Using PowerShell (from your Windows machine)

```powershell
$body = @{
  customer_name = "Acme Corporation"
  pol_code = "INNSA"
  pod_code = "NLRTM"
  container_type = "40HC"
  container_count = 2
} | ConvertTo-Json

Invoke-RestMethod -Uri "YOUR_WEBHOOK_URL_HERE" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Using curl (from VM or any terminal)

```bash
curl -X POST YOUR_WEBHOOK_URL_HERE \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Acme Corporation",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 2
  }'
```

### Expected Response

```json
{
  "success": true,
  "quote_number": "QT-123456",
  "customer": "Acme Corporation",
  "route": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
  "carrier": "MSC",
  "transit_days": 18,
  "containers": "2x 40HC",
  "pricing": {
    "ocean_freight": "4927.68",
    "origin_charges_usd": "279.52",
    "destination_charges_usd": "882.34",
    "grand_total": "6089.54"
  },
  "origin_charges": [
    {
      "name": "Documentation Fee",
      "amount": "1800 INR",
      "usd": "21.69"
    }
  ],
  "destination_charges": [
    {
      "name": "Delivery Order Fee",
      "amount": "50 EUR",
      "usd": "58.82"
    }
  ],
  "validity": {
    "from": "2025-10-07",
    "to": "2026-01-05"
  }
}
```

---

## Workflow 2: Add Email Notification (Optional)

### Step 7: Add Email Node

1. After **"Format Quote"**, click **"+"**
2. Search for **"Send Email"** (or Gmail, Outlook, etc.)
3. Configure based on your email provider:

#### Using Gmail:
- Add Gmail credentials in n8n
- **To**: `={{ $('Webhook').item.json.body.customer_email }}`
- **Subject**: `Your Freight Quote - {{ $json.quote_number }}`
- **Email Type**: HTML
- **HTML Content**:
```html
<h2>Freight Quote {{ $json.quote_number }}</h2>

<p>Dear {{ $json.customer }},</p>

<p>Thank you for your enquiry. Please find your quote below:</p>

<h3>Route Details</h3>
<ul>
  <li><strong>Route:</strong> {{ $json.route }}</li>
  <li><strong>Carrier:</strong> {{ $json.carrier }}</li>
  <li><strong>Transit Time:</strong> {{ $json.transit_days }} days</li>
  <li><strong>Container:</strong> {{ $json.containers }}</li>
</ul>

<h3>Pricing</h3>
<table border="1" cellpadding="10" style="border-collapse: collapse;">
  <tr>
    <td>Ocean Freight</td>
    <td align="right">${{ $json.pricing.ocean_freight }}</td>
  </tr>
  <tr>
    <td>Origin Charges</td>
    <td align="right">${{ $json.pricing.origin_charges_usd }}</td>
  </tr>
  <tr>
    <td>Destination Charges</td>
    <td align="right">${{ $json.pricing.destination_charges_usd }}</td>
  </tr>
  <tr style="background-color: #f0f0f0; font-weight: bold;">
    <td>GRAND TOTAL</td>
    <td align="right">${{ $json.pricing.grand_total }} USD</td>
  </tr>
</table>

<p><strong>Valid Until:</strong> {{ $json.validity.to }}</p>

<p>Best regards,<br>Your Freight Team</p>
```

---

## Workflow 3: Advanced - Multi-Route Comparison

### Additional Nodes Needed:

1. **Split In Batches** - To process multiple routes
2. **HTTP Request (Loop)** - Search rates for each route
3. **Merge** - Combine all results
4. **Code** - Compare and rank by price
5. **Email** - Send comparison report

### Code for Comparison:

```javascript
// After merging all route quotes
const quotes = $input.all().map(item => item.json);

const comparison = quotes.map(q => ({
  route: q.route,
  carrier: q.carrier,
  total: parseFloat(q.pricing.grand_total),
  transit: q.transit_days
})).sort((a, b) => a.total - b.total);

const bestOption = comparison[0];
const savings = comparison[comparison.length - 1].total - bestOption.total;

return [{
  json: {
    best_option: bestOption,
    all_options: comparison,
    potential_savings: savings.toFixed(2),
    comparison_count: comparison.length
  }
}];
```

---

## Connecting to Your VM

### If RMS Server is on Different Machine:

Replace `http://localhost:3000` with:
- **Same network**: `http://192.168.x.x:3000`
- **Remote server**: `http://your-server-ip:3000`
- **With domain**: `http://rms-api.yourcompany.com`

### Network Configuration:

1. **Check RMS Server IP**:
   ```powershell
   ipconfig
   ```
   Look for IPv4 Address

2. **Update Workflow URLs**:
   - In each HTTP Request node
   - Change `localhost` to actual IP

3. **Test Connectivity**:
   ```powershell
   Invoke-RestMethod -Uri "http://YOUR_VM_IP:3000/health"
   ```

---

## Quick Test Scenarios

### Scenario 1: Single Container Quote
```json
{
  "customer_name": "ABC Trading",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "20GP",
  "container_count": 1
}
```

### Scenario 2: Multiple Containers
```json
{
  "customer_name": "XYZ Imports",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 5
}
```

### Scenario 3: Different Route
```json
{
  "customer_name": "Global Logistics",
  "pol_code": "CNSHA",
  "pod_code": "USNYC",
  "container_type": "40GP",
  "container_count": 3
}
```

---

## Troubleshooting

### Issue: Webhook not receiving data

**Solution**:
1. Check if workflow is **Active** (green toggle)
2. Verify webhook URL is correct
3. Test with n8n's built-in test feature

### Issue: HTTP Request fails

**Check**:
1. RMS Server is running: Test `http://YOUR_IP:3000/health`
2. URL is correct (check IP address)
3. Firewall allows port 3000
4. Request body format is valid JSON

### Issue: Empty results

**Check**:
1. Port codes exist in database (INNSA, NLRTM, etc.)
2. Container type is valid (20GP, 40GP, 40HC)
3. Preferred rates exist for the route
4. Check RMS Server logs

---

## Visual Workflow Layout

```
[Webhook] → [Search Rates] → [Prepare Quote] → [Format] → [Response]
              ↓
           (Check if rates found)
              ↓
           [Get Local Charges] (optional detail view)
```

---

## Next Steps

1. **Build the basic workflow** (Steps 1-6 above)
2. **Test with sample data**
3. **Add email notification** (if needed)
4. **Customize the response format**
5. **Connect to your systems** (CRM, Email, etc.)

---

## Pro Tips

### 1. Use Sticky Notes
Add notes to document your workflow:
- Right-click canvas → Add Sticky Note
- Document what each section does

### 2. Error Handling
Add error workflows:
- In HTTP Request → Settings → On Error → Continue
- Add IF node to check `$json.success`

### 3. Test with Manual Trigger
Before activating webhook:
- Use **"Manual Trigger"** instead of Webhook
- Click **"Execute Workflow"** with test data
- Debug each node output

### 4. Save Different Versions
- Save workflow often
- Duplicate before major changes
- Export workflow JSON as backup

---

## Import Pre-built Workflow (Alternative)

If you prefer to import the ready-made workflow:

1. In n8n, click **"..."** menu (top right)
2. Select **"Import from file"**
3. Choose `n8n-workflow-example.json`
4. Update the HTTP Request URLs if needed
5. Configure email credentials
6. Activate!

---

## What's Your VM Setup?

To help you configure correctly, please share:
- **VM IP address**: Where is n8n running?
- **RMS Server location**: Same VM or different machine?
- **Network**: Local network or internet accessible?

Then I can provide exact configuration for your setup!

---

*Ready to start building? Open n8n and let's go through it step by step!*

