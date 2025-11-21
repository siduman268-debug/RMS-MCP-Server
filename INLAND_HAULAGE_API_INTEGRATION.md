# FCL Inland Haulage API Integration Guide
**Date**: 2025-11-20  
**Status**: Implementation Pending (Tomorrow)

---

## 🎯 Problem Statement

**Current Issue:** The V4 API always adds a separate IHE (Inland Haulage Export) charge when the origin is an inland location, even when the carrier has already included IHE in their ocean freight rate. This results in **double-charging the customer**.

**Example of Double-Charging:**
```
Origin: INSON (inland location - Sonipat, India)
Destination: NLRTM (Rotterdam port)

Scenario: Maersk offers all-inclusive door rate INSON-NLRTM @ $2000/40HC

Current API Behavior (WRONG):
✗ Ocean Freight: INSON-NLRTM = $2000 (includes IHE)
✗ IHE: INSON-INNSA = $200 (auto-added by API)
✗ Total: $2200 ❌ OVERCHARGED BY $200

Correct API Behavior (TO IMPLEMENT):
✓ Ocean Freight: INSON-NLRTM = $2000 (IHE included)
✓ IHE: $0 (already bundled)
✓ Total: $2000 ✅ CORRECT
```

---

## 📊 The 3 Carrier Pricing Models

### Model 1: All-Inclusive Door-to-Door (`all_inclusive`)

**How Carriers Price:**
- Single rate from inland origin to destination
- IHE cost is bundled into the ocean freight rate
- Customer sees one price: "Door to Port" or "Door to Door"

**Example:**
```
Maersk Rate: INSON → NLRTM = $2000/40HC
(IHE INSON → INNSA is included in $2000)
```

**Database:**
```json
{
  "ihe_included": true,
  "ihi_included": false,
  "pricing_model": "all_inclusive",
  "ihe_from_location": "uuid-of-INSON",
  "notes": "IHE bundled in ocean rate"
}
```

**API Logic:**
```javascript
if (rate.includes_inland_haulage?.pricing_model === 'all_inclusive') {
  // DO NOT add separate IHE
  ihe = 0;
  note = "IHE included in ocean freight rate";
}
```

**Customer Invoice:**
```
Ocean Freight (INSON-NLRTM): $2000
IHE: Included
Total: $2000
```

---

### Model 2: Inland Origin Pricing + Separate IHE (`inland_origin`)

**How Carriers Price:**
- Ocean rate is priced FROM inland location
- But carrier bills IHE as a separate line item
- Customer sees: "Ocean Freight from Inland" + "IHE"

**Example:**
```
MSC Rate: INSON → NLRTM = $1800/40HC (ocean only)
MSC IHE: INSON → INNSA = $200/40HC (separate)
Total: $2000
```

**Database:**
```json
{
  "ihe_included": false,
  "ihi_included": false,
  "pricing_model": "inland_origin",
  "ihe_from_location": "uuid-of-INSON",
  "notes": "Ocean priced from inland, IHE billed separately"
}
```

**API Logic:**
```javascript
if (rate.includes_inland_haulage?.pricing_model === 'inland_origin') {
  // MUST add separate IHE even though origin is inland
  const fromLocation = rate.includes_inland_haulage.ihe_from_location;
  const pol = await getNearestPort(origin);
  ihe = await fetchInlandHaulage(fromLocation, pol);
  note = "IHE billed separately by carrier";
}
```

**Customer Invoice:**
```
Ocean Freight (INSON-NLRTM): $1800
IHE (INSON-INNSA): $200
Total: $2000
```

---

### Model 3: Gateway Port Pricing + Separate IHE (`gateway_port`)

**How Carriers Price:**
- Traditional: Ocean rate FROM gateway port (not inland)
- IHE billed separately
- Customer sees: "Ocean Freight from Port" + "IHE"

**Example:**
```
CMA CGM Rate: INNSA → NLRTM = $1500/40HC (port-to-port)
IHE: INSON → INNSA = $200/40HC (separate)
Total: $1700
```

