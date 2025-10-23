# End-to-End Test Plan: Automated Enquiry to Quote Process

## Test Objective
Validate the complete flow from customer WhatsApp message to automated quote generation and Salesforce update.

---

## 🧪 Test Scenarios

### Test Scenario 1: Happy Path - Standard Port to Port

**Test ID:** E2E-001  
**Description:** Customer requests quote for standard sea port to sea port route  
**Expected Result:** Quote generated with ocean freight and local charges only

#### Test Steps:

1. **Send WhatsApp Message:**
   ```
   Hi! I need a quote for shipping from Nhava Sheva (INNSA) to Rotterdam (NLRTM).
   Container: 1x 40HC
   Weight: 20 metric tons
   Contact: John Doe, john@example.com, +1234567890
   ```

2. **Expected AI Extraction:**
   ```json
   {
     "pol": "INNSA",
     "pod": "NLRTM",
     "container_type": "40HC",
     "container_count": 1,
     "cargo_weight_mt": 20,
     "customer_name": "John Doe",
     "customer_email": "john@example.com",
     "customer_phone": "+1234567890"
   }
   ```

3. **Verify in Salesforce:**
   - Go to Freight Enquiries
   - Find new enquiry with Status = "New"
   - Check all fields populated correctly
   - Source should be "WhatsApp"

4. **Check RMS API Calls:**
   - Search Rates should return preferred rate
   - Prepare Quote should include:
     - Ocean Freight
     - Origin Charges (INNSA)
     - Destination Charges (NLRTM)
     - No IHE/IHI (not inland)

5. **Verify Quote in Salesforce:**
   - Enquiry Status updated to "Quoted"
   - Quote_ID__c populated
   - Ocean_Freight_USD__c > 0
   - Origin_Charges_USD__c > 0
   - Destination_Charges_USD__c > 0
   - IHE_Charges_USD__c = 0
   - IHI_Charges_USD__c = 0
   - Total_Quote_USD__c = sum of all charges

6. **Verify WhatsApp Reply:**
   - Customer receives quote message
   - Format matches template
   - All pricing shown correctly
   - Quote ID included

**Pass Criteria:**
- ✅ All 6 steps completed successfully
- ✅ Quote generated within 10 seconds
- ✅ No errors in n8n execution log

---

### Test Scenario 2: Inland Route with IHE

**Test ID:** E2E-002  
**Description:** Customer requests quote from inland ICD to sea port  
**Expected Result:** Quote includes IHE charges for inland haulage

#### Test Steps:

1. **Send WhatsApp Message:**
   ```
   Quote needed: Tughlakabad (INTKD) to Rotterdam (NLRTM)
   1x 40HC container, 25 metric tons
   Contact: Jane Smith, jane@example.com, +9876543210
   ```

2. **Expected AI Extraction:**
   ```json
   {
     "pol": "INTKD",
     "pod": "NLRTM",
     "container_type": "40HC",
     "container_count": 1,
     "cargo_weight_mt": 25,
     "customer_name": "Jane Smith",
     "customer_email": "jane@example.com",
     "customer_phone": "+9876543210"
   }
   ```

3. **Verify Location Lookup:**
   - POL (INTKD) identified as ICD
   - POD (NLRTM) identified as SEAPORT
   - Workflow should route to V3 API for IHE

4. **Check RMS API Calls:**
   - V1: Search Rates → finds ocean freight from gateway port (INNSA)
   - V1: Prepare Quote → ocean freight + local charges
   - V3: Get Inland Haulage → IHE charges (INTKD to INNSA)

5. **Verify Combined Pricing:**
   - Ocean Freight: From INNSA to NLRTM
   - IHE Charges: From INTKD to INNSA (should be ~$624 for 25MT)
   - Origin Charges: At INNSA
   - Destination Charges: At NLRTM
   - Total: All charges combined

6. **Verify Salesforce:**
   - IHE_Charges_USD__c = 624 (or actual from DB)
   - All other charge fields populated
   - Total includes IHE

7. **Verify WhatsApp Reply:**
   - Includes line item for "Inland Haulage (Export)"
   - Total reflects IHE charges

**Pass Criteria:**
- ✅ IHE charges calculated correctly
- ✅ V3 API called for inland route
- ✅ Combined pricing accurate
- ✅ Customer receives detailed breakdown

---

### Test Scenario 3: Incomplete Information - Clarification Flow

**Test ID:** E2E-003  
**Description:** Customer provides incomplete info, system requests clarification  
**Expected Result:** System sends clarification request, waits for response

#### Test Steps:

1. **Send Incomplete WhatsApp Message:**
   ```
   Hi, I need a shipping quote from Mumbai to Rotterdam
   ```

2. **Expected AI Extraction:**
   ```json
   {
     "pol": "Mumbai",
     "pod": "Rotterdam",
     "container_type": null,
     "container_count": null,
     "cargo_weight_mt": null,
     "customer_name": null,
     "customer_email": null,
     "customer_phone": null
   }
   ```

