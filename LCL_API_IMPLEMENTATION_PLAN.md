# LCL API Implementation Plan
**Date**: 2025-11-21
**Status**: Ready to Start

---

## 📋 Today's Accomplishments (2025-11-20)

✅ **Database Schema Complete**
- `lcl_ocean_freight_rate` table (FLAT_RATE + SLAB_BASED pricing)
- `lcl_surcharge` table (flexible rate basis)
- `lcl_shipment_item` table (auto-calculated chargeable weight)
- All indexes, RLS policies, and constraints in place

✅ **Pricing Function Tested**
- `calculate_lcl_freight_cost()` working correctly
- Chargeable weight logic: MAX(actual, volumetric)
- Minimum charge enforcement
- Detailed breakdown returned

✅ **Sample Data Loaded**
- 12 ocean freight rates (4 vendors, 2 pricing models)
- 5 surcharges (flat + percentage-based)
- Ready for API testing

---

## 🎯 Tomorrow's Goals (2025-11-21)

### Phase 1: LCL CRUD APIs (3-4 hours)

#### 1.1 LCL Ocean Freight Rate CRUD
**Endpoints:**
```
GET    /api/lcl-rates                    # List with filters (origin, dest, vendor, pricing_model, service_type)
GET    /api/lcl-rates/:id                # Get single rate with vendor details
POST   /api/lcl-rates                    # Create rate (with validation)
PUT    /api/lcl-rates/:id                # Update rate
DELETE /api/lcl-rates/:id                # Delete rate
POST   /api/lcl-rates/bulk               # Bulk create (for CSV upload)
```

**Key Features:**
- Filter by: `origin_code`, `destination_code`, `vendor_id`, `pricing_model`, `service_type`
- JOIN with `vendor` table for vendor name/logo
- Validate: `min_volume_cbm <= max_volume_cbm`
- Validate: `valid_from <= valid_to`
- Validate: Rate basis matches (PER_CBM → rate_per_cbm NOT NULL)
- Audit logging for all CUD operations

#### 1.2 LCL Surcharge CRUD
**Endpoints:**
```
GET    /api/lcl-surcharges               # List with filters
GET    /api/lcl-surcharges/:id           # Get single
POST   /api/lcl-surcharges               # Create
PUT    /api/lcl-surcharges/:id           # Update
DELETE /api/lcl-surcharges/:id           # Delete
POST   /api/lcl-surcharges/bulk          # Bulk create
```

**Key Features:**
- Filter by: `vendor_id`, `charge_code`, `applies_scope`, `origin_code`, `destination_code`
- Validate: `charge_code` exists in `charge_master`
- Validate: PERCENTAGE rate basis → `percentage` between 0-100
- Audit logging

#### 1.3 LCL Shipment Item CRUD
**Endpoints:**
```
GET    /api/lcl-items                    # List by enquiry_id
GET    /api/lcl-items/:id                # Get single item
POST   /api/lcl-items                    # Create item (auto-calc weight/volume)
PUT    /api/lcl-items/:id                # Update item
DELETE /api/lcl-items/:id                # Delete item
POST   /api/lcl-items/bulk               # Bulk create (for multi-item quotes)
```

**Key Features:**
- Auto-calculated fields: `volume_cbm`, `volumetric_weight_kg`, `chargeable_weight_kg`
- Filter by: `enquiry_id`, `is_hazardous`, `is_temperature_controlled`
- Aggregate totals: `SUM(total_volume_cbm)`, `SUM(total_chargeable_weight_kg)`

---

### Phase 2: LCL Search Rates API (2-3 hours)

#### 2.1 Endpoint Design
```
POST /api/v4/search-lcl-rates
```

**Request Body:**
```json
{
  "origin_code": "INNSA",
  "destination_code": "NLRTM",
  "items": [
    {
      "length_cm": 100,
      "width_cm": 80,
      "height_cm": 60,
      "gross_weight_kg": 200,
      "pieces": 5,
      "commodity": "Electronics"
    }
  ],
  "service_type": "CONSOLIDATED",  // optional: DIRECT, CONSOLIDATED
  "vendor_ids": [1, 2],             // optional: filter by vendors
  "valid_date": "2025-11-21"       // optional: defaults to today
}
```

