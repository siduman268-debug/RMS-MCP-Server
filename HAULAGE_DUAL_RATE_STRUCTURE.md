# Haulage Dual Rate Structure - Critical Architecture Design

## 🚨 CRITICAL BUSINESS REQUIREMENT

**Carriers can offer THREE types of rates for BOTH inland origins (IHE) AND inland destinations (IHI):**

### Type 1: All-Inclusive Rate (Door-to-Door Bundled)
```
Ocean Freight Rate: INSON (Sonipat) → DEHAM (Hamburg Inland)
├─ origin_code: INSON (inland origin)
├─ destination_code: DEHAM (inland destination)
├─ pol_id: INMUN (Mundra - vessel loading)
├─ pod_id: DEHAM_PORT (Hamburg Port - vessel discharge)
├─ buy_amount: $1,800 (IHE + Ocean + IHI bundled)
├─ includes_ihe: TRUE
├─ includes_ihi: TRUE
└─ Carrier handles everything, single all-inclusive price
```

**For Origin Only (IHE):**
```
Ocean Freight Rate: INSON (Sonipat) → NLRTM (Rotterdam Port)
├─ origin_code: INSON (inland origin)
├─ destination_code: NLRTM (port destination)
├─ includes_ihe: TRUE
├─ includes_ihi: FALSE (destination is a port)
└─ buy_amount: $1,500 (IHE + Ocean bundled)
```

**For Destination Only (IHI):**
```
Ocean Freight Rate: INMUN (Mundra Port) → DEHAM (Hamburg Inland)
├─ origin_code: INMUN (port origin)
├─ destination_code: DEHAM (inland destination)
├─ includes_ihe: FALSE (origin is a port)
├─ includes_ihi: TRUE
└─ buy_amount: $1,300 (Ocean + IHI bundled)
```

### Type 2: Inland Location Pricing + Separate Haulage (Hybrid Model)
```
Ocean Freight Rate: INSON (Sonipat) → DEHAM (Hamburg Inland)
├─ origin_code: INSON (inland origin as pricing point)
├─ destination_code: DEHAM (inland destination as pricing point)
├─ pol_id: INMUN (Mundra - actual vessel loading)
├─ pod_id: DEHAM_PORT (Hamburg Port - actual vessel discharge)
├─ buy_amount: $1,400 (ocean only, priced from/to inland)
├─ includes_ihe: FALSE
├─ includes_ihi: FALSE
+
IHE Rate: INSON → INMUN
├─ rate_per_container: ₹18,000 ($216.87)
└─ Billed separately
+
IHI Rate: DEHAM_PORT → DEHAM
├─ rate_per_container: €300 ($320)
└─ Billed separately

Total: $216.87 + $1,400 + $320 = $1,936.87
```

**For Origin Only:**
```
Ocean: INSON → NLRTM (Rotterdam Port)
├─ origin_code: INSON (inland pricing point)
├─ destination_code: NLRTM (port)
├─ includes_ihe: FALSE
+
IHE: INSON → INMUN ($216.87)

Total: $1,200 + $216.87 = $1,416.87
```

**For Destination Only:**
```
Ocean: INMUN → DEHAM (Hamburg Inland)
├─ origin_code: INMUN (port)
├─ destination_code: DEHAM (inland pricing point)
├─ includes_ihi: FALSE
+
IHI: DEHAM_PORT → DEHAM ($320)

Total: $1,300 + $320 = $1,620
```

**Key Point**: Ocean rate uses inland locations for pricing/commercial purposes, but POL/POD show actual vessel ports for routing.

### Type 3: Gateway Port Pricing + Separate Haulage (Traditional Model)
```
IHE Rate: INSON → INMUN (Mundra Port)
├─ rate_per_container: ₹18,000 ($216.87)
+
Ocean Freight Rate: INMUN → DEHAM_PORT (Hamburg Port)
├─ origin_code: INMUN (gateway port as pricing point)
├─ destination_code: DEHAM_PORT (gateway port as pricing point)
├─ pol_id: INMUN
├─ pod_id: DEHAM_PORT
├─ buy_amount: $1,200
├─ includes_ihe: FALSE
├─ includes_ihi: FALSE
+
IHI Rate: DEHAM_PORT → DEHAM (Hamburg Inland)
├─ rate_per_container: €300 ($320)

Total: $216.87 + $1,200 + $320 = $1,736.87
```