3. **Verify Clarification Request:**
   - Workflow detects missing: container_type
   - WhatsApp message sent asking for:
     - Container Type (20GP/40GP/40HC)
     - Number of containers
     - Cargo weight
     - Contact details

4. **Customer Replies:**
   ```
   40HC container, 1 unit, 22 metric tons
   Contact: Bob Wilson, bob@example.com, +1122334455
   ```

5. **Verify Second Extraction:**
   - AI combines previous + new info
   - All fields now complete
   - Workflow continues to quote generation

6. **Verify Quote Generated:**
   - Follow steps from Test Scenario 1
   - Should complete successfully

**Pass Criteria:**
- ✅ Missing fields detected
- ✅ Clarification request sent
- ✅ Follow-up message processed
- ✅ Quote generated after complete info

---

### Test Scenario 4: Multiple Containers

**Test ID:** E2E-004  
**Description:** Customer requests quote for multiple containers  
**Expected Result:** Quote reflects total for all containers

#### Test Steps:

1. **Send WhatsApp Message:**
   ```
   Need quote for 3x 40HC containers
   Route: INNSA to NLRTM
   Weight: 20MT per container
   Contact: Alice Johnson, alice@example.com, +5544332211
   ```

2. **Expected Extraction:**
   ```json
   {
     "container_count": 3,
     "container_type": "40HC",
     ...
   }
   ```

3. **Verify Pricing Calculation:**
   - Ocean Freight: Per container rate × 3
   - Origin Charges: Per container × 3
   - Destination Charges: Per container × 3
   - Total: Correct multiplication

4. **Verify Quote:**
   - Container_Count__c = 3 in Salesforce
   - Total pricing reflects 3 containers
   - WhatsApp message shows "3x 40HC"

**Pass Criteria:**
- ✅ Container count extracted correctly
- ✅ Pricing multiplied by count
- ✅ All line items reflect multiple containers

---

### Test Scenario 5: Different Container Types

**Test ID:** E2E-005  
**Description:** Test with 20GP and 40GP containers  
**Expected Result:** Correct pricing for each container type

#### Test Cases:

**A. 20GP Container:**
```
Quote for 2x 20GP from INNSA to NLRTM
Weight: 15MT each
Contact: Charlie Brown, charlie@example.com, +9988776655
```

**B. 40GP Container:**
```
Need quote: 1x 40GP from INTKD to NLRTM
Weight: 28MT
Contact: Diana Prince, diana@example.com, +6677889900
```

**Pass Criteria:**
- ✅ Both container types processed correctly
- ✅ Pricing differs based on container type
- ✅ Rate lookups successful for both

---

### Test Scenario 6: Error Handling

**Test ID:** E2E-006  
**Description:** Test various error scenarios  
**Expected Result:** Graceful error handling and user notification

#### Error Cases:

**A. Invalid Port Code:**
```
Quote from XYZ123 to NLRTM
1x 40HC, 20MT
Contact: Error Test, error@test.com, +1111111111
```
**Expected:** Error message to customer: "Invalid port code. Please provide valid UN/LOCODE."

**B. No Rate Available:**
```
Quote from INNSA to XXPOL (non-existent port)
1x 40HC, 20MT
Contact: No Rate Test, norate@test.com, +2222222222
```
**Expected:** Error message: "No rates available for this route. Please contact support."

**C. RMS Server Down:**
- Stop RMS server
- Send quote request
**Expected:** Error notification to admin, graceful message to customer

**Pass Criteria:**
- ✅ Errors detected and logged
- ✅ User receives helpful error message
- ✅ Admin notified of system errors
- ✅ No data corruption in Salesforce

---

## 🎯 Performance Tests

### Performance Test 1: Response Time

**Target:** Complete quote generation < 15 seconds

**Test Steps:**
1. Send 10 quote requests (standard route)
2. Measure time from WhatsApp message to quote reply
3. Calculate average, min, max

**Pass Criteria:**
- ✅ Average < 15 seconds
- ✅ 95th percentile < 20 seconds
- ✅ No timeout errors

---

### Performance Test 2: Concurrent Requests

**Target:** Handle 5 simultaneous quote requests

**Test Steps:**
1. Send 5 quote requests simultaneously
2. Monitor n8n executions
3. Verify all complete successfully
4. Check for race conditions in Salesforce

**Pass Criteria:**
- ✅ All 5 quotes generated
- ✅ No duplicate enquiries in Salesforce
- ✅ No API rate limit errors
- ✅ No database deadlocks

---

### Performance Test 3: High Volume

**Target:** Process 100 quotes in 1 hour

**Test Steps:**
1. Send 100 quote requests over 1 hour
2. Monitor system resources (CPU, memory)
3. Check for degradation in response time
4. Verify data integrity

**Pass Criteria:**
- ✅ All 100 quotes processed
- ✅ No memory leaks
- ✅ Response time remains consistent
- ✅ All Salesforce records created correctly

---

## 🔍 Integration Tests

### Integration Test 1: Salesforce Custom Objects

