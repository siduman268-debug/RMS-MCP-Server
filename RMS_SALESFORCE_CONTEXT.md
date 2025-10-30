# RMS Salesforce Implementation - Context Document

## 📋 Project Overview

**Project**: Build a complete Rate Management System (RMS) frontend in Salesforce  
**Org**: Catupult PBI Dev Org  
**Approach**: Use Salesforce Flows, Lightning Pages, and Apex Actions (NO custom LWC for multi-org configurability)  
**Backend**: RMS API at `http://13.204.127.113:3000`  
**Status**: ✅ **Phase 1 - API Integration COMPLETE** | ⚠️ **Phase 2 - UI Enhancements IN PROGRESS**
- ✅ Core API integration working
- ✅ Simple Flow successfully retrieving rate data
- ⚠️ Need to add lookup fields, Data Table, and action buttons

---

## 🏗️ Architecture

### **Data Flow**
```
User → Salesforce Flow → Apex Invocable Action → RMS API → Response → Display
```

### **Key Components**
1. **Salesforce Flows**: Screen flows for all user interactions
2. **Apex Actions**: Invocable methods calling RMS API
3. **Named Credential**: `RMS_API` pointing to `http://13.204.127.113:3000`
4. **Custom Objects**: Location Master, Rate, Vendor, Contract, Surcharge, Margin Rule

---

## 🔐 Authentication

### **RMS API Authentication**
- **Method**: JWT Token-based
- **Tenant ID**: `00000000-0000-0000-0000-000000000001`
- **Token Endpoint**: `POST /api/auth/token`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `x-tenant-id: <tenant_uuid>`
  - `Content-Type: application/json`

### **Token Generation (in Apex)**
```apex
// RMSApiUtil.getAuthToken()
HttpRequest req = new HttpRequest();
req.setEndpoint('callout:RMS_API/api/auth/token');
req.setMethod('POST');
req.setHeader('Content-Type', 'application/json');
req.setBody('{"tenant_id": "00000000-0000-0000-0000-000000000001"}');

HttpResponse res = http.send(req);
Map<String, Object> response = JSON.deserializeUntyped(res.getBody());
return (String) response.get('token');
```

---

## 📊 Custom Objects & Field Mappings

### **Location Master** (`Catupult__Location_Master__c`)
- **Name**: `Name` (e.g., "Nhava Sheva (JNPT)")
- **Unlocode**: `Catupult__Unlocode__c` (e.g., "INNSA")
- **Location Type**: `Location_Type__c` (SEAPORT, ICD, etc.)
- **Country Code**: `Country_Code__c`

### **Ocean Freight Rate** (to be created or exists)
- **POL Code**: `POL_Code__c`
- **POD Code**: `POD_Code__c`
- **Container Type**: `Container_Type__c` (20GP, 40GP, 40HC, 45HC)
- **Buy Amount**: `Buy_Amount__c`
- **Currency**: `Currency__c`
- **Transit Days**: `Transit_Days__c`
- **Valid From**: `Valid_From__c`
- **Valid To**: `Valid_To__c`
- **Is Preferred**: `Is_Preferred__c`
- **Vendor ID**: `Vendor_ID__c`
- **Contract ID**: `Contract_ID__c`

### **Vendor**
- **Name**: `Name`
- **Type**: `Type__c` (ocean_carrier, forwarder, etc.)
- **Alias**: `Alias__c`
- **Is Active**: `Is_Active__c`

### **Contract**
- **Vendor ID**: `Vendor_ID__c`
- **Contract Number**: `Contract_Number__c`
- **Valid From**: `Valid_From__c`
- **Valid To**: `Valid_To__c`
- **Is Active**: `Is_Active__c`

### **Surcharge**
- **Vendor ID**: `Vendor_ID__c`
- **Contract ID**: `Contract_ID__c`
- **Charge Code**: `Charge_Code__c` (THC, BAF, CAF, etc.)
- **Amount**: `Amount__c`
- **Currency**: `Currency__c`
- **UOM**: `UOM__c` (per_container, per_cbm, etc.)
- **Applies Scope**: `Applies_Scope__c` (origin, destination, freight)
- **Container Type**: `Container_Type__c`
- **Valid From/To**: `Valid_From__c`, `Valid_To__c`

### **Margin Rule**
- **Level**: `Level__c` (global, port-pair, trade-zone)
- **POL Code**: `POL_Code__c`
- **POD Code**: `POD_Code__c`
- **Mark Kind**: `Mark_Kind__c` (pct, flat)
- **Mark Value**: `Mark_Value__c`
- **Priority**: `Priority__c`
- **Valid From/To**: `Valid_From__c`, `Valid_To__c`

