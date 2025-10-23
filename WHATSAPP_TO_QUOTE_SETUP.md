# WhatsApp to Quote Automation - Setup Guide

## Overview

This n8n workflow provides **end-to-end automation** from customer WhatsApp message to complete quote generation and Salesforce update.

### Workflow Flow:
```
WhatsApp Message 
  ↓
AI Agent Extracts Details
  ↓
Validate & Check Missing Info
  ↓ (if incomplete)
Send Clarification Request via WhatsApp
  ↓ (if complete)
Lookup Locations in Supabase
  ↓
Create Salesforce Enquiry
  ↓
Search Rates (V1)
  ↓
Prepare Quote (V1 - Ocean + Local Charges)
  ↓
Check if Inland Route
  ↓ (if inland)
Get Inland Haulage (V3 - IHE/IHI)
  ↓
Combine Pricing
  ↓
Update Salesforce with Quote
  ↓
Send Quote via WhatsApp
```

## Prerequisites

### 1. WhatsApp Business API Setup
- WhatsApp Business Account
- Meta (Facebook) Developer Account
- WhatsApp Business API Access Token
- Phone Number ID

**Get your credentials:**
1. Go to https://developers.facebook.com/
2. Create an app → Business Type → WhatsApp
3. Get your Access Token and Phone Number ID
4. Set up webhook URL for incoming messages

### 2. OpenAI API Key
For the AI agent to extract quote details:
- Sign up at https://platform.openai.com/
- Create API key
- Add credits to your account

### 3. Salesforce Setup

**Custom Objects Required:**
```apex
// Freight_Enquiry__c object with fields:
- Customer_Name__c (Text)
- Customer_Email__c (Email)
- Customer_Phone__c (Phone)
- POL__c (Text - Port of Loading)
- POD__c (Text - Port of Discharge)
- Container_Type__c (Picklist: 20GP, 40GP, 40HC)
- Container_Count__c (Number)
- Cargo_Weight_MT__c (Number)
- Status__c (Picklist: New, Quoted, Confirmed, Cancelled)
- Source__c (Text)
- Quote_ID__c (Text)
- Ocean_Freight_USD__c (Currency)
- Origin_Charges_USD__c (Currency)
- Destination_Charges_USD__c (Currency)
- IHE_Charges_USD__c (Currency)
- IHI_Charges_USD__c (Currency)
- Total_Quote_USD__c (Currency)
- Quote_Generated_At__c (DateTime)
```

**Create the custom object:**
1. Setup → Object Manager → Create → Custom Object
2. Add all fields above
3. Set up page layouts and permissions

### 4. n8n Setup
- n8n instance running (cloud or self-hosted)
- Install required nodes:
  - OpenAI / LangChain
  - PostgreSQL (for Supabase)
  - Salesforce
  - HTTP Request
  - Code (built-in)

## Configuration Steps

### Step 1: Import Workflow
1. Open n8n
2. Import `n8n-whatsapp-to-quote-workflow.json`
3. Activate the workflow

### Step 2: Configure WhatsApp Webhook
1. Open the "WhatsApp Webhook" node
2. Copy the webhook URL
3. Go to Meta Developer Console → WhatsApp → Configuration
4. Set Webhook URL and Verify Token
5. Subscribe to `messages` webhook event

### Step 3: Configure OpenAI Credentials
1. Click on "AI Extract Quote Details" node
2. Add OpenAI credentials (API key)
3. Select model: `gpt-4` or `gpt-4-turbo`

### Step 4: Configure Supabase (PostgreSQL)
1. Get your Supabase connection details:
   - Host: `db.[your-project-ref].supabase.co`
   - Database: `postgres`
   - User: `postgres`
   - Password: Your Supabase password
   - Port: `5432`
   - SSL: Enabled

2. Add credentials in n8n:
   - Name: "Supabase PostgreSQL"
   - Use the details above

3. Apply to both "Lookup POL" and "Lookup POD" nodes

### Step 5: Configure RMS API
The workflow uses these RMS endpoints:
- `POST /api/auth/token` - Get JWT token
- `POST /api/search-rates` - Search for rates (V1)
- `POST /api/prepare-quote` - Prepare quote with ocean freight and local charges (V1)
- `POST /api/v3/get-inland-haulage` - Get inland haulage charges (V3)

**Update URLs if your RMS server is not on localhost:**
- "Get RMS Token" node
- "Search Rates (V1)" node
- "Prepare Quote (V1 - Ocean + Local)" node
- "Get Inland Haulage (V3)" node

Replace `http://localhost:3000` with your server URL (e.g., `http://13.204.127.113:3000`)

### Step 6: Configure Salesforce
1. Add Salesforce OAuth2 credentials:
   - Environment: Production or Sandbox
   - Client ID & Secret (from Connected App)
   - Authorize n8n