**For Origin Only:**
```
IHE: INSON → INMUN ($216.87)
+
Ocean: INMUN → NLRTM (Rotterdam Port)
├─ origin_code: INMUN (port)
├─ destination_code: NLRTM (port)

Total: $216.87 + $1,200 = $1,416.87
```

**For Destination Only:**
```
Ocean: INMUN → DEHAM_PORT (Hamburg Port)
├─ origin_code: INMUN (port)
├─ destination_code: DEHAM_PORT (port)
+
IHI: DEHAM_PORT → DEHAM ($320)

Total: $1,300 + $320 = $1,620
```

**Key Point**: Ocean rate uses gateway ports only, customer must add IHE/IHI separately for any inland locations.

---

## 📊 REAL-WORLD EXAMPLES

### Scenario A: All-Inclusive Door-to-Door (Type 1)

**Maersk offers bundled door-to-door service:**
```
Rate ID: 245
origin_code: INSON (Sonipat ICD)
destination_code: NLRTM (Rotterdam)
pol_id: UUID → INMUN (Mundra) - physical loading port
pod_id: UUID → NLRTM (Rotterdam)
buy_amount: $1,500 (IHE + Ocean bundled)
includes_ihe: TRUE
container_type: 40HC

This is an ALL-INCLUSIVE rate!
```

**What this means:**
- ✅ Customer searches: INSON → NLRTM
- ✅ System finds rate: $1,500 (all-in)
- ✅ No need to add separate IHE
- ✅ pol_id tells us actual vessel loading port (INMUN)
- ✅ IHE is bundled in the $1,500

### Scenario B: Inland Origin Pricing + Separate IHE (Type 2) - **NEW!**

**MSC uses inland location as pricing origin, bills IHE separately:**
```
Ocean Freight Rate:
  rate_id: 246
  origin_code: INSON (inland as pricing point)
  destination_code: NLRTM (Rotterdam)
  pol_id: UUID → INMUN (Mundra - actual vessel loading)
  pod_id: UUID → NLRTM (Rotterdam)
  buy_amount: $1,200 (ocean freight only)
  includes_ihe: FALSE
  vendor: MSC

IHE Rate:
  route_id: 12 (HR-INSON-INMUN-RD)
  from_location_id: UUID → INSON (Sonipat)
  to_location_id: UUID → INMUN (Mundra)
  rate_per_container: ₹18,000 ($216.87)
  vendor: ABC Logistics or MSC

Total: $1,200 + $216.87 = $1,416.87
```

**What this means:**
- ✅ Customer searches: INSON → NLRTM
- ✅ System finds ocean rate with origin = INSON
- ✅ origin_code ≠ pol.unlocode → Inland origin detected
- ✅ includes_ihe = FALSE → Need to add separate IHE
- ✅ System calculates IHE from INSON → INMUN
- ✅ Total = Ocean + IHE

**Commercial Logic:**
- Carrier prices ocean freight FROM inland point (competitive positioning)
- But IHE is billed as separate line item
- Customer sees transparency in pricing

### Scenario C: Gateway Port Pricing + Separate IHE (Type 3) - Traditional

**CMA CGM prices from gateway port:**
```
IHE Rate:
  route_id: 12 (HR-INSON-INMUN-RD)
  from: INSON (Sonipat)
  to: INMUN (Mundra)
  rate_per_container: ₹18,000 ($216.87)
  vendor: XYZ Logistics

Ocean Freight Rate:
  rate_id: 247
  origin_code: INMUN (gateway port as pricing origin)
  destination_code: NLRTM (Rotterdam)
  pol_id: UUID → INMUN
  pod_id: UUID → NLRTM
  buy_amount: $1,200
  includes_ihe: FALSE
  vendor: CMA CGM

Total: $216.87 + $1,200 = $1,416.87
```

**What this means:**
- ✅ Customer searches: INSON → NLRTM
- ✅ System finds NO direct rate for INSON → NLRTM
- ✅ System finds rate for INMUN → NLRTM
- ✅ System adds IHE from INSON → INMUN
- ✅ Total = IHE + Ocean

