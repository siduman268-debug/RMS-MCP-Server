# RMS Flow - Lookup Field Configuration Guide

## 📋 **Flow Screen Updates**

### **Current Flow Screen: "Search Ocean Freight Rate"**

### **Step 1: Update Port of Loading Lookup**

1. **Edit your Flow Screen**
2. **Find the "Port of Loading" lookup component**
3. **Update the Field API Name:**
   - Current: `POLCode` (variable)
   - New: Connect to `Catupult_POL__c` field on Ocean_Freight_Rate__c object

**Configuration:**
- **Field API Name**: `Catupult_POL__c`
- **Object**: `Catupult__Location_Master__c`
- **Field API Name (on Location Master)**: `Catupult__Location_Code__c` (or the code field)

### **Step 2: Update Port of Discharge Lookup**

1. **Find the "Port of Discharge" lookup component**
2. **Update the Field API Name:**
   - Current: `PODCode` (variable)
   - New: Connect to `Catupult_POD__c` field on Ocean_Freight_Rate__c object

**Configuration:**
- **Field API Name**: `Catupult_POD__c`
- **Object**: `Catupult__Location_Master__c`
- **Field API Name (on Location Master)**: `Catupult__Location_Code__c` (or the code field)

### **Step 3: Add Flow Logic After Screen**

After the Screen element, add these steps:

#### **A. Create/get Ocean Freight Rate Record**
- **Action**: Create Records or Get Records
- **Object**: `Ocean_Freight_Rate__c` (use Catupult__Ocean_Freight_Rate__c if that's the API name)
- **Store values from Screen**:
  - `Catupult_POL__c` = from Screen → Port of Loading lookup
  - `Catupult_POD__c` = from Screen → Port of Discharge lookup
  - `Container_Type__c` = from Screen → Container Type picklist

#### **B. Extract Port Codes from Lookup**

Add an **Assignment** element to extract the port code:

```
Variables to Set:
- varPOLCode (Text) = {Ocean_Freight_Rate__c.Catupult_POL__r.Catupult__Location_Code__c}
- varPODCode (Text) = {Ocean_Freight_Rate__c.Catupult_POD__r.Catupult__Location_Code__c}
```

**Or** use formula to get the location code from the related record:
- `{!$Record.Catupult_POL__r.Catupult__Location_Code__c}`

#### **C. Call RMS API Action**

Connect to **RMSOceanFreightRateAction**:
- **Inputs**:
  - `polCode` = `{!varPOLCode}` (from assignment above)
  - `podCode` = `{!varPODCode}` (from assignment above)
  - `containerType` = `{!ContainerType}` (from screen)
  - `contractId` = (optional, from screen or variable)

#### **D. Display Results**

Add a **Screen** element to show results:
- Display the rates returned from the API action

## 🔧 **Complete Flow Structure**

```
Start
  ↓
Screen: Search Ocean Freight Rate
  ├─ Lookup: Port of Loading → Catupult_POL__c → Location Master
  ├─ Lookup: Port of Discharge → Catupult_POD__c → Location Master
  └─ Picklist: Container Type
  ↓
Assignment: Extract Port Codes
  ├─ varPOLCode = {Record.Catupult_POL__r.Catupult__Location_Code__c}
  └─ varPODCode = {Record.Catupult_POD__r.Catupult__Location_Code__c}
  ↓
Action: Get Ocean Freight Rates (RMSOceanFreightRateAction)
  ├─ polCode = varPOLCode
  ├─ podCode = varPODCode
  ├─ containerType = ContainerType (from screen)
  └─ contractId = (optional)
  ↓
Decision: Check Success
  ├─ Success → Display Results Screen
  └─ Error → Display Error Screen
```

## 📝 **Key Configuration Points**

### **In Flow Screen Builder:**
1. **Lookup Component Properties:**
   - **Field API Name**: `Catupult_POL__c` (or `Catupult_POD__c`)
   - **Object API Name**: `Catupult__Ocean_Freight_Rate__c`
   - **Lookup Target**: `Catupult__Location_Master__c`

2. **Variable Mapping:**
   - Store lookup value in a variable (e.g., `varPOLLocation`)
   - Extract code using relationship: `{!varPOLLocation.Catupult__Location_Code__c}`

3. **API Action Input:**
   - Convert lookup ID to location code
   - Pass code string to RMS API

## 🎯 **Alternative: Use Variables**

If direct field reference doesn't work, use variables:

1. **In Screen:**
   - Lookup stores to `varPOLLocation` (Object: Location Master)
   - Lookup stores to `varPODLocation` (Object: Location Master)

2. **After Screen - Assignment:**
   ```
   varPOLCode = {!varPOLLocation.Catupult__Location_Code__c}
   varPODCode = {!varPODLocation.Catupult__Location_Code__c}
   ```

3. **Pass to API:**
   - `polCode` = `{!varPOLCode}`
   - `podCode` = `{!varPODCode}`

## 🔍 **Field Names Reference**

Based on your Fields & Relationships:
- **Lookup Fields**: `Catupult_POL__c`, `Catupult_POD__c`
- **Text Code Fields**: `Catupult_POL_Code__c`, `Catupult_POD_Code__c`
- **Location Master**: `Catupult__Location_Master__c`
- **Location Code Field**: Need to verify (could be `Name`, `Catupult__Location_Code__c`, or similar)

**Next Step**: Check Location Master object to find the code field name!

