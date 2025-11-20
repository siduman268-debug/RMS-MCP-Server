# LCL (Less than Container Load) Implementation Plan
**Date**: 2025-11-20  
**Phase**: RMS Phase 2  
**Status**: Planning  

---

## Executive Summary

Implement LCL (Less than Container Load) pricing alongside existing FCL (Full Container Load) system. LCL shipments are priced by volume (CBM) or weight (tons), not by container. This requires new tables, APIs, and UI components, plus updates to V4 search-rates and prepare-quote endpoints.

---

## Key Differences: FCL vs LCL

| Aspect | FCL (Full Container Load) | LCL (Less than Container Load) |
|--------|---------------------------|--------------------------------|
| **Pricing Unit** | Per container (20GP, 40GP, 40HC) | Per CBM or per ton |
| **Minimum** | 1 container | 1 CBM or 0.1 ton |
| **Rate Structure** | Fixed rate per container type | Rate per unit (CBM/ton) + minimum charge |
| **Consolidation** | Direct shipping | Multiple shippers share container |
| **Volume Range** | 20-70 CBM | 0.1-15 CBM typically |
| **Weight Range** | Up to 28-30 tons | 10 kg - 10 tons typically |
| **Transit Time** | Direct | +3-7 days (consolidation time) |
| **Surcharges** | Per container | Per shipment or per CBM |
| **Quote Complexity** | Simple | Complex (volume breaks, minimum charges) |

---

## Database Schema Design

### 1. LCL Rate Table

```sql
CREATE TABLE lcl_ocean_freight_rate (
    id BIGSERIAL PRIMARY KEY,
    
    -- Contract Information
    vendor_id BIGINT NOT NULL REFERENCES vendor(id),
    contract_id BIGINT REFERENCES rate_contract(id),
    
    -- Route Information
    origin_code VARCHAR(10) NOT NULL,  -- Port code
    destination_code VARCHAR(10) NOT NULL,  -- Port code
    via_port_code VARCHAR(10),  -- Transshipment port
    
    -- Rate Structure
    rate_basis VARCHAR(20) NOT NULL CHECK (rate_basis IN ('PER_CBM', 'PER_TON', 'PER_KG')),
    
    -- Volume-Based Rates (Tiered Pricing)
    min_volume_cbm NUMERIC(10,2),  -- Minimum volume for this rate
    max_volume_cbm NUMERIC(10,2),  -- Maximum volume for this rate
    rate_per_cbm NUMERIC(10,2),    -- Rate per CBM
    
    -- Weight-Based Rates
    min_weight_kg NUMERIC(10,2),   -- Minimum weight for this rate
    max_weight_kg NUMERIC(10,2),   -- Maximum weight for this rate
    rate_per_kg NUMERIC(10,4),     -- Rate per KG
    rate_per_ton NUMERIC(10,2),    -- Rate per ton (1000kg)
    
    -- Minimum Charges
    minimum_charge NUMERIC(10,2) NOT NULL,  -- Absolute minimum charge
    minimum_volume_cbm NUMERIC(10,2) DEFAULT 1.0,  -- Minimum billable volume
    minimum_weight_kg NUMERIC(10,2) DEFAULT 100.0, -- Minimum billable weight
    
    -- Revenue/Cost
    buy_amount NUMERIC(10,2),       -- Cost from vendor (per unit)
    sell_amount NUMERIC(10,2),      -- Selling price (per unit)
    
    -- Additional Info
    currency VARCHAR(3) NOT NULL DEFAULT 'USD' REFERENCES ref_currency(code),
    tt_days INTEGER,                -- Transit time in days
    frequency VARCHAR(50),          -- Sailing frequency (weekly, twice a week)
    cutoff_days INTEGER,            -- Booking cutoff days
    free_days INTEGER DEFAULT 7,    -- Free time at destination
    
    -- Validity
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE NOT NULL DEFAULT '2099-12-31',
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_valid_dates CHECK (valid_to >= valid_from),
    CONSTRAINT chk_volume_range CHECK (max_volume_cbm IS NULL OR max_volume_cbm > min_volume_cbm),
    CONSTRAINT chk_weight_range CHECK (max_weight_kg IS NULL OR max_weight_kg > min_weight_kg),
    CONSTRAINT chk_rate_defined CHECK (
        (rate_basis = 'PER_CBM' AND rate_per_cbm IS NOT NULL) OR
        (rate_basis = 'PER_TON' AND rate_per_ton IS NOT NULL) OR
        (rate_basis = 'PER_KG' AND rate_per_kg IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_lcl_origin_dest ON lcl_ocean_freight_rate(origin_code, destination_code);
CREATE INDEX idx_lcl_vendor ON lcl_ocean_freight_rate(vendor_id);
CREATE INDEX idx_lcl_contract ON lcl_ocean_freight_rate(contract_id);
CREATE INDEX idx_lcl_valid_dates ON lcl_ocean_freight_rate(valid_from, valid_to);
CREATE INDEX idx_lcl_tenant ON lcl_ocean_freight_rate(tenant_id);
CREATE INDEX idx_lcl_volume_range ON lcl_ocean_freight_rate(min_volume_cbm, max_volume_cbm);
CREATE INDEX idx_lcl_weight_range ON lcl_ocean_freight_rate(min_weight_kg, max_weight_kg);

-- RLS Policy
ALTER TABLE lcl_ocean_freight_rate ENABLE ROW LEVEL SECURITY;

CREATE POLICY lcl_tenant_isolation ON lcl_ocean_freight_rate
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Comments
COMMENT ON TABLE lcl_ocean_freight_rate IS 'LCL ocean freight rates with volume/weight-based pricing';
COMMENT ON COLUMN lcl_ocean_freight_rate.rate_basis IS 'Pricing method: PER_CBM, PER_TON, PER_KG';
COMMENT ON COLUMN lcl_ocean_freight_rate.minimum_charge IS 'Absolute minimum charge regardless of volume/weight';
```