---

## 🔄 Current Work: Search Rates Flow

### **Flow Name**: `RMS_Ocean_Freight_Rate_Search` (and `test1` - Simple Test Flow)

### **✅ WORKING - Simple Test Flow**
- **Flow Name**: `test1` or `RMS Simple Rate flow`
- **Status**: ✅ **FULLY WORKING**
- **Structure**: Input Screen → Apex Action → Results Screen
- **Test Results**: Successfully retrieving 3 rates (MSC, Maersk, Hapag-Lloyd)
- **API Call**: Working correctly with `/api/search-rates` endpoint
- **Data Returned**: Full JSON with rate details (IDs: 71, 74, 77)

### **Flow Structure (Full Flow - In Progress)**
1. **Screen 1**: Search Ocean Freight Rates
   - POL Code (Text Input) → stores in `POL_Code_Input` ⚠️ **TODO**: Change to Lookup
   - POD Code (Text Input) → stores in `POD_Code_Input` ⚠️ **TODO**: Change to Lookup
   - Container Type (Text Input) → stores in `Container_Type_Input` ⚠️ **TODO**: Change to Picklist

2. **Apex Action**: Get Rates
   - Action: "Get Ocean Freight Rates"
   - Inputs:
     - POL Code: `{!POL_Code_Input}` (e.g., "INNSA")
     - POD Code: `{!POD_Code_Input}` (e.g., "NLRTM")
     - Container Type: `{!Container_Type_Input}` (e.g., "40HC")
   - Outputs:
     - `isSuccess` (Boolean) → `{!API_Success}`
     - `message` (Text) → `{!API_Message}`
     - `rates` (Text - JSON string) → `{!Rates_JSON}` ⚠️ Using JSON string instead of complex objects

3. **Screen 2**: Results
   - Display Text: `Success: {!API_Success}, Message: {!API_Message}`
   - Display Text: `Rates Data: {!Rates_JSON}`

### **✅ RESOLVED Issues**

**✅ Issue A: API Response Field Mismatch - FIXED**
- ✅ Updated Apex class to use `POST /api/search-rates` endpoint
- ✅ Fixed parsing to handle nested `pricing` and `validity` objects
- ✅ Correctly maps: `rate_id` → `id`, `pricing.ocean_freight_buy` → `buyAmount`, `validity.from` → `validFrom`, etc.

**✅ Issue B: Flow Fault - RESOLVED**
- ✅ Flow now works correctly without faults
- ✅ API authentication working properly
- ✅ Data retrieval successful

**✅ Issue C: Data Table Display - WORKAROUND IMPLEMENTED**
- ✅ Using JSON string output (`rates` as Text) instead of complex objects
- ✅ Displaying JSON in Display Text component
- ⚠️ **TODO**: Create proper Data Table with lookup fields later

### **Current Issues**

**Issue D: Lookup Fields Not Working**
- ⚠️ Currently using text inputs instead of lookup fields
- ⚠️ Need to implement proper lookup to `Catupult__Location_Master__c`
- **Next Step**: Replace text inputs with lookup components

**Issue E: Data Not Actionable**
- ⚠️ Currently displaying JSON data only
- ⚠️ Need to create actual `Catupult__Ocean_Freight_Rate__c` records
- ⚠️ Need to add Data Table with action buttons
- **Next Step**: Implement record creation and Data Table display

### **Variables Used (Current Working Flow)**
- `POL_Code_Input` (Text, Input) - POL Code entered by user (e.g., "INNSA")
- `POD_Code_Input` (Text, Input) - POD Code entered by user (e.g., "NLRTM")
- `Container_Type_Input` (Text, Input) - Container type entered by user (e.g., "40HC")
- `API_Success` (Boolean) - Stores API success status
- `API_Message` (Text) - Stores API response message
- `Rates_JSON` (Text) - Stores rates data as JSON string

### **Variables Needed (For Enhanced Flow with Lookups)**
- `polRecordId` (Text) - Stores selected POL location's Record ID (from lookup)
- `podRecordId` (Text) - Stores selected POD location's Record ID (from lookup)
- `polLocationRecord` (Record) - Full POL location record (from Get Records)
- `podLocationRecord` (Record) - Full POD location record (from Get Records)
- `varPOLCode` (Text) - Extracted UN/LOCODE for POL (e.g., "INNSA")
- `varPODCode` (Text) - Extracted UN/LOCODE for POD (e.g., "NLRTM")

### **Test Data**
- **POL**: Nhava Sheva (JNPT) - UNLOCODE: INNSA
- **POD**: Port of Rotterdam - UNLOCODE: NLRTM
- **Container Type**: 40HC
- **Expected Results**: 3 rates (MSC, Maersk, Hapag-Lloyd)