**Commercial Logic:**
- Carrier prices ocean freight FROM gateway port only
- Customer must arrange/buy IHE separately
- Most transparent pricing model

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

**Show all three rate types:**
```
┌─────────────────────────────────────────────────────────┐
│ Option 1: Maersk All-Inclusive (Door-to-Door)         │
│ Rate: $1,500 (includes inland haulage)                 │
│ ├─ IHE (INSON → INMUN): Included ✅                    │
│ ├─ Ocean (INMUN → NLRTM): Included ✅                  │
│ └─ Total: $1,500                                       │
│ [Select] [Details]                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Option 2: MSC Inland Origin Pricing + Separate IHE    │
│ Ocean Rate: $1,200 (priced from INSON)                │
│ ├─ IHE (INSON → INMUN): $216.87 (separate) 📦         │
│ ├─ Ocean (INSON → NLRTM): $1,200                      │
│ └─ Total: $1,416.87                                    │
│ [Select] [Details]                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Option 3: CMA CGM Gateway Port + Separate Haulage     │
│ Ocean Rate: $1,200 (from gateway port)                │
│ ├─ IHE (INSON → INMUN): $216.87 (separate) 📦         │
│ ├─ Ocean (INMUN → NLRTM): $1,200                      │
│ └─ Total: $1,416.87                                    │
│ [Select] [Details]                                     │
└─────────────────────────────────────────────────────────┘
```

**Key Differences:**
- **Option 1**: origin = INSON, includes_ihe = TRUE
- **Option 2**: origin = INSON, includes_ihe = FALSE (inland origin pricing)
- **Option 3**: origin = INMUN, includes_ihe = FALSE (gateway port pricing)

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

## 📊 COMPARISON TABLE - ALL THREE SCENARIOS (WITH IHI)

**Example: INSON (Inland) → DEHAM (Inland)**

| Aspect | Type 1: All-Inclusive | Type 2: Inland Pricing + IHE/IHI | Type 3: Gateway Port + IHE/IHI |
|--------|----------------------|----------------------------------|-------------------------------|
| **origin_code** | INSON (inland) | INSON (inland) ⭐ | INMUN (port) |
| **destination_code** | DEHAM (inland) | DEHAM (inland) ⭐ | DEHAM_PORT (port) |
| **pol_id** | INMUN (port) | INMUN (port) | INMUN (port) |
| **pod_id** | DEHAM_PORT (port) | DEHAM_PORT (port) | DEHAM_PORT (port) |
| **includes_ihe** | TRUE | FALSE ⭐ | FALSE |
| **includes_ihi** | TRUE | FALSE ⭐ | FALSE |
| **Ocean Rate** | $1,800 (bundled) | $1,400 (separate) | $1,200 (separate) |
| **IHE Needed?** | ❌ No | ✅ Yes ($216.87) | ✅ Yes ($216.87) |
| **IHI Needed?** | ❌ No | ✅ Yes ($320) | ✅ Yes ($320) |
| **Origin Pricing** | From inland | From inland ⭐ | From port |
| **Dest Pricing** | To inland | To inland ⭐ | To port |
| **Commercial Model** | Door-to-door | Hybrid transparency | Traditional |
| **Customer Sees** | 1 line item | 3 line items ⭐ | 3 line items |
| **Total Cost** | $1,800 | $1,936.87 | $1,736.87 |

⭐ = **Type 2 unique characteristics**

**Note**: Type 2 total is higher because the ocean rate base is $1,400 (inland pricing) vs $1,200 (port pricing), but customer can compare all components.

**Critical Detection Logic (IHE + IHI):**