**Response:**
```json
{
  "success": true,
  "total_volume_cbm": 2.4,
  "total_weight_kg": 1000,
  "total_chargeable_weight_kg": 2400,
  "rates": [
    {
      "rate_id": 13,
      "vendor_id": 1,
      "vendor_name": "Maersk Line",
      "vendor_logo": "carrier_maersk",
      "origin": "INNSA",
      "destination": "NLRTM",
      "service_type": "CONSOLIDATED",
      "pricing_model": "SLAB_BASED",
      "matched_slab": {
        "min_volume_cbm": 0,
        "max_volume_cbm": 3,
        "rate_per_cbm": 60.00,
        "max_weight_per_slab_kg": 3000
      },
      "freight_cost": 144.00,
      "minimum_charge": 80.00,
      "minimum_charge_applied": false,
      "surcharges": [
        {
          "charge_code": "THC_ORIGIN",
          "charge_name": "Terminal Handling Charge (Origin)",
          "amount": 36.00,
          "calculation": "2.4 CBM × $15/CBM"
        },
        {
          "charge_code": "BAF",
          "charge_name": "Bunker Adjustment Factor",
          "amount": 14.40,
          "calculation": "10% of $144"
        }
      ],
      "total_cost": 194.40,
      "currency": "USD",
      "transit_days": 28,
      "valid_from": "2025-01-01",
      "valid_to": "2025-12-31"
    }
  ]
}
```

#### 2.2 Logic Steps
1. **Calculate Total Volume & Weight:**
   - `total_volume_cbm = SUM(items.volume_cbm × pieces)`
   - `total_chargeable_weight_kg = SUM(MAX(gross_weight, volumetric_weight) × pieces)`

2. **Find Matching Rates:**
   - Filter by: `origin_code`, `destination_code`, `is_active`, date range
   - Optional: `service_type`, `vendor_ids`
   - For SLAB_BASED: match volume to correct slab (`min_volume <= total <= max_volume`)
   - For FLAT_RATE: single rate applies

3. **Calculate Freight Cost:**
   - Use `calculate_lcl_freight_cost()` function OR inline calculation
   - Apply minimum charge if applicable

4. **Apply Surcharges:**
   - Fetch matching surcharges by `origin_code`, `destination_code`, `vendor_id`
   - Calculate based on `rate_basis`:
     - `PER_CBM`: `amount × total_volume_cbm`
     - `PER_SHIPMENT`: `amount`
     - `PERCENTAGE`: `freight_cost × (percentage / 100)`

5. **Sort & Return:**
   - Sort by `total_cost` ASC
   - Include breakdown for transparency

---

### Phase 3: LCL Prepare Quote API (2-3 hours)

#### 3.1 Endpoint Design
```
POST /api/v4/prepare-lcl-quote
```

**Request Body:**
```json
{
  "enquiry_id": "ENQ-LCL-2025-001",
  "customer_id": "CUST-123",
  "rate_id": 13,
  "items": [
    {
      "length_cm": 100,
      "width_cm": 80,
      "height_cm": 60,
      "gross_weight_kg": 200,
      "pieces": 5,
      "commodity": "Electronics",
      "packaging_type": "Carton"
    }
  ],
  "additional_surcharges": [
    {
      "charge_code": "INSURANCE",
      "amount": 50.00
    }
  ],
  "margin_rule_id": 5,  // optional: apply margin
  "notes": "Urgent shipment"
}
```

**Response:**
```json
{
  "success": true,
  "quote_id": "QTE-LCL-2025-001",
  "enquiry_id": "ENQ-LCL-2025-001",
  "created_at": "2025-11-21T10:30:00Z",
  
  "shipment_summary": {
    "total_pieces": 5,
    "total_volume_cbm": 2.4,
    "total_weight_kg": 1000,
    "total_chargeable_weight_kg": 2400,
    "items": [...]
  },
  
  "rate_details": {
    "vendor_name": "Maersk Line",
    "service_type": "CONSOLIDATED",
    "pricing_model": "SLAB_BASED",
    "origin": "INNSA",
    "destination": "NLRTM",
    "transit_days": 28
  },
  
  "cost_breakdown": {
    "freight": {
      "buy_amount": 144.00,
      "calculation": "2.4 CBM × $60/CBM"
    },
    "surcharges": [
      {
        "charge_code": "THC_ORIGIN",
        "buy_amount": 36.00
      },
      {
        "charge_code": "BAF",
        "buy_amount": 14.40
      },
      {
        "charge_code": "INSURANCE",
        "buy_amount": 50.00
      }
    ],
    "total_buy": 244.40
  },
  
  "margin": {
    "rule_name": "Standard LCL Margin",
    "percentage": 15,
    "amount": 36.66
  },
  
  "sell_price": {
    "total": 281.06,
    "currency": "USD",
    "valid_until": "2025-12-31"
  }
}
```