---

## 💻 Apex Classes

### **RMSApiUtil.cls** (Utility Class)
**Purpose**: Handle all RMS API communications

**Key Methods**:
```apex
// Get JWT authentication token
public static String getAuthToken()

// Make authenticated API call
public static HttpResponse makeApiCall(String endpoint, String method, String body)

// Build endpoint with query parameters
public static String buildEndpoint(String endpoint, Map<String, String> queryParams)

// Convenience methods
public static HttpResponse makeGetRequest(String endpoint)
public static HttpResponse makePostRequest(String endpoint, String body)
public static HttpResponse makePutRequest(String endpoint, String body)
public static HttpResponse makeDeleteRequest(String endpoint)
```

**Configuration**:
- Named Credential: `RMS_API`
- Tenant ID: `00000000-0000-0000-0000-000000000001`

---

### **RMSOceanFreightRateAction.cls** (Invocable Action)
**Purpose**: Search for ocean freight rates

**Invocable Method**: `getOceanFreightRates`

**Request Class**:
```apex
public class OceanFreightRateRequest {
    @InvocableVariable(label='POL Code' required=true)
    public String polCode;
    
    @InvocableVariable(label='POD Code' required=true)
    public String podCode;
    
    @InvocableVariable(label='Container Type' required=true)
    public String containerType;
    
    @InvocableVariable(label='Contract ID')
    public Integer contractId;
}
```

**Response Class**:
```apex
public class OceanFreightRateResponse {
    @InvocableVariable(label='Success')
    public Boolean isSuccess;
    
    @InvocableVariable(label='Message')
    public String message;
    
    @InvocableVariable(label='Rates')
    public String rates; // JSON string (changed from List<OceanFreightRateWrapper> to work around Flow Builder limitations)
}
```

**Wrapper Class** (CRITICAL - Must have @InvocableVariable for Flow visibility):
```apex
public class OceanFreightRateWrapper {
    @InvocableVariable(label='Rate ID')
    public String id;
    
    @InvocableVariable(label='POL Code')
    public String polCode;
    
    @InvocableVariable(label='POD Code')
    public String podCode;
    
    @InvocableVariable(label='Container Type')
    public String containerType;
    
    @InvocableVariable(label='Buy Amount')
    public Decimal buyAmount;
    
    @InvocableVariable(label='Currency')
    public String currencyCode;
    
    @InvocableVariable(label='Transit Time (Days)')
    public Integer ttDays;
    
    @InvocableVariable(label='Contract ID')
    public Integer contractId;
    
    @InvocableVariable(label='Valid From')
    public String validFrom;
    
    @InvocableVariable(label='Valid To')
    public String validTo;
}
```

**API Call**: `POST /api/search-rates` ✅ **CURRENTLY IMPLEMENTED**

**Request Body**:
```json
{
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "contract_id": null
}
```

**✅ API Response Format - CORRECTLY PARSED**:
- The Apex class uses `POST /api/search-rates` (formatted endpoint)
- This endpoint returns formatted response with nested `pricing` and `validity` objects
- Response structure:
  ```json
  {
    "success": true,
    "data": [{
      "rate_id": 71,
      "vendor": "MSC",
      "route": "...",
      "container_type": "40HC",
      "transit_days": 18,
      "pricing": {
        "ocean_freight_buy": 1950,
        "currency": "USD"
      },
      "validity": {
        "from": "2025-10-07",
        "to": "2026-01-05"
      }
    }]
  }
  ```
- ✅ **FIXED**: Apex class correctly parses nested objects (`pricing.ocean_freight_buy` → `buyAmount`, `validity.from` → `validFrom`)
- ✅ **WORKING**: Returns JSON string to Flow for display

---

## 🔧 Salesforce Setup

### **Named Credential: RMS_API**
- **Label**: RMS API
- **Name**: RMS_API
- **URL**: `http://13.204.127.113:3000`
- **Identity Type**: Named Principal
- **Authentication Protocol**: No Authentication (JWT handled in code)
- **Generate Authorization Header**: Unchecked
- **Allow Merge Fields in HTTP Header**: Checked
- **Allow Merge Fields in HTTP Body**: Checked

### **Remote Site Setting**
- **Remote Site Name**: RMS_API
- **Remote Site URL**: `http://13.204.127.113:3000`
- **Active**: Checked

---

## 🎯 RMS API Endpoints Reference

### **Authentication**
- `POST /api/auth/token` - Get JWT token