```typescript
async function calculateTotalRate(rate, customer_origin, customer_destination) {
  let total = rate.buy_amount;
  let ihe_cost = 0;
  let ihi_cost = 0;
  let breakdown = [];
  
  const origin_is_inland = rate.origin_code !== pol_code;
  const dest_is_inland = rate.destination_code !== pod_code;
  
  // ============================================
  // ORIGIN (IHE) LOGIC
  // ============================================
  
  if (origin_is_inland) {
    if (rate.includes_ihe === true) {
      // Type 1: IHE bundled in ocean rate
      breakdown.push("IHE: Included in rate");
    } else {
      // Type 2 or 3: Need to add IHE separately
      ihe_cost = await calculateIHE(rate.origin_code, pol_code);
      total += ihe_cost;
      breakdown.push(`IHE (${rate.origin_code} → ${pol_code}): $${ihe_cost}`);
    }
  } else if (customer_origin !== rate.origin_code) {
    // Type 3: Ocean starts from port, but customer is inland
    ihe_cost = await calculateIHE(customer_origin, pol_code);
    total += ihe_cost;
    breakdown.push(`IHE (${customer_origin} → ${pol_code}): $${ihe_cost}`);
  }
  
  // ============================================
  // DESTINATION (IHI) LOGIC
  // ============================================
  
  if (dest_is_inland) {
    if (rate.includes_ihi === true) {
      // Type 1: IHI bundled in ocean rate
      breakdown.push("IHI: Included in rate");
    } else {
      // Type 2 or 3: Need to add IHI separately
      ihi_cost = await calculateIHI(pod_code, rate.destination_code);
      total += ihi_cost;
      breakdown.push(`IHI (${pod_code} → ${rate.destination_code}): $${ihi_cost}`);
    }
  } else if (customer_destination !== rate.destination_code) {
    // Type 3: Ocean ends at port, but customer destination is inland
    ihi_cost = await calculateIHI(pod_code, customer_destination);
    total += ihi_cost;
    breakdown.push(`IHI (${pod_code} → ${customer_destination}): $${ihi_cost}`);
  }
  
  // ============================================
  // RETURN COMPLETE BREAKDOWN
  // ============================================
  
  breakdown.push(`Ocean (${rate.origin_code} → ${rate.destination_code}): $${rate.buy_amount}`);
  
  return {
    total,
    ocean_rate: rate.buy_amount,
    ihe_cost,
    ihi_cost,
    breakdown,
    rate_type: determineRateType(rate, origin_is_inland, dest_is_inland)
  };
}

function determineRateType(rate, origin_is_inland, dest_is_inland) {
  if (origin_is_inland && dest_is_inland) {
    if (rate.includes_ihe && rate.includes_ihi) return "TYPE_1_DOOR_TO_DOOR";
    if (!rate.includes_ihe && !rate.includes_ihi) return "TYPE_2_INLAND_PRICING";
  }
  
  if (origin_is_inland) {
    if (rate.includes_ihe) return "TYPE_1_IHE_BUNDLED";
    return "TYPE_2_OR_3_IHE_SEPARATE";
  }
  
  if (dest_is_inland) {
    if (rate.includes_ihi) return "TYPE_1_IHI_BUNDLED";
    return "TYPE_2_OR_3_IHI_SEPARATE";
  }
  
  return "PORT_TO_PORT";
}
```

---

## 🎯 KEY TAKEAWAYS

### 1. **Three Rate Structures Coexist (IHE + IHI)** ✅
```
Type 1: Door-to-Door All-Inclusive
  origin = INSON (inland), destination = DEHAM (inland)
  POL = INMUN, POD = DEHAM_PORT
  includes_ihe = TRUE, includes_ihi = TRUE
  → IHE + Ocean + IHI all bundled in ocean rate price
  → Customer pays $1,800 (all-in, 1 line item)

Type 2: Inland Location Pricing + Separate Haulage
  origin = INSON (inland), destination = DEHAM (inland)
  POL = INMUN, POD = DEHAM_PORT
  includes_ihe = FALSE, includes_ihi = FALSE
  → Ocean priced from/to inland, but IHE/IHI billed separately
  → Customer pays $216.87 (IHE) + $1,400 (ocean) + $320 (IHI) = $1,936.87
  → Commercial strategy: Show inland pricing, itemize haulage for transparency

Type 3: Gateway Port Pricing + Separate Haulage
  origin = INMUN (port), destination = DEHAM_PORT (port)
  POL = INMUN, POD = DEHAM_PORT
  includes_ihe = FALSE, includes_ihi = FALSE
  → Ocean priced port-to-port only
  → Customer must add IHE/IHI from/to their actual locations
  → Customer pays $216.87 (IHE) + $1,200 (ocean) + $320 (IHI) = $1,736.87
  → Most traditional/transparent model
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