#### 3.2 Logic Steps
1. **Validate Rate Availability:**
   - Check `lcl_ocean_freight_rate` exists and is active
   - Verify volume falls within slab range (if SLAB_BASED)

2. **Create Shipment Items:**
   - Insert into `lcl_shipment_item` table
   - Auto-calculate volumes and weights

3. **Calculate Freight Cost:**
   - Use `calculate_lcl_freight_cost()` function
   - Get buy amount from rate

4. **Apply Surcharges:**
   - Fetch vendor's surcharges
   - Add any additional custom surcharges
   - Calculate total buy cost

5. **Apply Margin:**
   - Fetch margin rule (if provided)
   - Calculate sell price based on margin %

6. **Store Quote:**
   - Save to `quotes` table (if exists)
   - Link to `lcl_shipment_item` records
   - Return detailed breakdown

---

### Phase 4: Upgrade FCL Inland Haulage Pricing Engine (2-3 hours)

#### 4.1 Background: The 3 Inland Haulage Scenarios

Today we added `includes_inland_haulage` JSONB column to `ocean_freight_rate` to handle complex carrier pricing models:

**Schema:**
```sql
includes_inland_haulage JSONB DEFAULT NULL

Structure:
{
  "ihe_included": boolean,     -- Is Inland Haulage Export included?
  "ihi_included": boolean,     -- Is Inland Haulage Import included?
  "pricing_model": string,     -- "all_inclusive" | "inland_origin" | "gateway_port"
  "ihe_from_location": uuid,   -- If IHE included, from which inland point
  "ihi_to_location": uuid,     -- If IHI included, to which inland point
  "notes": string
}
```

**The 3 Pricing Models:**

1. **All-Inclusive Door-to-Door** (`all_inclusive`)
   - Carrier includes IHE in ocean freight rate
   - Origin = inland point (e.g., INSON)
   - ⚠️ **DO NOT add separate IHE charge** (would double-charge customer)
   - Example: Maersk door rate INSON-NLRTM @ $2000/40HC (IHE bundled)

2. **Inland Origin Pricing + Separate IHE** (`inland_origin`)
   - Ocean rate priced FROM inland point (e.g., INSON)
   - But carrier bills IHE separately
   - Example: Ocean INSON-NLRTM @ $1800 + IHE INSON-INNSA @ $200 = $2000
   - ⚠️ **MUST add IHE charge** even though origin is inland

3. **Gateway Port Pricing + Separate IHE** (`gateway_port`)
   - Traditional: Ocean rate FROM port (e.g., INNSA)
   - IHE billed separately
   - Example: Ocean INNSA-NLRTM @ $1500 + IHE INSON-INNSA @ $200 = $1700
   - ✅ Current behavior - no changes needed

#### 4.2 Files to Update

**File 1: `src/routes/v4-routes.ts`**

**Endpoints:**
- `POST /api/v4/search-rates` (FCL)
- `POST /api/v4/prepare-quote` (FCL)

**Current Logic (Simplified):**
```typescript
// Step 1: Fetch ocean freight rate
const oceanRate = await fetchOceanRate(origin, destination, containerType);

// Step 2: Fetch inland haulage (if origin is inland)
if (isInlandLocation(origin)) {
  const ihe = await fetchInlandHaulage(origin, nearestPort);
  totalCost += ihe;
}

// Step 3: Return total
return { oceanFreight: oceanRate, inlandHaulage: ihe, total: totalCost };
```

**⚠️ PROBLEM:** This always adds IHE for inland origins, even when it's already included in ocean rate!