### **Ocean Freight Rates**
- `POST /api/search-rates` - Search rates with formatted response (vendor, route, pricing structure) - **RECOMMENDED for user-facing flows**
- `GET /api/ocean-freight-rates` - List rates from materialized view (current Apex implementation - ⚠️ field name mismatch)
- `POST /api/ocean-freight-rates` - Create rate
- `PUT /api/ocean-freight-rates/:rateId` - Update rate
- `GET /api/ocean-freight-rates/:rateId` - Get single rate
- `DELETE /api/ocean-freight-rates/:rateId` - Delete rate

### **Vendors & Contracts**
- ⚠️ **NOT YET IMPLEMENTED** - These CRUD endpoints do not exist in the current API
- Vendor and Contract data is managed through other means or may need to be added in future

### **Surcharges**
- `POST /api/surcharges` - Create surcharge
- `PUT /api/surcharges/:surchargeId` - Update
- `GET /api/surcharges` - List with filters
- `DELETE /api/surcharges/:surchargeId` - Delete

### **Margin Rules**
- `POST /api/margin-rules` - Create rule
- `PUT /api/margin-rules/:ruleId` - Update rule
- `GET /api/margin-rules` - List rules
- `DELETE /api/margin-rules/:ruleId` - Delete rule

### **Sample API Response Formats**

**Format 1: `POST /api/search-rates` (Formatted - Recommended)**
```json
{
  "success": true,
  "data": [
    {
      "vendor": "MSC",
      "route": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
      "container_type": "40HC",
      "transit_days": 18,
      "pricing": {
        "ocean_freight_buy": 1950,
        "freight_surcharges": 289.85,
        "all_in_freight_buy": 2239.85,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 223.99
        },
        "all_in_freight_sell": 2463.84,
        "currency": "USD"
      },
      "validity": {
        "from": "2025-10-07",
        "to": "2026-01-05"
      },
      "is_preferred": true,
      "rate_id": 71
    }
  ]
}
```

**Format 2: `GET /api/ocean-freight-rates` (Materialized View - Current Implementation)**
```json
{
  "success": true,
  "data": [
    {
      "rate_id": 71,
      "pol_code": "INNSA",
      "pod_code": "NLRTM",
      "container_type": "40HC",
      "carrier": "MSC",
      "ocean_freight_buy": 1950,
      "freight_surcharges": 289.85,
      "all_in_freight_buy": 2239.85,
      "all_in_freight_sell": 2463.84,
      "currency": "USD",
      "transit_days": 18,
      "is_preferred": true,
      "valid_from": "2025-10-07",
      "valid_to": "2026-01-05"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "count": 1
  }
}
```

**⚠️ Note**: Current Apex class (`RMSOceanFreightRateAction.cls`) is configured for Format 2 but has field mapping issues. Consider switching to `POST /api/search-rates` for better formatted output.

---

## 🐛 Known Issues & Solutions

### **Issue 1: Data Table Fields Not Visible**
**Problem**: Apex wrapper fields don't appear in Flow Builder's Data Table column picker  
**Cause**: Salesforce metadata cache not refreshing after Apex changes  
**Solutions**:
1. Wait 2-3 minutes after Apex deployment
2. Open incognito browser window
3. Delete and recreate the Apex Action element in flow
4. **Workaround**: Use Display Text or Loop + formatted display instead of Data Table

### **Issue 2: Picklist Choice Configuration**
**Problem**: Creating Choice resources for picklists is complex  
**Solution**: Use Text field with help text for container type, or create Choice resources properly with plain text labels (not merge fields)

### **Issue 3: Flow Fault "An unhandled fault has occurred"**
**Debugging Steps**:
1. Add fault paths to all elements
2. Create error screen showing `{!$Flow.FaultMessage}`
3. Check Debug Logs (Setup → Debug Logs → View log details)
4. Add Decision elements after Get Records to verify data is retrieved
5. Add Display Text screens between elements to show variable values

### **Issue 4: Location Lookup Returns Null**
**Problem**: Get Records not finding location  
**Possible Causes**:
- Lookup field not storing Record ID properly
- Record ID variable wrong type (should be Text)
- Location doesn't exist in database
**Solution**: Verify location exists and has UNLOCODE value

---

## ✅ Completed Work

### **Phase 1: API Integration (COMPLETE)** ✅
1. ✅ Created Search Ocean Freight Rates screen flow structure
2. ✅ Set up Named Credential and Remote Site Setting
3. ✅ Enhanced Apex wrapper class with @InvocableVariable annotations
4. ✅ Fixed API endpoint to use `POST /api/search-rates`
5. ✅ Fixed JSON parsing to handle nested `pricing` and `validity` objects
6. ✅ Fixed Flow Builder compatibility (using JSON string output)
7. ✅ Verified RMS API is accessible and returning data
8. ✅ Successfully tested Flow - retrieving real rate data (3 rates confirmed)
9. ✅ Verified API authentication working correctly