### 2. LCL Surcharges Table

```sql
CREATE TABLE lcl_surcharge (
    id BIGSERIAL PRIMARY KEY,
    
    -- Reference
    vendor_id BIGINT REFERENCES vendor(id),
    contract_id BIGINT REFERENCES rate_contract(id),
    
    -- Charge Information
    charge_code VARCHAR(50) NOT NULL REFERENCES charge_master(charge_code),
    charge_name VARCHAR(100),
    
    -- Application Scope
    applies_scope VARCHAR(20) CHECK (applies_scope IN ('origin', 'port', 'freight', 'dest', 'door', 'other')),
    
    -- Location
    origin_code VARCHAR(10),
    destination_code VARCHAR(10),
    
    -- Rate Structure (for LCL)
    rate_basis VARCHAR(20) CHECK (rate_basis IN ('PER_CBM', 'PER_TON', 'PER_SHIPMENT', 'FLAT', 'PERCENTAGE')),
    amount NUMERIC(10,2),           -- Base amount
    min_charge NUMERIC(10,2),       -- Minimum charge
    max_charge NUMERIC(10,2),       -- Maximum charge
    percentage NUMERIC(5,2),        -- For percentage-based charges
    
    -- Currency & Validity
    currency VARCHAR(3) NOT NULL DEFAULT 'USD' REFERENCES ref_currency(code),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE NOT NULL DEFAULT '2099-12-31',
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes and RLS (similar to FCL surcharge)
CREATE INDEX idx_lcl_surcharge_vendor ON lcl_surcharge(vendor_id);
CREATE INDEX idx_lcl_surcharge_charge_code ON lcl_surcharge(charge_code);
```

### 3. LCL Shipment Dimensions (for quotes)

