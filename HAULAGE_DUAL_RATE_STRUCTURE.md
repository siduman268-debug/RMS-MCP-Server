# Haulage Dual Rate Structure - Critical Architecture Design

## 🚨 CRITICAL BUSINESS REQUIREMENT

**Carriers can offer TWO types of rates for inland origins:**

### Type 1: All-Inclusive Rate (Carrier Haulage)
```
Ocean Freight Rate: INSON (Sonipat) → NLRTM (Rotterdam)
├─ Includes: IHE (inland to port) + Ocean Freight
├─ Single price from customer's door
└─ Carrier handles everything
```

### Type 2: Separate Rates (Merchant Haulage or Itemized)
```
IHE Rate: INSON (Sonipat) → INMUN (Mundra Port)
+
Ocean Freight Rate: INMUN (Mundra) → NLRTM (Rotterdam)
├─ Two separate rates
├─ Customer can see breakdown
└─ More flexibility
```

---

## 📊 REAL-WORLD EXAMPLES

### Scenario A: Maersk Direct Inland Rate

**Maersk offers door-to-door service:**
```
Rate ID: 245
origin_code: INSON (Sonipat ICD)
destination_code: NLRTM (Rotterdam)
pol_id: points to INMUN (Mundra) - physical loading port
pod_id: points to NLRTM (Rotterdam)
buy_amount: $1,500 (includes IHE + Ocean)
container_type: 40HC

This is an ALL-INCLUSIVE rate!
```

**What this means:**
- ✅ Customer searches: INSON → NLRTM
- ✅ System finds rate: $1,500 (all-in)
- ✅ No need to add separate IHE
- ✅ pol_id tells us actual vessel loading port (INMUN)

### Scenario B: Separate IHE + Ocean Rate

**Same shipment, different pricing structure:**
```
IHE Rate:
  route_id: 12 (HR-INSON-INMUN-RD)
  from: INSON (Sonipat)
  to: INMUN (Mundra)
  rate_per_container: ₹18,000 ($216.87)
  vendor: ABC Logistics

Ocean Freight Rate:
  rate_id: 246
  origin_code: INMUN (Mundra)
  destination_code: NLRTM (Rotterdam)
  pol_id: INMUN
  pod_id: NLRTM
  buy_amount: $1,200
  vendor: Maersk

Total: $216.87 + $1,200 = $1,416.87
```

---

## 🏗️ DATABASE SCHEMA IMPLICATIONS

### Ocean Freight Rate Table

```sql
ocean_freight_rate
├─ origin_code VARCHAR(10)        -- Can be INLAND or PORT
├─ destination_code VARCHAR(10)   -- Can be INLAND or PORT
├─ pol_id UUID                    -- ALWAYS a port (vessel loading)
├─ pod_id UUID                    -- ALWAYS a port (vessel discharge)
├─ buy_amount NUMERIC             -- May or may not include IHE/IHI
└─ includes_inland_haulage BOOLEAN -- NEW FIELD NEEDED!
```

**Key Points:**
1. ✅ `origin_code` CAN be inland (e.g., INSON)
2. ✅ `pol_id` MUST be a port (e.g., INMUN)
3. ✅ If `origin_code ≠ pol.unlocode`, rate MAY include IHE
4. ✅ Need to know if IHE is bundled or separate

---

## 🔍 HOW TO DETERMINE RATE TYPE?

### Method 1: Check if Origin Matches POL

```typescript
const origin_is_inland = await checkIfInland(origin_code);
const pol_code = await getUnlocode(pol_id);

if (origin_is_inland && origin_code !== pol_code) {
  // Origin is inland, POL is different port
  // This rate MIGHT include IHE or MIGHT need separate IHE
  
  // Need to determine:
  // Option A: Rate includes IHE (all-inclusive)
  // Option B: Rate is port-to-port only (need separate IHE)
}
```

### Method 2: Add Flag to Database