**New Logic (To Implement):**
```typescript
// Step 1: Fetch ocean freight rate
const oceanRate = await fetchOceanRate(origin, destination, containerType);

// Step 2: Check if inland haulage is bundled
let ihe = 0;
let iheNote = '';

if (oceanRate.includes_inland_haulage) {
  const haulageConfig = oceanRate.includes_inland_haulage;
  
  switch (haulageConfig.pricing_model) {
    case 'all_inclusive':
      // IHE already in ocean rate - DO NOT add separate charge
      ihe = 0;
      iheNote = `IHE included in ocean freight rate from ${origin}`;
      break;
      
    case 'inland_origin':
      // Ocean rate is from inland, but IHE charged separately
      const fromLocation = haulageConfig.ihe_from_location;
      const toLocation = await getNearestPort(origin); // POL
      ihe = await fetchInlandHaulage(fromLocation, toLocation);
      iheNote = `IHE billed separately: ${origin} → ${toLocation}`;
      break;
      
    case 'gateway_port':
      // Traditional: Ocean from port, IHE separate
      if (isInlandLocation(origin)) {
        const pol = await getNearestPort(origin);
        ihe = await fetchInlandHaulage(origin, pol);
        iheNote = `IHE: ${origin} → ${pol}`;
      }
      break;
  }
} else {
  // Legacy behavior: no haulage metadata, assume gateway_port
  if (isInlandLocation(origin)) {
    const pol = await getNearestPort(origin);
    ihe = await fetchInlandHaulage(origin, pol);
    iheNote = `IHE: ${origin} → ${pol}`;
  }
}

// Step 3: Return with clear breakdown
return {
  oceanFreight: oceanRate.amount,
  inlandHaulage: { ihe, note: iheNote },
  total: oceanRate.amount + ihe
};
```

#### 4.3 Implementation Tasks

**Task 1: Update Rate Fetching Logic**
- Modify `fetchOceanRate()` to include `includes_inland_haulage` column
- Add to both search-rates and prepare-quote endpoints

**Task 2: Add Pricing Model Detection**
```typescript
function detectPricingModel(oceanRate, origin, destination) {
  // If origin is inland and ocean rate origin matches inland location
  if (isInlandLocation(origin) && oceanRate.origin_code === origin) {
    // Check if carrier typically bundles or separates
    // This may need carrier-specific config or manual tagging
    return 'inland_origin'; // or 'all_inclusive'
  } else if (isInlandLocation(origin) && oceanRate.origin_code !== origin) {
    // Ocean rate is from port, not inland
    return 'gateway_port';
  }
  return 'gateway_port'; // Default
}
```

**Task 3: Update Response Schema**
Add clear indicators in API response:
```json
{
  "freight_breakdown": {
    "ocean_freight": {
      "amount": 1800,
      "origin": "INSON",
      "destination": "NLRTM",
      "pricing_model": "inland_origin",
      "ihe_included": false
    },
    "inland_haulage": {
      "ihe": {
        "amount": 200,
        "from": "INSON",
        "to": "INNSA",
        "note": "IHE billed separately by carrier"
      }
    },
    "total": 2000
  }
}
```

**Task 4: Update Existing Rates**
Create migration script to populate `includes_inland_haulage` for existing rates:
```sql
-- Identify rates that need tagging
UPDATE ocean_freight_rate
SET includes_inland_haulage = jsonb_build_object(
  'ihe_included', false,
  'ihi_included', false,
  'pricing_model', 'gateway_port',
  'notes', 'Default: traditional port-to-port pricing'
)
WHERE includes_inland_haulage IS NULL
  AND origin_id IN (SELECT id FROM locations WHERE location_type = 'PORT');

-- Tag inland-origin rates (manual review needed)
-- UPDATE ocean_freight_rate
-- SET includes_inland_haulage = jsonb_build_object(...)
-- WHERE origin_id IN (SELECT id FROM locations WHERE location_type = 'INLAND');
```

**Task 5: Update `simplified_inland_function`**
- May need to pass `pricing_model` context
- Ensure it doesn't return IHE cost when `all_inclusive`

**Task 6: Testing**
Test all 3 scenarios:

| Scenario | Origin | Ocean Rate Origin | IHE in Ocean? | Separate IHE? | Expected Total |
|----------|--------|-------------------|---------------|---------------|----------------|
| All-Inclusive | INSON | INSON | ✅ Yes | ❌ No | $2000 (ocean only) |
| Inland Origin | INSON | INSON | ❌ No | ✅ Yes | $1800 + $200 = $2000 |
| Gateway Port | INSON | INNSA | ❌ No | ✅ Yes | $1500 + $200 = $1700 |

#### 4.4 Documentation Updates

**Update `HAULAGE_DUAL_RATE_STRUCTURE.md`:**
- Add API integration examples
- Document response schema
- Add testing guide