**Database:**
```json
{
  "ihe_included": false,
  "ihi_included": false,
  "pricing_model": "gateway_port",
  "notes": "Traditional port-to-port pricing"
}
```

**API Logic:**
```javascript
if (rate.includes_inland_haulage?.pricing_model === 'gateway_port') {
  // Current behavior - add IHE if origin is inland
  if (isInlandLocation(origin)) {
    const pol = await getNearestPort(origin);
    ihe = await fetchInlandHaulage(origin, pol);
    note = `IHE: ${origin} → ${pol}`;
  }
}
```

**Customer Invoice:**
```
Ocean Freight (INNSA-NLRTM): $1500
IHE (INSON-INNSA): $200
Total: $1700
```

---

## 🔧 Implementation Guide

### Step 1: Update Rate Fetching

**File: `src/routes/v4-routes.ts`**

```typescript
// Fetch ocean rate WITH inland haulage metadata
const { data: oceanRates } = await supabase
  .from('ocean_freight_rate')
  .select(`
    *,
    vendor:vendor_id (name, logo_url),
    includes_inland_haulage
  `)
  .eq('origin_id', originId)
  .eq('destination_id', destinationId)
  .eq('is_active', true);
```

### Step 2: Add Pricing Model Logic

```typescript
async function calculateInlandHaulage(
  oceanRate: any,
  origin: string,
  destination: string
) {
  let ihe = 0;
  let ihi = 0;
  let notes = {
    ihe: '',
    ihi: ''
  };

  // Check if inland haulage metadata exists
  if (!oceanRate.includes_inland_haulage) {
    // Legacy behavior: assume gateway_port
    if (await isInlandLocation(origin)) {
      const pol = await getNearestPort(origin);
      ihe = await fetchInlandHaulage(origin, pol);
      notes.ihe = `IHE: ${origin} → ${pol}`;
    }
    if (await isInlandLocation(destination)) {
      const pod = await getNearestPort(destination);
      ihi = await fetchInlandHaulage(pod, destination);
      notes.ihi = `IHI: ${pod} → ${destination}`;
    }
    return { ihe, ihi, notes, pricing_model: 'gateway_port' };
  }

  const haulageConfig = oceanRate.includes_inland_haulage;
  const pricingModel = haulageConfig.pricing_model;

  // Handle IHE (Export)
  if (await isInlandLocation(origin)) {
    switch (pricingModel) {
      case 'all_inclusive':
        if (haulageConfig.ihe_included) {
          ihe = 0;
          notes.ihe = `IHE included in ocean freight rate from ${origin}`;
        }
        break;

      case 'inland_origin':
        // Ocean rate is from inland, but IHE billed separately
        const pol = await getNearestPort(origin);
        ihe = await fetchInlandHaulage(
          haulageConfig.ihe_from_location || origin,
          pol
        );
        notes.ihe = `IHE billed separately: ${origin} → ${pol}`;
        break;

      case 'gateway_port':
        // Traditional behavior
        const polGw = await getNearestPort(origin);
        ihe = await fetchInlandHaulage(origin, polGw);
        notes.ihe = `IHE: ${origin} → ${polGw}`;
        break;
    }
  }

  // Handle IHI (Import) - similar logic
  if (await isInlandLocation(destination)) {
    if (haulageConfig.ihi_included && pricingModel === 'all_inclusive') {
      ihi = 0;
      notes.ihi = `IHI included in ocean freight rate to ${destination}`;
    } else {
      const pod = await getNearestPort(destination);
      ihi = await fetchInlandHaulage(pod, destination);
      notes.ihi = `IHI: ${pod} → ${destination}`;
    }
  }

  return { ihe, ihi, notes, pricing_model: pricingModel };
}
```

### Step 3: Update Response Schema