```sql
-- Add new column to ocean_freight_rate
ALTER TABLE ocean_freight_rate 
  ADD COLUMN includes_ihe BOOLEAN DEFAULT FALSE,
  ADD COLUMN includes_ihi BOOLEAN DEFAULT FALSE;

-- Now we can query:
SELECT * FROM ocean_freight_rate
WHERE origin_code = 'INSON'
  AND destination_code = 'NLRTM'
  AND includes_ihe = TRUE;  -- All-inclusive rates only
```

### Method 3: Check Vendor/Contract Metadata

```sql
-- Add to vendor or contract table
vendor
├─ offers_door_to_door BOOLEAN
└─ inland_handling_policy TEXT  -- 'INCLUDED', 'SEPARATE', 'FLEXIBLE'

-- Or in contract
rate_contract
├─ ihe_handling TEXT  -- 'INCLUDED_IN_OCEAN', 'BILLED_SEPARATELY'
└─ ihi_handling TEXT
```

---

## 🎯 RECOMMENDED ARCHITECTURE

### Option A: Explicit Flag (Recommended)

**Add to `ocean_freight_rate` table:**
```sql
ALTER TABLE ocean_freight_rate 
  ADD COLUMN includes_inland_haulage JSONB DEFAULT '{"ihe": false, "ihi": false}'::jsonb;

-- Example values:
-- {"ihe": true, "ihi": false}  -- Rate includes IHE
-- {"ihe": false, "ihi": false} -- Port-to-port only
-- {"ihe": true, "ihi": true}   -- Door-to-door all-inclusive
```

**Usage in V4 API:**
```typescript
const rate = await findRate(origin_code, destination_code);

if (rate.origin_is_inland && !rate.includes_inland_haulage.ihe) {
  // Need to add separate IHE
  const ihe = await calculateIHE(origin_code, pol_code);
  total = rate.buy_amount + ihe.total_amount;
} else {
  // Rate already includes IHE
  total = rate.buy_amount;
}
```

### Option B: Rate Basis Field

**Add enum to specify what's included:**
```sql
ALTER TABLE ocean_freight_rate 
  ADD COLUMN rate_basis TEXT CHECK (rate_basis IN (
    'PORT_TO_PORT',      -- Exclude IHE/IHI
    'DOOR_TO_PORT',      -- Include IHE only
    'PORT_TO_DOOR',      -- Include IHI only
    'DOOR_TO_DOOR'       -- Include both IHE and IHI
  ));
```

**Usage:**
```typescript
const rate = await findRate(origin_code, destination_code);

switch (rate.rate_basis) {
  case 'PORT_TO_PORT':
    // Add IHE if origin is inland
    // Add IHI if destination is inland
    break;
  case 'DOOR_TO_PORT':
    // IHE included, but add IHI if needed
    break;
  case 'DOOR_TO_DOOR':
    // Nothing to add, all-inclusive
    break;
}
```

---

## 📋 USER EXPERIENCE IMPLICATIONS

### Search Results Display

When user searches: INSON → NLRTM

**Show both rate types:**
```
┌─────────────────────────────────────────────────────────┐
│ Option 1: Maersk All-Inclusive                         │
│ Rate: $1,500 (includes inland haulage)                 │
│ ├─ IHE: Included                                       │
│ ├─ Ocean: Included                                     │
│ └─ Total: $1,500                                       │
│ [Select] [Details]                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Option 2: MSC Port-to-Port + Separate Haulage         │
│ Rate: $1,200 (ocean only)                              │
│ ├─ IHE: $216.87 (separate)                            │
│ ├─ Ocean: $1,200                                       │
│ └─ Total: $1,416.87                                    │
│ [Select] [Details]                                     │
└─────────────────────────────────────────────────────────┘
```

### Rate Details Modal