### **Phase 2: UI Enhancements (IN PROGRESS)** ⚠️
10. ⚠️ **TODO**: Replace text inputs with lookup fields for POL/POD
11. ⚠️ **TODO**: Create container type picklist with correct values (20GP, 40GP, 40HC, 45HC)
12. ⚠️ **TODO**: Set up Get Records elements for POL and POD locations (if using lookups)
13. ⚠️ **TODO**: Create Assignment element to extract UNLOCODEs (if using lookups)
14. ⚠️ **TODO**: Add Data Table component for displaying rates
15. ⚠️ **TODO**: Add action buttons (Create Quote, Save to Opportunity, etc.)
16. ⚠️ **TODO**: Create actual `Catupult__Ocean_Freight_Rate__c` records from API data

---

## 🎯 Next Steps (Immediate)

### **Priority 1: Add Lookup Fields** 🔴
1. Replace text inputs with lookup fields for POL/POD
2. Use `Catupult__Location_Master__c` object for lookups
3. Extract UNLOCODE from selected location records
4. Test lookup functionality

### **Priority 2: Make Data Actionable** 🔴
1. Add Data Table component to display rates in table format
2. Query `Catupult__Ocean_Freight_Rate__c` records (need to verify actual field names first)
3. Add action buttons for each rate:
   - "Create Quote" button
   - "Save to Opportunity" button
   - Other actionable buttons
4. Create actual records from API data (if needed)

### **Priority 3: Enhance User Experience** 🟡
1. Add proper error handling and user-friendly messages
2. Add loading indicators
3. Add validation for inputs
4. Improve results display formatting

### **Priority 4: Build Remaining CRUD Flows** 🟢
1. Create Rate Flow
2. Update Rate Flow
3. Surcharge Management Flow
4. Margin Rule Management Flow

---

## 📚 Reference Links

- **RMS API Documentation**: See uploaded API_DOCUMENTATION.md
- **React Proof of Concept**: See uploaded App.js
- **Salesforce Flow Best Practices**: Use fault paths, validate inputs, display clear messages
- **Apex Invocable Pattern**: All wrapper classes need @InvocableVariable for Flow visibility

---

## 👥 Team & Contact

- **User**: Siddarthi (siddarthi@propelor.io_dev)
- **Org**: Catupult PBI Dev
- **Timezone**: Singapore (GMT+08:00)
- **RMS API Server**: http://13.204.127.113:3000

---

## 📝 Notes

- **Multi-Org Strategy**: Avoid custom LWC - use only Flows, standard components, and Apex Actions
- **Data Strategy**: API-first (data lives in RMS API, Salesforce is just UI)
- **Error Handling**: Always add fault paths and user-friendly error messages
- **Testing**: Test with real data (INNSA → NLRTM, 40HC)
- **Security**: JWT tokens expire in 1 hour, tenant isolation enforced at API level

---

## 🔄 Version History

- **2025-01-27 (Today)**: Major breakthrough - Flow working! ✅
  - ✅ **Fixed API endpoint**: Changed from `GET /api/ocean-freight-rates` to `POST /api/search-rates`
  - ✅ **Fixed JSON parsing**: Updated to handle nested `pricing` and `validity` objects
  - ✅ **Fixed Flow Builder compatibility**: Changed `rates` output from complex object to JSON string
  - ✅ **Verified API connection**: Tested directly on VM - API working correctly
  - ✅ **Successfully tested Flow**: Simple test flow retrieving 3 rates (MSC, Maersk, Hapag-Lloyd)
  - ✅ **Cleaned up code**: Removed unused methods, fixed field mappings
  - **Status**: Core API integration working! Next: Add lookups, Data Table, and action buttons

- **2025-10-29**: Context document created and aligned with codebase
- **Status**: Search Rates Flow 80% complete, needs API response field mapping fix
- **Key Alignment Issues Fixed**:
  - ✅ Corrected object name: `Catupult__Location_Master__c` (was `Catapult_Location_Master__c`)
  - ✅ Corrected flow name: `RMS_Ocean_Freight_Rate_Search` (removed `Catupult__` prefix)
  - ✅ Removed non-existent Vendor/Contract API endpoints
  - ✅ Documented API response format mismatch issue
  - ✅ Clarified difference between `POST /api/search-rates` vs `GET /api/ocean-freight-rates`

---

**End of Context Document**