```sql
CREATE TABLE lcl_shipment_item (
    id BIGSERIAL PRIMARY KEY,
    quote_id BIGINT,  -- Link to quote table (to be created)
    
    -- Dimensions
    length_cm NUMERIC(10,2) NOT NULL,
    width_cm NUMERIC(10,2) NOT NULL,
    height_cm NUMERIC(10,2) NOT NULL,
    volume_cbm NUMERIC(10,3) GENERATED ALWAYS AS (length_cm * width_cm * height_cm / 1000000) STORED,
    
    -- Weight
    gross_weight_kg NUMERIC(10,2) NOT NULL,
    net_weight_kg NUMERIC(10,2),
    
    -- Quantity
    pieces INTEGER NOT NULL DEFAULT 1,
    total_volume_cbm NUMERIC(10,3) GENERATED ALWAYS AS (volume_cbm * pieces) STORED,
    total_weight_kg NUMERIC(10,2) GENERATED ALWAYS AS (gross_weight_kg * pieces) STORED,
    
    -- Cargo Details
    commodity VARCHAR(255),
    hs_code VARCHAR(20),
    packaging_type VARCHAR(50),  -- Box, Pallet, Crate, Bag, etc.
    
    -- Special Requirements
    is_hazardous BOOLEAN DEFAULT false,
    is_temperature_controlled BOOLEAN DEFAULT false,
    temperature_range VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
);
```

---

## API Endpoints

### LCL Ocean Freight Rates

#### 1. POST /api/lcl/rates/search
```typescript
Request:
{
  origin_code: "INNSA",
  destination_code: "NLRTM",
  volume_cbm: 5.5,
  weight_kg: 800,
  commodity: "Electronics",
  is_hazardous: false
}

Response:
{
  success: true,
  rates: [
    {
      id: 123,
      vendor_name: "Maersk Line",
      origin: "INNSA",
      destination: "NLRTM",
      rate_basis: "PER_CBM",
      rate_per_cbm: 45.00,
      minimum_charge: 200.00,
      calculated_freight: 247.50,  // 5.5 CBM * $45
      surcharges: [
        { code: "OHC", name: "Origin Handling", amount: 50.00 },
        { code: "DHC", name: "Destination Handling", amount: 60.00 }
      ],
      total_amount: 357.50,
      currency: "USD",
      transit_days: 25,
      valid_until: "2025-12-31"
    }
  ]
}
```

#### 2. POST /api/lcl/rates (Create)
```typescript
Request:
{
  vendor_id: 1,
  contract_id: 5,
  origin_code: "INNSA",
  destination_code: "NLRTM",
  rate_basis: "PER_CBM",
  min_volume_cbm: 0,
  max_volume_cbm: 5,
  rate_per_cbm: 50.00,
  minimum_charge: 200.00,
  currency: "USD",
  valid_from: "2025-01-01",
  valid_to: "2025-12-31"
}
```

#### 3. GET /api/lcl/rates (List with filters)
#### 4. GET /api/lcl/rates/:id (Get single rate)
#### 5. PUT /api/lcl/rates/:id (Update)
#### 6. DELETE /api/lcl/rates/:id (Delete)
#### 7. POST /api/lcl/rates/bulk (Bulk upload)

---

## V4 API Integration

### Update: POST /api/v4/search-rates

Add `shipment_type` parameter:

```typescript
Request:
{
  origin: "INNSA",
  destination: "NLRTM",
  shipment_type: "LCL",  // NEW: "FCL" or "LCL"
  
  // For FCL (existing)
  container_type: "40HC",
  container_count: 1,
  
  // For LCL (new)
  volume_cbm: 5.5,
  weight_kg: 800,
  commodity: "Electronics",
  items: [
    {
      length_cm: 100,
      width_cm: 120,
      height_cm: 150,
      weight_kg: 400,
      pieces: 2
    }
  ]
}

Response:
{
  success: true,
  shipment_type: "LCL",
  fcl_rates: [],  // Empty for LCL
  lcl_rates: [
    {
      // LCL rate structure
    }
  ]
}
```

### Update: POST /api/v4/prepare-quote

Similar changes to support both FCL and LCL:

```typescript
Request:
{
  shipment_type: "LCL",
  origin: "INNSA",
  destination: "NLRTM",
  volume_cbm: 5.5,
  weight_kg: 800,
  selected_rate_id: 123,
  items: [...]
}

Response:
{
  quote_id: "Q-2025-00123",
  shipment_type: "LCL",
  freight_charges: {
    rate_per_cbm: 45.00,
    volume_cbm: 5.5,
    subtotal: 247.50
  },
  surcharges: [...],
  total: 357.50,
  breakdown: {
    freight: 247.50,
    origin_charges: 50.00,
    destination_charges: 60.00,
    margin: 35.00
  }
}
```