```typescript
// In search-rates and prepare-quote response
return {
  success: true,
  rates: oceanRates.map(rate => {
    const { ihe, ihi, notes, pricing_model } = calculateInlandHaulage(rate, origin, destination);
    
    return {
      rate_id: rate.id,
      vendor: rate.vendor,
      ocean_freight: {
        amount: rate.sell_amount,
        origin: rate.origin_code,
        destination: rate.destination_code,
        pricing_model: pricing_model,
        ihe_included: rate.includes_inland_haulage?.ihe_included || false,
        ihi_included: rate.includes_inland_haulage?.ihi_included || false
      },
      inland_haulage: {
        ihe: {
          amount: ihe,
          note: notes.ihe
        },
        ihi: {
          amount: ihi,
          note: notes.ihi
        }
      },
      total_cost: rate.sell_amount + ihe + ihi,
      currency: rate.currency
    };
  })
};
```

---

## 🧪 Testing Checklist

### Test Scenario 1: All-Inclusive Rate
**Input:**
```json
{
  "origin": "INSON",
  "destination": "NLRTM",
  "container_type": "40HC"
}
```

**Expected:**
```json
{
  "ocean_freight": 2000,
  "ihe": 0,
  "ihi": 0,
  "total": 2000,
  "notes": {
    "ihe": "IHE included in ocean freight rate from INSON"
  }
}
```

### Test Scenario 2: Inland Origin + Separate IHE
**Input:**
```json
{
  "origin": "INSON",
  "destination": "NLRTM",
  "container_type": "40HC"
}
```

**Expected:**
```json
{
  "ocean_freight": 1800,
  "ihe": 200,
  "ihi": 0,
  "total": 2000,
  "notes": {
    "ihe": "IHE billed separately: INSON → INNSA"
  }
}
```

### Test Scenario 3: Gateway Port + IHE
**Input:**
```json
{
  "origin": "INSON",
  "destination": "NLRTM",
  "container_type": "40HC"
}
```

**Expected:**
```json
{
  "ocean_freight": 1500,
  "ihe": 200,
  "ihi": 0,
  "total": 1700,
  "notes": {
    "ihe": "IHE: INSON → INNSA"
  }
}
```

---

## 📝 Migration Script

```sql
-- Tag existing rates with default pricing model
UPDATE ocean_freight_rate
SET includes_inland_haulage = jsonb_build_object(
  'ihe_included', false,
  'ihi_included', false,
  'pricing_model', 'gateway_port',
  'notes', 'Default: traditional port-to-port pricing'
)
WHERE includes_inland_haulage IS NULL
  AND origin_id IN (
    SELECT id FROM locations WHERE location_type = 'PORT'
  );

-- Identify potential all-inclusive rates (manual review needed)
SELECT 
  id,
  origin_code,
  destination_code,
  vendor_id,
  sell_amount,
  'Potential all-inclusive rate' as flag
FROM ocean_freight_rate
WHERE origin_id IN (
  SELECT id FROM locations WHERE location_type = 'INLAND'
)
AND includes_inland_haulage IS NULL;

-- Template for tagging all-inclusive rates
-- UPDATE ocean_freight_rate
-- SET includes_inland_haulage = jsonb_build_object(
--   'ihe_included', true,
--   'ihi_included', false,
--   'pricing_model', 'all_inclusive',
--   'ihe_from_location', 'uuid-of-inland-location',
--   'notes', 'IHE bundled in ocean rate'
-- )
-- WHERE id = <rate_id>;
```

---

## ✅ Success Criteria

- [ ] No double-charging for all-inclusive rates
- [ ] Correct IHE added for inland-origin rates
- [ ] Gateway-port rates work as before (no regression)
- [ ] API response clearly shows pricing model
- [ ] All 3 scenarios tested with real data
- [ ] Customer invoices show correct breakdown
- [ ] Documentation updated

---

## 📚 Related Documentation

- `HAULAGE_DUAL_RATE_STRUCTURE.md` - Business logic explanation
- `migrations/add_includes_inland_haulage_to_ocean_freight.sql` - Database schema
- `LCL_API_IMPLEMENTATION_PLAN.md` - Tomorrow's full agenda

---

**Implementation Date**: 2025-11-21 (Tomorrow - Phase 4)  
**Estimated Time**: 2-3 hours  
**Priority**: HIGH (prevents customer overcharging) 🚨