2. Apply to both Salesforce nodes:
   - "Create Salesforce Enquiry"
   - "Update Salesforce with Quote"

### Step 7: Configure WhatsApp Sending
1. "Send Clarification Request" node:
   - Add HTTP Header Auth credential
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_WHATSAPP_ACCESS_TOKEN`

2. "Send Quote via WhatsApp" node:
   - Add the same credential

## Testing the Workflow

### Test Case 1: Complete Information
**Send WhatsApp message:**
```
Hi! I need a quote for shipping from Mumbai (INNSA) to Rotterdam (NLRTM).
Container: 1x 40HC
Weight: 25 metric tons
Contact: John Doe, john@example.com, +1234567890
```

**Expected Result:**
1. AI extracts all details
2. Salesforce enquiry created
3. Quote generated with ocean freight, local charges
4. Quote sent back via WhatsApp
5. Salesforce updated with quote details

### Test Case 2: Incomplete Information
**Send WhatsApp message:**
```
I need a quote from Mumbai to Rotterdam
```

**Expected Result:**
1. AI detects missing info (container type, weight)
2. Clarification request sent via WhatsApp
3. User provides missing details
4. Quote process continues

### Test Case 3: Inland Route (with IHE)
**Send WhatsApp message:**
```
Quote for Tughlakabad (INTKD) to Rotterdam (NLRTM)
Container: 1x 40HC, Weight: 25MT
Contact: Jane Smith, jane@example.com, +9876543210
```

**Expected Result:**
1. System detects POL is inland (ICD)
2. V1 API: Ocean freight + local charges
3. V3 API: IHE charges added (Tughlakabad to Nhava Sheva)
4. Combined quote sent to customer
5. Salesforce shows all charge breakdowns

## Monitoring & Debugging

### Check Execution Logs
1. n8n → Executions tab
2. Click on execution to see detailed flow
3. Check each node's input/output

### Common Issues

**Issue 1: AI extraction fails**
- Solution: Update system prompt in "AI Extract Quote Details" node
- Add more examples in the prompt

**Issue 2: Location lookup fails**
- Solution: Check Supabase connection
- Verify `locations` table has data
- Try fuzzy matching: `ILIKE '%MUMBAI%'`

**Issue 3: RMS token expired**
- Solution: Token is generated fresh for each execution
- Check server is running: `curl http://localhost:3000/health`

**Issue 4: Salesforce field mapping error**
- Solution: Verify custom field API names match exactly
- Check field types (Text, Currency, Number)

**Issue 5: WhatsApp message not sent**
- Solution: Check access token is valid
- Verify phone number format (E.164: +1234567890)
- Check WhatsApp Business API limits

## Customization Options

### 1. Add More AI Intelligence
Update the system prompt to:
- Detect urgency
- Extract additional requirements (hazmat, refrigerated, etc.)
- Understand multiple languages

### 2. Add Email Notifications
After "Update Salesforce with Quote" node, add:
- Email node to send quote PDF to customer
- CC to sales team

### 3. Add Approval Workflow
Before "Send Quote via WhatsApp", add:
- Manual approval step (Ask user)
- Conditional routing based on quote amount
- Slack notification to manager

### 4. Add Payment Link
In the WhatsApp quote message, include:
- Payment link (Stripe, PayPal)
- Terms & conditions link
- Booking confirmation link

## Performance Optimization

### Caching
- Cache location lookups (POL/POD)
- Cache FX rates
- Use n8n's built-in caching

### Parallel Execution
- Run "Lookup POL" and "Lookup POD" in parallel
- Use n8n's "Split In Batches" for multiple containers

### Error Handling
- Add "Error Trigger" node
- Send error notifications to admin
- Retry failed API calls

## Compliance & Security

### Data Privacy
- Store customer data securely in Salesforce
- GDPR compliance: Allow data deletion
- Encrypt sensitive fields

### WhatsApp Policy
- Follow WhatsApp Business Policy
- Use approved message templates
- Respect 24-hour messaging window

### API Security
- Use HTTPS for all API calls
- Rotate JWT tokens regularly
- Implement rate limiting

## Next Steps

1. **Test extensively** with real customer scenarios
2. **Train your team** on the workflow
3. **Monitor performance** and optimize
4. **Collect feedback** from customers
5. **Iterate and improve** the AI prompts

## Support

For issues or questions:
- Check n8n community: https://community.n8n.io/
- RMS MCP Server docs: `API_DOCUMENTATION.md`
- WhatsApp Business API docs: https://developers.facebook.com/docs/whatsapp/

---

**Congratulations! 🎉** You now have a fully automated WhatsApp-to-Quote system powered by AI!