---

## LWC Components

### 1. LCL Rate Search Component (`lclRateSearch`)

Similar to `scheduleSearch` but for LCL:

**Features**:
- Origin/Destination lookups
- Volume input (CBM or dimensions)
- Weight input (KG)
- Commodity field
- Special requirements checkboxes
- Rate results display (cards)
- Compare multiple vendors
- Volume break indicators

### 2. LCL Rate Management (`lclOceanFreightTable`)

For managing LCL rates in RMS Management:

**Features**:
- Filter by origin/destination, vendor, contract
- Display volume tiers
- Show min/max volumes and rates
- CRUD operations
- Bulk upload support

### 3. Unified Search Component (`shipmentSearch`)

**Option**: Create a unified component that handles both FCL and LCL:

```html
<lightning-radio-group
    label="Shipment Type"
    options={shipmentTypeOptions}
    value={shipmentType}
    onchange={handleShipmentTypeChange}>
</lightning-radio-group>

<template if:true={isFCL}>
    <c-fcl-search-form></c-fcl-search-form>
</template>

<template if:true={isLCL}>
    <c-lcl-search-form></c-lcl-search-form>
</template>
```

---

## Implementation Phases

### Phase 1: Database Schema (2 hours)
- [ ] Create `lcl_ocean_freight_rate` table
- [ ] Create `lcl_surcharge` table
- [ ] Create `lcl_shipment_item` table
- [ ] Add indexes and RLS policies
- [ ] Insert sample data for testing

### Phase 2: API Layer (4-6 hours)
- [ ] Add 7 CRUD endpoints for LCL rates
- [ ] Add LCL surcharge endpoints
- [ ] Update V4 `/search-rates` to support `shipment_type`
- [ ] Update V4 `/prepare-quote` to handle LCL
- [ ] Add LCL pricing logic (volume tiers, minimum charges)
- [ ] Unit tests

### Phase 3: Apex Services (3-4 hours)
- [ ] Create `LCLOceanFreightService.cls`
- [ ] Create `LCLSurchargeService.cls`
- [ ] Add bulk methods
- [ ] Error handling and validation

### Phase 4: LWC Components (6-8 hours)
- [ ] Create `lclRateSearch` component
- [ ] Create `lclOceanFreightTable` component
- [ ] Update `rmsManagement` to include LCL tab
- [ ] Update `scheduleSearch` to toggle FCL/LCL
- [ ] Schema constants for LCL
- [ ] Testing and debugging

### Phase 5: Integration & Testing (2-3 hours)
- [ ] End-to-end testing (search → quote)
- [ ] Volume break testing
- [ ] Minimum charge testing
- [ ] Surcharge calculation testing
- [ ] User acceptance testing

---

## Total Estimated Effort

**17-23 hours** (2-3 working days)

---

## Success Criteria

1. ✅ LCL rates can be searched by origin/destination/volume/weight
2. ✅ Volume-based pricing tiers work correctly
3. ✅ Minimum charges applied when volume is below threshold
4. ✅ LCL surcharges calculated per CBM or per shipment
5. ✅ V4 API supports both FCL and LCL in same endpoint
6. ✅ LWC allows managing LCL rates (CRUD)
7. ✅ Quotes generated for LCL shipments
8. ✅ All data respects tenant isolation (RLS)

---

## Key Questions for User

1. **Volume Tiers**: How many volume breaks typically? (e.g., 0-1 CBM, 1-5 CBM, 5-10 CBM, 10+ CBM)
2. **Chargeable Weight**: Should we calculate chargeable weight (higher of actual weight or volumetric weight)?
3. **Consolidation**: Do we need to track which shipments are consolidated together?
4. **Direct vs Consolidated**: Should LCL rates support both direct LCL and consolidated LCL?
5. **Cubic Meter vs Cubic Foot**: Support CBM only, or also CFT?

---

## Next Steps

1. Review and approve this plan
2. Answer key questions above
3. Start with Phase 1 (Database Schema)
4. Build incrementally, test each phase

Ready to begin when you are! 🚀