```
Rate ID: 245
Vendor: Maersk
Origin: INSON (Sonipat ICD)
Destination: NLRTM (Rotterdam)

Routing:
├─ POL: INMUN (Mundra) ← Vessel loads here
├─ POD: NLRTM (Rotterdam)
└─ IHE: Included in rate ✅

Breakdown:
├─ Ocean Freight (INMUN → NLRTM): Not itemized
├─ IHE (INSON → INMUN): Included
└─ Total: $1,500
```

---

## 🔄 V4 API LOGIC UPDATE

### Current Logic (Simplified):

```typescript
// CURRENT (assumes IHE is always separate)
if (origin_is_inland) {
  ihe_charges = await calculateIHE(origin_code, pol_code);
  total = ocean_rate + ihe_charges;
}
```

### Updated Logic (Needed):

```typescript
// UPDATED (check if IHE is included)
const rate = await findRate(origin_code, destination_code);

// Check if origin is inland
const origin_is_inland = rate.origin_code !== rate.pol_code;

if (origin_is_inland) {
  // Check if rate includes IHE
  if (rate.includes_inland_haulage?.ihe) {
    // IHE already included in rate
    total = rate.buy_amount;
    breakdown = {
      ocean_with_ihe: rate.buy_amount,
      ihe: "included",
      total: rate.buy_amount
    };
  } else {
    // Need to add separate IHE
    const ihe = await calculateIHE(origin_code, pol_code);
    total = rate.buy_amount + ihe.total_amount;
    breakdown = {
      ocean: rate.buy_amount,
      ihe: ihe.total_amount,
      total: total
    };
  }
} else {
  // Origin is a port, no IHE needed
  total = rate.buy_amount;
}
```

---

## 🗂️ DATA ENTRY IMPLICATIONS

### When Creating Ocean Freight Rates:

**Form Fields:**
```
┌──────────────────────────────────────────────────────┐
│ Create Ocean Freight Rate                           │
├──────────────────────────────────────────────────────┤
│ Origin: [Lookup]  INSON (Sonipat ICD)              │
│ Destination: [Lookup]  NLRTM (Rotterdam)           │
│                                                      │
│ POL (Vessel Loading): [Lookup]  INMUN (Mundra) ←   │
│ POD (Vessel Discharge): [Lookup]  NLRTM           │
│                                                      │
│ ⚠️ Origin (INSON) is inland, POL (INMUN) is port   │
│                                                      │
│ This rate includes:                                 │
│ ☐ IHE (Inland Haulage Export: INSON → INMUN)      │
│ ☑ Ocean Freight (INMUN → NLRTM)                    │
│ ☐ IHI (Inland Haulage Import)                      │
│                                                      │
│ Rate Type:                                          │
│ ○ Port-to-Port ($1,200)                            │
│ ● All-Inclusive ($1,500) ← includes IHE            │
│                                                      │
│ Buy Amount: $1,500                                  │
└──────────────────────────────────────────────────────┘
```

### Validation Rules:

```typescript
if (origin_code !== pol_code) {
  // Origin is different from POL (inland origin)
  showWarning(`Origin (${origin_code}) is inland. POL is ${pol_code}.`);
  showField('includes_ihe_checkbox');
  
  if (includes_ihe) {
    showInfo('Rate price should include IHE charges');
  } else {
    showInfo('Separate IHE rate will be added during quote');
  }
}
```

---

## 📊 MIGRATION STRATEGY

### Step 1: Add New Column

```sql
ALTER TABLE ocean_freight_rate 
  ADD COLUMN includes_inland_haulage JSONB DEFAULT '{"ihe": false, "ihi": false}'::jsonb;

COMMENT ON COLUMN ocean_freight_rate.includes_inland_haulage IS 
  'Indicates whether rate includes inland haulage charges. 
   {"ihe": true} means IHE is bundled in buy_amount.
   {"ihe": false} means IHE needs to be calculated separately.';
```

### Step 2: Analyze Existing Data

