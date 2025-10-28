# RMS Flow - API Integration Steps

## 🔗 **Step-by-Step: Connect Flow to RMS API**

### **Prerequisites:**
✅ Three fields added to Flow screen:
- Port of Loading (Lookup to Location Master)
- Port of Discharge (Lookup to Location Master)
- Container Type (Picklist)

---

## **Step 1: Extract Port Codes from Lookup Fields**

After your Screen element, add an **Assignment** element:

### **Assignment: Extract Port Codes**
1. Click the **"+"** after your Screen element
2. Select **"Assignment"**
3. Label: `"Extract Port Codes"`
4. Add these assignments:

**Variable to Set:**
- **Variable**: `varPOLCode` (Text) - Create if it doesn't exist
- **Value**: `{!varPOLLocation.Name}` OR `{!varPOLLocation.Catupult__Location_Code__c}`
  - (Use whichever field on Location Master contains the port code like "INNSA", "USLAX")

- **Variable**: `varPODCode` (Text) - Create if it doesn't exist  
- **Value**: `{!varPODLocation.Name}` OR `{!varPODLocation.Catupult__Location_Code__c}`

**Note:** Replace `varPOLLocation` and `varPODLocation` with the actual variable names you're using to store the lookup values.

---

## **Step 2: Call RMS API Action**

### **A. Add Action Element**
1. After the Assignment, click **"+"**
2. Select **"Action"**
3. Find **"Get Ocean Freight Rates"** (from RMSOceanFreightRateAction class)
4. Click to add it

### **B. Configure Action Inputs**
Set these input parameters:
- **polCode**: `{!varPOLCode}` (from assignment above)
- **podCode**: `{!varPODCode}` (from assignment above)
- **containerType**: `{!ContainerType}` (from your screen picklist)
- **contractId**: (Leave blank or create a variable if needed)

### **C. Store Output**
The action returns a response object. Store it in a variable:
- **Variable**: `varRateResponse` (Create new variable)
  - Data Type: **Record** (or use the response object from the action)
  - Or access directly: `{!Get_Ocean_Freight_Rates.rates}`

---

## **Step 3: Check if API Call Succeeded**

Add a **Decision** element:

### **Decision: Check Success**
1. After the Action, click **"+"**
2. Select **"Decision"**
3. Label: `"Check API Success"`
4. Add Outcome:
   - **Outcome Name**: `"Success"`
   - **Condition**: `{!Get_Ocean_Freight_Rates.isSuccess}` equals `{!$GlobalConstant.True}`
5. Default Outcome: `"Error"`

---

## **Step 4: Display Results**

### **A. Success Path - Results Screen**
1. From "Success" outcome, click **"+"**
2. Select **"Screen"**
3. Label: `"Rate Results"`
4. Add components to display:
   - **Display Text**: Show the message `{!Get_Ocean_Freight_Rates.message}`
   - **Data Table** or **Display Text** to show rates:
     - Loop through `{!Get_Ocean_Freight_Rates.rates}` if it's a collection
     - Display: POL Code, POD Code, Container Type, Buy Amount, Currency, Transit Days

### **B. Error Path - Error Screen**
1. From "Error" outcome, click **"+"**
2. Select **"Screen"**
3. Label: `"Error Message"`
4. Add **Display Text**: Show `{!Get_Ocean_Freight_Rates.message}`

---

## **Complete Flow Structure:**

```
Start
  ↓
Screen: Search Ocean Freight Rate
  ├─ Lookup: Port of Loading → varPOLLocation
  ├─ Lookup: Port of Discharge → varPODLocation
  └─ Picklist: Container Type → ContainerType
  ↓
Assignment: Extract Port Codes
  ├─ varPOLCode = {!varPOLLocation.Name} (or Location_Code field)
  └─ varPODCode = {!varPODLocation.Name} (or Location_Code field)
  ↓
Action: Get Ocean Freight Rates
  ├─ polCode = {!varPOLCode}
  ├─ podCode = {!varPODCode}
  ├─ containerType = {!ContainerType}
  └─ contractId = (optional)
  ↓
Decision: Check Success
  ├─ True → Display Results Screen
  └─ False → Display Error Screen
```

---

## **Important Notes:**

### **1. Variable Names:**
Replace variable names with your actual ones:
- If your lookup stores to: `varPOLLocation`, `varPODLocation`
- If your picklist stores to: `ContainerType`
- Adjust the formulas accordingly

### **2. Location Code Field:**
You need to know which field on Location Master has the port code:
- Check: Setup → Object Manager → Location Master → Fields & Relationships
- Common names: `Name`, `Location_Code__c`, `Catupult__Location_Code__c`, `UNLOCODE__c`

### **3. API Response Structure:**
The `Get_Ocean_Freight_Rates` action returns:
- `isSuccess` (Boolean)
- `message` (String)
- `rates` (Collection of rate objects)

### **4. Displaying Collection:**
To display multiple rates, use:
- **Loop** element to iterate through `{!Get_Ocean_Freight_Rates.rates}`
- Or display as a formatted string

---

## **Quick Start:**

1. **First, identify which field contains the port code** on Location Master
2. **Create the Assignment element** to extract codes
3. **Add the Action element** and configure inputs
4. **Add Decision** to check success
5. **Add Screens** to display results

**Start with Step 1 - create the Assignment element to extract the port codes!** 🚀