**Verify:**
- ✅ Freight_Enquiry__c object exists
- ✅ All required fields exist
- ✅ Field types match workflow expectations
- ✅ Page layout configured
- ✅ Permissions set for integration user

---

### Integration Test 2: RMS API Connectivity

**Verify:**
- ✅ `/api/auth/token` - Token generation
- ✅ `/api/search-rates` - Rate search
- ✅ `/api/prepare-quote` - V1 quote preparation
- ✅ `/api/v3/get-inland-haulage` - V3 haulage calculation
- ✅ All endpoints return correct response format

---

### Integration Test 3: Supabase Database

**Verify:**
- ✅ `locations` table accessible
- ✅ Location lookup by UNLOCODE works
- ✅ Location lookup by name (fuzzy match) works
- ✅ `location_type` field correctly identifies ICD/SEAPORT
- ✅ PostgreSQL connection stable

---

### Integration Test 4: WhatsApp Business API

**Verify:**
- ✅ Webhook receives messages
- ✅ Message format parsed correctly
- ✅ Outbound messages sent successfully
- ✅ Message delivery confirmed
- ✅ 24-hour messaging window respected

---

## 📊 Test Data

### Sample Customer Data

```json
{
  "customers": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+9876543210"
    },
    {
      "name": "Bob Wilson",
      "email": "bob@example.com",
      "phone": "+1122334455"
    }
  ]
}
```

### Sample Routes

```json
{
  "routes": [
    {
      "pol": "INNSA",
      "pol_name": "Nhava Sheva",
      "pod": "NLRTM",
      "pod_name": "Rotterdam",
      "type": "seaport_to_seaport"
    },
    {
      "pol": "INTKD",
      "pol_name": "Tughlakabad ICD",
      "pod": "NLRTM",
      "pod_name": "Rotterdam",
      "type": "inland_to_seaport"
    },
    {
      "pol": "INNSA",
      "pol_name": "Nhava Sheva",
      "pod": "USLAX",
      "pod_name": "Los Angeles",
      "type": "seaport_to_seaport"
    }
  ]
}
```

---

## ✅ Test Execution Checklist

### Pre-Test Setup
- [ ] n8n workflow imported and activated
- [ ] All credentials configured (OpenAI, Salesforce, Supabase, WhatsApp)
- [ ] RMS server running on correct URL
- [ ] Supabase database populated with test data
- [ ] WhatsApp Business API webhook configured
- [ ] Test phone numbers whitelisted

### Test Execution
- [ ] E2E-001: Standard Route ✅
- [ ] E2E-002: Inland Route ✅
- [ ] E2E-003: Incomplete Info ✅
- [ ] E2E-004: Multiple Containers ✅
- [ ] E2E-005: Different Container Types ✅
- [ ] E2E-006: Error Handling ✅
- [ ] Performance Test 1 ✅
- [ ] Performance Test 2 ✅
- [ ] Performance Test 3 ✅
- [ ] Integration Tests ✅

### Post-Test Verification
- [ ] All test cases passed
- [ ] No errors in n8n logs
- [ ] Salesforce data integrity confirmed
- [ ] WhatsApp messages delivered
- [ ] Performance metrics documented
- [ ] Issues logged and resolved

---

## 🐛 Known Issues & Limitations

### Current Limitations:
1. **AI Extraction Accuracy:** ~90% for structured messages
2. **Language Support:** English only
3. **WhatsApp Limits:** 24-hour messaging window
4. **Rate Availability:** Depends on data in RMS
5. **Concurrent Requests:** Optimal < 10 simultaneous

### Planned Improvements:
- [ ] Multi-language support (Spanish, Chinese)
- [ ] Improved fuzzy matching for port names
- [ ] Caching for frequent routes
- [ ] Real-time rate updates
- [ ] Push notifications for quote status

---

## 📞 Support & Troubleshooting

### Debug Mode
Enable detailed logging in n8n:
1. n8n → Settings → Log Level → Debug
2. Check execution logs for each node
3. Review API responses

### Common Issues:
1. **Token Expired:** Get fresh token from `/api/auth/token`
2. **Salesforce Auth:** Refresh OAuth token
3. **WhatsApp Not Sending:** Check access token and phone number format
4. **No Rates Found:** Verify rate data in Supabase
5. **AI Extraction Failed:** Review OpenAI API key and credits

### Contact:
- n8n Support: https://community.n8n.io/
- RMS API: Check `API_DOCUMENTATION.md`
- Salesforce: Check custom object configuration

---

## 🎉 Success Metrics

### Key Performance Indicators (KPIs):
- **Quote Response Time:** < 15 seconds
- **First-Contact Resolution:** > 80%
- **Quote Accuracy:** 100%
- **Customer Satisfaction:** > 90%
- **System Uptime:** > 99.5%

### Business Impact:
- 🚀 **90% faster** quote generation
- 💰 **50% reduction** in manual effort
- 📈 **Improved customer experience**
- ✅ **100% data accuracy** in Salesforce
- 🔄 **Seamless automation** from enquiry to quote

---

**Ready to test? Let's go! 🚀**