**Update `API_DOCUMENTATION_V4.md`:**
- Document `includes_inland_haulage` field
- Add examples for all 3 pricing models
- Clarify when IHE is/isn't charged

#### 4.5 Success Criteria

✅ No double-charging for all-inclusive rates  
✅ Correct IHE added for inland-origin rates  
✅ Existing gateway-port rates work as before  
✅ API response clearly shows pricing model  
✅ All existing tests pass  
✅ New tests cover all 3 scenarios  

---

## 🛠️ Technical Considerations

### Tenant Isolation
- All queries MUST filter by `tenant_id`
- Use RLS policies to enforce at DB level
- JWT token must contain `tenant_id`

### Audit Logging
- Log all CUD operations to `rms_audit_log`
- Capture: `user_id`, `tenant_id`, `action`, `old_data`, `new_data`

### Error Handling
- Validate all foreign keys (vendor_id, charge_code, etc.)
- Return user-friendly error messages
- Log detailed errors for debugging

### Performance
- Use indexes on: `origin_code`, `destination_code`, `vendor_id`, `valid_from`, `valid_to`
- Cache vendor logos in static resources
- Batch fetch surcharges (avoid N+1 queries)

### Integration with Existing FCL/Haulage
- LCL is separate domain (separate tables)
- No overlap with `ocean_freight_rate` (FCL)
- Can coexist with inland haulage for door-to-door LCL

---

## 📦 Deliverables for Tomorrow

### Backend (Node.js)
1. ✅ 18 CRUD endpoints for 3 LCL tables
2. ✅ `POST /api/v4/search-lcl-rates` endpoint
3. ✅ `POST /api/v4/prepare-lcl-quote` endpoint
4. ✅ Upgrade FCL `search-rates` and `prepare-quote` for inland haulage models
5. ✅ Audit logging for all operations
6. ✅ Error handling and validation

### Testing
1. ✅ Postman/curl tests for all endpoints
2. ✅ Test SLAB_BASED vs FLAT_RATE pricing
3. ✅ Test surcharge calculations (flat + percentage)
4. ✅ Test minimum charge enforcement
5. ✅ Test bulk operations

### Documentation
1. ✅ Update `API_DOCUMENTATION_V4.md` with LCL endpoints
2. ✅ Add request/response examples
3. ✅ Document pricing calculation logic

---

## 🚀 Next Steps (Day After Tomorrow)

### Salesforce LWC for LCL Management
1. Create `rmsLclRatesTable` component (similar to Ocean Freight)
2. Create `rmsLclSurchargesTable` component
3. Add to `rmsManagement` as new tabs
4. Integrate with modal form for CRUD

### LCL Quote UI
1. Add LCL option to existing quote/enquiry flow
2. "Add Package" interface for items (dimensions + weight)
3. Display chargeable weight calculation
4. Show slab breakdown for SLAB_BASED rates

---

## 📊 Progress Tracking

| Task | Status | Time Est. | Actual |
|------|--------|-----------|--------|
| Database Schema | ✅ Complete | 2h | 3h |
| Pricing Function | ✅ Complete | 1h | 1.5h |
| LCL CRUD APIs (3 tables) | ⏳ Pending | 4h | - |
| LCL Search Rates API | ⏳ Pending | 3h | - |
| LCL Prepare Quote API | ⏳ Pending | 3h | - |
| FCL Inland Haulage Upgrade | ⏳ Pending | 3h | - |
| Testing & Documentation | ⏳ Pending | 2h | - |

**Total Estimated**: 13 hours for full implementation (LCL + FCL upgrade)

---

## 🎯 Success Criteria

### LCL APIs
✅ All LCL CRUD endpoints working  
✅ Search rates returns correct slab match  
✅ Chargeable weight calculated correctly  
✅ Surcharges applied (flat + percentage)  
✅ Minimum charge enforced  
✅ Quote generation working end-to-end  

### FCL Inland Haulage Upgrade
✅ No double-charging for all-inclusive rates  
✅ Correct IHE added for inland-origin rates  
✅ Gateway-port rates work as before (no regression)  
✅ API response shows pricing model clearly  
✅ All 3 scenarios tested and working  

### General
✅ Audit logs captured  
✅ API documentation updated  
✅ Migration scripts provided  

---

**Ready to start tomorrow!** 🚀