```sql
-- Find rates where origin ≠ POL (potential door-to-door rates)
SELECT 
  ofr.id,
  ofr.origin_code,
  pol.unlocode as pol_code,
  ofr.buy_amount,
  v.name as vendor_name,
  CASE 
    WHEN ofr.origin_code != pol.unlocode THEN 'INLAND_ORIGIN'
    ELSE 'PORT_TO_PORT'
  END as rate_type
FROM ocean_freight_rate ofr
JOIN locations pol ON ofr.pol_id = pol.id
JOIN vendor v ON ofr.vendor_id = v.id
WHERE ofr.origin_code != pol.unlocode
ORDER BY vendor_name, origin_code;
```

### Step 3: Update Existing Rates

```sql
-- Mark rates as port-to-port by default
UPDATE ocean_freight_rate
SET includes_inland_haulage = '{"ihe": false, "ihi": false}'::jsonb
WHERE includes_inland_haulage IS NULL;

-- Manually review and update all-inclusive rates
-- (Requires business input - which vendors offer door-to-door?)
```

---

## ✅ UPDATED IMPLEMENTATION CHECKLIST

### Database Changes:
- [ ] Add `includes_inland_haulage` JSONB column to `ocean_freight_rate`
- [ ] Analyze existing rates (origin ≠ POL)
- [ ] Classify rates as PORT_TO_PORT or DOOR_TO_DOOR
- [ ] Update migration documentation

### API Changes:
- [ ] Update `/api/v4/search-rates` to check `includes_inland_haulage`
- [ ] Update `/api/v4/prepare-quote` to handle both rate types
- [ ] Update `simplified_inland_function` to respect flag
- [ ] Add API endpoint to toggle `includes_inland_haulage`

### LWC Changes:
- [ ] Add "Includes IHE/IHI" checkboxes to ocean freight form
- [ ] Show warning when origin ≠ POL
- [ ] Display rate breakdown clearly (all-inclusive vs itemized)
- [ ] Add filter: "Show all-inclusive rates only"

### Schema Constants:
- [ ] Add `RATE_INCLUSION_OPTIONS` for includes_inland_haulage
- [ ] Add validation for origin vs POL mismatch
- [ ] Add field type for JSONB

### Testing:
- [ ] Test all-inclusive rate (INSON → NLRTM, IHE included)
- [ ] Test port-to-port rate + separate IHE
- [ ] Test search results show both options
- [ ] Test quote calculation for both types

---

## 🎯 KEY TAKEAWAYS

### 1. **Two Rate Structures Coexist** ✅
```
Structure A: origin = INSON, POL = INMUN, includes_ihe = FALSE
  → Need separate IHE rate

Structure B: origin = INSON, POL = INMUN, includes_ihe = TRUE
  → IHE already bundled in price
```

### 2. **POL Always Shows Routing** ✅
```
pol_id → Always points to actual port where vessel loads
Even if rate is door-to-door, POL shows the gateway port
```

### 3. **Origin Can Be Inland** ✅
```
origin_code = INSON (inland ICD)
pol_code = INMUN (gateway port)
Rate can include journey from INSON to INMUN
```

### 4. **System Must Handle Both** ✅
```
V4 API logic:
  1. Check if origin_is_inland
  2. Check if rate.includes_ihe
  3. If (inland && !includes_ihe) → add IHE
  4. If (inland && includes_ihe) → use rate as-is
```

---

## 🚀 TOMORROW'S PRIORITY

### Morning (High Priority):
1. ✅ Add `includes_inland_haulage` column to schema constants
2. ✅ Update ocean freight CRUD to include this field
3. ✅ Add UI checkbox for "Includes IHE/IHI"
4. ✅ Test both rate structures

### Afternoon:
1. ✅ Update V4 API logic (if time permits)
2. ✅ Build haulage route/rate CRUD
3. ✅ Test complete flow

---

**THANK YOU for this critical clarification!** 🙏

This is a **fundamental architectural requirement** that changes how we:
1. Store ocean freight rates
2. Search for rates
3. Calculate totals
4. Display results to users

**Now our system will properly support both carrier models!** 🎉💪


