-- ============================================================================
-- LCL (Less than Container Load) Implementation - Phase 1
-- Date: 2025-11-20
-- Purpose: Create tables for LCL ocean freight rates and surcharges
-- ============================================================================

-- ============================================================================
-- 1. LCL OCEAN FREIGHT RATE TABLE
-- ============================================================================

CREATE TABLE lcl_ocean_freight_rate (
    id BIGSERIAL PRIMARY KEY,
    
    -- Contract Information
    vendor_id BIGINT NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    contract_id BIGINT REFERENCES rate_contract(id) ON DELETE CASCADE,
    
    -- Route Information
    origin_code VARCHAR(10) NOT NULL,
    destination_code VARCHAR(10) NOT NULL,
    via_port_code VARCHAR(10),  -- Transshipment port (optional)
    
    -- Service Type (nice-to-have for differentiation)
    service_type VARCHAR(20) DEFAULT 'CONSOLIDATED' CHECK (service_type IN ('DIRECT', 'CONSOLIDATED')),
    
    -- Rate Structure (Flexible - vendor defines tiers)
    rate_basis VARCHAR(20) NOT NULL CHECK (rate_basis IN ('PER_CBM', 'PER_TON', 'PER_KG', 'PER_CFT')),
    
    -- Volume-Based Rates (Tiered Pricing - per vendor)
    min_volume_cbm NUMERIC(10,3) DEFAULT 0.0,    -- Minimum volume for this rate tier
    max_volume_cbm NUMERIC(10,3),                 -- Maximum volume for this rate tier (NULL = unlimited)
    rate_per_cbm NUMERIC(10,2),                   -- Rate per CBM (if rate_basis = PER_CBM)
    rate_per_cft NUMERIC(10,2),                   -- Rate per CFT (if rate_basis = PER_CFT)
    
    -- Weight-Based Rates
    min_weight_kg NUMERIC(10,2) DEFAULT 0.0,      -- Minimum weight for this rate tier
    max_weight_kg NUMERIC(10,2),                  -- Maximum weight for this rate tier (NULL = unlimited)
    rate_per_kg NUMERIC(10,4),                    -- Rate per KG (if rate_basis = PER_KG)
    rate_per_ton NUMERIC(10,2),                   -- Rate per ton (if rate_basis = PER_TON)
    
    -- Minimum Charges
    minimum_charge NUMERIC(10,2) NOT NULL DEFAULT 0,     -- Absolute minimum charge
    minimum_volume_cbm NUMERIC(10,3) DEFAULT 1.0,        -- Minimum billable volume
    minimum_weight_kg NUMERIC(10,2) DEFAULT 100.0,       -- Minimum billable weight
    
    -- Chargeable Weight Calculation
    apply_volumetric_weight BOOLEAN DEFAULT true,        -- Use MAX(actual, volumetric)
    volumetric_factor INTEGER DEFAULT 1000,              -- CBM to KG conversion (1 CBM = 1000 KG standard for ocean)
    
    -- Revenue/Cost (optional - for margin tracking)
    buy_amount NUMERIC(10,2),                     -- Cost from vendor (per unit)
    sell_amount NUMERIC(10,2),                    -- Selling price (per unit)
    margin_percentage NUMERIC(5,2),               -- Margin %
    
    -- Currency
    currency VARCHAR(3) NOT NULL DEFAULT 'USD' REFERENCES ref_currency(code),
    
    -- Transit & Service Info
    tt_days INTEGER,                              -- Transit time in days
    frequency VARCHAR(50),                        -- Sailing frequency
    cutoff_days INTEGER DEFAULT 3,                -- Booking cutoff days before sailing
    free_days INTEGER DEFAULT 7,                  -- Free time at destination port
    
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
    CONSTRAINT chk_lcl_valid_dates CHECK (valid_to >= valid_from),
    CONSTRAINT chk_lcl_volume_range CHECK (max_volume_cbm IS NULL OR max_volume_cbm >= min_volume_cbm),
    CONSTRAINT chk_lcl_weight_range CHECK (max_weight_kg IS NULL OR max_weight_kg >= min_weight_kg),
    CONSTRAINT chk_lcl_rate_defined CHECK (
        (rate_basis = 'PER_CBM' AND rate_per_cbm IS NOT NULL) OR
        (rate_basis = 'PER_CFT' AND rate_per_cft IS NOT NULL) OR
        (rate_basis = 'PER_TON' AND rate_per_ton IS NOT NULL) OR
        (rate_basis = 'PER_KG' AND rate_per_kg IS NOT NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_lcl_origin_dest ON lcl_ocean_freight_rate(origin_code, destination_code);
CREATE INDEX idx_lcl_vendor ON lcl_ocean_freight_rate(vendor_id);
CREATE INDEX idx_lcl_contract ON lcl_ocean_freight_rate(contract_id);
CREATE INDEX idx_lcl_valid_dates ON lcl_ocean_freight_rate(valid_from, valid_to);
CREATE INDEX idx_lcl_tenant ON lcl_ocean_freight_rate(tenant_id);
CREATE INDEX idx_lcl_volume_range ON lcl_ocean_freight_rate(min_volume_cbm, max_volume_cbm);
CREATE INDEX idx_lcl_weight_range ON lcl_ocean_freight_rate(min_weight_kg, max_weight_kg);
CREATE INDEX idx_lcl_service_type ON lcl_ocean_freight_rate(service_type);
CREATE INDEX idx_lcl_rate_basis ON lcl_ocean_freight_rate(rate_basis);
CREATE INDEX idx_lcl_active ON lcl_ocean_freight_rate(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE lcl_ocean_freight_rate ENABLE ROW LEVEL SECURITY;

CREATE POLICY lcl_rate_tenant_isolation ON lcl_ocean_freight_rate
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Table and column comments
COMMENT ON TABLE lcl_ocean_freight_rate IS 'LCL ocean freight rates with flexible volume/weight-based tiered pricing per vendor';
COMMENT ON COLUMN lcl_ocean_freight_rate.rate_basis IS 'Pricing method: PER_CBM (standard), PER_CFT (imperial), PER_TON, PER_KG';
COMMENT ON COLUMN lcl_ocean_freight_rate.service_type IS 'DIRECT (dedicated, faster) or CONSOLIDATED (shared, cheaper)';
COMMENT ON COLUMN lcl_ocean_freight_rate.apply_volumetric_weight IS 'If true, chargeable weight = MAX(actual_weight, volume_cbm * volumetric_factor)';
COMMENT ON COLUMN lcl_ocean_freight_rate.volumetric_factor IS 'CBM to KG conversion factor (default 1000 for ocean, 167 for air)';
COMMENT ON COLUMN lcl_ocean_freight_rate.minimum_charge IS 'Absolute minimum charge regardless of volume/weight';
COMMENT ON COLUMN lcl_ocean_freight_rate.min_volume_cbm IS 'Start of volume tier (e.g., 0-1 CBM, 1-5 CBM, 5-10 CBM)';
COMMENT ON COLUMN lcl_ocean_freight_rate.max_volume_cbm IS 'End of volume tier (NULL = unlimited/10+ CBM)';

-- ============================================================================
-- 2. LCL SURCHARGE TABLE
-- ============================================================================

CREATE TABLE lcl_surcharge (
    id BIGSERIAL PRIMARY KEY,
    
    -- Reference
    vendor_id BIGINT REFERENCES vendor(id) ON DELETE CASCADE,
    contract_id BIGINT REFERENCES rate_contract(id) ON DELETE CASCADE,
    
    -- Charge Information
    charge_code VARCHAR(50) NOT NULL REFERENCES charge_master(charge_code),
    charge_name VARCHAR(100),
    
    -- Application Scope
    applies_scope VARCHAR(20) CHECK (applies_scope IN ('origin', 'port', 'freight', 'dest', 'door', 'other')),
    
    -- Location (optional - for location-specific charges)
    origin_code VARCHAR(10),
    destination_code VARCHAR(10),
    
    -- Rate Structure for LCL
    rate_basis VARCHAR(20) NOT NULL CHECK (rate_basis IN ('PER_CBM', 'PER_CFT', 'PER_TON', 'PER_KG', 'PER_SHIPMENT', 'FLAT', 'PERCENTAGE')),
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,      -- Base amount per unit
    min_charge NUMERIC(10,2),                     -- Minimum charge
    max_charge NUMERIC(10,2),                     -- Maximum charge
    percentage NUMERIC(5,2),                      -- For percentage-based charges (e.g., insurance)
    
    -- Currency
    currency VARCHAR(3) NOT NULL DEFAULT 'USD' REFERENCES ref_currency(code),
    
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
    CONSTRAINT chk_lcl_surcharge_valid_dates CHECK (valid_to >= valid_from),
    CONSTRAINT chk_lcl_surcharge_percentage CHECK (
        (rate_basis != 'PERCENTAGE') OR 
        (rate_basis = 'PERCENTAGE' AND percentage IS NOT NULL AND percentage >= 0 AND percentage <= 100)
    )
);

-- Indexes
CREATE INDEX idx_lcl_surcharge_vendor ON lcl_surcharge(vendor_id);
CREATE INDEX idx_lcl_surcharge_contract ON lcl_surcharge(contract_id);
CREATE INDEX idx_lcl_surcharge_charge_code ON lcl_surcharge(charge_code);
CREATE INDEX idx_lcl_surcharge_origin ON lcl_surcharge(origin_code);
CREATE INDEX idx_lcl_surcharge_dest ON lcl_surcharge(destination_code);
CREATE INDEX idx_lcl_surcharge_tenant ON lcl_surcharge(tenant_id);
CREATE INDEX idx_lcl_surcharge_active ON lcl_surcharge(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE lcl_surcharge ENABLE ROW LEVEL SECURITY;

CREATE POLICY lcl_surcharge_tenant_isolation ON lcl_surcharge
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Comments
COMMENT ON TABLE lcl_surcharge IS 'LCL-specific surcharges with flexible rate basis (per CBM, per shipment, etc.)';
COMMENT ON COLUMN lcl_surcharge.rate_basis IS 'PER_CBM, PER_CFT, PER_TON, PER_KG, PER_SHIPMENT (flat per shipment), PERCENTAGE (of freight)';

-- ============================================================================
-- 3. LCL SHIPMENT ITEM TABLE (for quote/enquiry tracking)
-- ============================================================================

CREATE TABLE lcl_shipment_item (
    id BIGSERIAL PRIMARY KEY,
    enquiry_id VARCHAR(50),  -- Link to enquiry/quote reference
    
    -- Dimensions (in CM for consistency)
    length_cm NUMERIC(10,2) NOT NULL CHECK (length_cm > 0),
    width_cm NUMERIC(10,2) NOT NULL CHECK (width_cm > 0),
    height_cm NUMERIC(10,2) NOT NULL CHECK (height_cm > 0),
    
    -- Volume (auto-calculated)
    volume_cbm NUMERIC(10,3) GENERATED ALWAYS AS (length_cm * width_cm * height_cm / 1000000) STORED,
    volume_cft NUMERIC(10,3) GENERATED ALWAYS AS (length_cm * width_cm * height_cm / 28316.846592) STORED,
    
    -- Weight
    gross_weight_kg NUMERIC(10,2) NOT NULL CHECK (gross_weight_kg > 0),
    net_weight_kg NUMERIC(10,2),
    
    -- Volumetric Weight (auto-calculated with standard factor 1000)
    volumetric_weight_kg NUMERIC(10,2) GENERATED ALWAYS AS ((length_cm * width_cm * height_cm / 1000000) * 1000) STORED,
    
    -- Chargeable Weight (auto-calculated: MAX of actual or volumetric)
    chargeable_weight_kg NUMERIC(10,2) GENERATED ALWAYS AS (
        GREATEST(gross_weight_kg, (length_cm * width_cm * height_cm / 1000000) * 1000)
    ) STORED,
    
    -- Quantity
    pieces INTEGER NOT NULL DEFAULT 1 CHECK (pieces > 0),
    
    -- Total calculations
    total_volume_cbm NUMERIC(10,3) GENERATED ALWAYS AS (volume_cbm * pieces) STORED,
    total_volume_cft NUMERIC(10,3) GENERATED ALWAYS AS (volume_cft * pieces) STORED,
    total_weight_kg NUMERIC(10,2) GENERATED ALWAYS AS (gross_weight_kg * pieces) STORED,
    total_chargeable_weight_kg NUMERIC(10,2) GENERATED ALWAYS AS (
        GREATEST(gross_weight_kg, (length_cm * width_cm * height_cm / 1000000) * 1000) * pieces
    ) STORED,
    
    -- Cargo Details
    commodity VARCHAR(255),
    hs_code VARCHAR(20),
    packaging_type VARCHAR(50),  -- Box, Pallet, Crate, Bag, Carton, etc.
    
    -- Special Requirements
    is_hazardous BOOLEAN DEFAULT false,
    un_number VARCHAR(10),  -- UN number for hazardous goods
    is_temperature_controlled BOOLEAN DEFAULT false,
    temperature_range VARCHAR(50),  -- e.g., "2-8°C", "-18°C", "15-25°C"
    is_stackable BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_lcl_item_enquiry ON lcl_shipment_item(enquiry_id);
CREATE INDEX idx_lcl_item_tenant ON lcl_shipment_item(tenant_id);
CREATE INDEX idx_lcl_item_hazardous ON lcl_shipment_item(is_hazardous) WHERE is_hazardous = true;

-- Row Level Security
ALTER TABLE lcl_shipment_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY lcl_item_tenant_isolation ON lcl_shipment_item
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Comments
COMMENT ON TABLE lcl_shipment_item IS 'Individual items in LCL shipments with auto-calculated volume and chargeable weight';
COMMENT ON COLUMN lcl_shipment_item.volumetric_weight_kg IS 'Auto-calculated: volume_cbm × 1000 (standard ocean freight factor)';
COMMENT ON COLUMN lcl_shipment_item.chargeable_weight_kg IS 'Auto-calculated: MAX(actual_weight, volumetric_weight) - used for pricing';
COMMENT ON COLUMN lcl_shipment_item.volume_cbm IS 'Auto-calculated from dimensions: L × W × H / 1,000,000';
COMMENT ON COLUMN lcl_shipment_item.volume_cft IS 'Auto-calculated from dimensions: L × W × H / 28,316.846592';

-- ============================================================================
-- 4. HELPER FUNCTION: Calculate LCL Freight Cost
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_lcl_freight_cost(
    p_rate_id BIGINT,
    p_volume_cbm NUMERIC,
    p_weight_kg NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_rate RECORD;
    v_chargeable_weight_kg NUMERIC;
    v_chargeable_volume_cbm NUMERIC;
    v_freight_cost NUMERIC;
    v_basis VARCHAR(20);
BEGIN
    -- Get rate details
    SELECT * INTO v_rate
    FROM lcl_ocean_freight_rate
    WHERE id = p_rate_id
      AND is_active = true
      AND CURRENT_DATE BETWEEN valid_from AND valid_to;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Rate not found or expired'
        );
    END IF;
    
    -- Calculate chargeable weight (if volumetric weight applies)
    IF v_rate.apply_volumetric_weight THEN
        v_chargeable_weight_kg := GREATEST(p_weight_kg, p_volume_cbm * v_rate.volumetric_factor);
    ELSE
        v_chargeable_weight_kg := p_weight_kg;
    END IF;
    
    -- Apply minimum volume/weight
    v_chargeable_volume_cbm := GREATEST(p_volume_cbm, v_rate.minimum_volume_cbm);
    v_chargeable_weight_kg := GREATEST(v_chargeable_weight_kg, v_rate.minimum_weight_kg);
    
    -- Calculate freight cost based on rate basis
    CASE v_rate.rate_basis
        WHEN 'PER_CBM' THEN
            v_freight_cost := v_chargeable_volume_cbm * v_rate.rate_per_cbm;
            v_basis := 'CBM';
        WHEN 'PER_CFT' THEN
            v_freight_cost := (v_chargeable_volume_cbm * 35.3147) * v_rate.rate_per_cft;
            v_basis := 'CFT';
        WHEN 'PER_TON' THEN
            v_freight_cost := (v_chargeable_weight_kg / 1000) * v_rate.rate_per_ton;
            v_basis := 'TON';
        WHEN 'PER_KG' THEN
            v_freight_cost := v_chargeable_weight_kg * v_rate.rate_per_kg;
            v_basis := 'KG';
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid rate basis'
            );
    END CASE;
    
    -- Apply minimum charge
    v_freight_cost := GREATEST(v_freight_cost, v_rate.minimum_charge);
    
    -- Return detailed breakdown
    RETURN jsonb_build_object(
        'success', true,
        'freight_cost', ROUND(v_freight_cost, 2),
        'rate_basis', v_basis,
        'chargeable_volume_cbm', ROUND(v_chargeable_volume_cbm, 3),
        'chargeable_weight_kg', ROUND(v_chargeable_weight_kg, 2),
        'volumetric_weight_kg', ROUND(p_volume_cbm * v_rate.volumetric_factor, 2),
        'actual_weight_kg', p_weight_kg,
        'rate_applied', CASE 
            WHEN v_rate.rate_basis = 'PER_CBM' THEN v_rate.rate_per_cbm
            WHEN v_rate.rate_basis = 'PER_CFT' THEN v_rate.rate_per_cft
            WHEN v_rate.rate_basis = 'PER_TON' THEN v_rate.rate_per_ton
            WHEN v_rate.rate_basis = 'PER_KG' THEN v_rate.rate_per_kg
        END,
        'minimum_charge_applied', v_freight_cost = v_rate.minimum_charge,
        'currency', v_rate.currency
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_lcl_freight_cost IS 'Calculate LCL freight cost with chargeable weight logic: MAX(actual_weight, volumetric_weight)';

-- ============================================================================
-- 5. INSERT SAMPLE DATA FOR TESTING
-- ============================================================================

-- Sample LCL rates from various vendors with different tiers
INSERT INTO lcl_ocean_freight_rate (
    vendor_id, origin_code, destination_code, service_type, rate_basis,
    min_volume_cbm, max_volume_cbm, rate_per_cbm, minimum_charge,
    currency, tt_days, valid_from, valid_to, tenant_id
) VALUES
-- Maersk: Tiered pricing for INNSA-NLRTM
(1, 'INNSA', 'NLRTM', 'CONSOLIDATED', 'PER_CBM', 0.0, 1.0, 60.00, 80.00, 'USD', 28, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001'),
(1, 'INNSA', 'NLRTM', 'CONSOLIDATED', 'PER_CBM', 1.0, 5.0, 50.00, NULL, 'USD', 28, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001'),
(1, 'INNSA', 'NLRTM', 'CONSOLIDATED', 'PER_CBM', 5.0, 10.0, 45.00, NULL, 'USD', 28, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001'),
(1, 'INNSA', 'NLRTM', 'CONSOLIDATED', 'PER_CBM', 10.0, NULL, 40.00, NULL, 'USD', 28, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001'),

-- MSC: Different tier structure for INMUN-DEHAM
(2, 'INMUN', 'DEHAM', 'CONSOLIDATED', 'PER_CBM', 0.0, 2.0, 55.00, 100.00, 'EUR', 25, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001'),
(2, 'INMUN', 'DEHAM', 'CONSOLIDATED', 'PER_CBM', 2.0, 8.0, 48.00, NULL, 'EUR', 25, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001'),
(2, 'INMUN', 'DEHAM', 'CONSOLIDATED', 'PER_CBM', 8.0, NULL, 42.00, NULL, 'EUR', 25, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001'),

-- CMA CGM: Direct LCL service (premium, faster)
(3, 'INNSA', 'NLRTM', 'DIRECT', 'PER_CBM', 0.0, NULL, 80.00, 150.00, 'USD', 20, '2025-01-01', '2025-12-31', '00000000-0000-0000-0000-000000000001');

-- Sample LCL surcharges
INSERT INTO lcl_surcharge (
    vendor_id, charge_code, applies_scope, rate_basis, amount, currency, tenant_id
) VALUES
(1, 'OHC', 'origin', 'PER_CBM', 15.00, 'USD', '00000000-0000-0000-0000-000000000001'),
(1, 'DHC', 'dest', 'PER_CBM', 18.00, 'USD', '00000000-0000-0000-0000-000000000001'),
(1, 'DOC_FEE', 'other', 'PER_SHIPMENT', 25.00, 'USD', '00000000-0000-0000-0000-000000000001');

-- ============================================================================
-- 6. VERIFICATION QUERIES
-- ============================================================================

-- Check tables created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name LIKE 'lcl_%' 
  AND table_schema = 'public'
ORDER BY table_name;

-- Check sample data
SELECT 
    id,
    vendor_id,
    origin_code,
    destination_code,
    service_type,
    rate_basis,
    min_volume_cbm,
    max_volume_cbm,
    rate_per_cbm,
    minimum_charge,
    currency
FROM lcl_ocean_freight_rate
ORDER BY origin_code, destination_code, min_volume_cbm;

-- Test freight calculation function
SELECT calculate_lcl_freight_cost(
    1,      -- rate_id
    3.5,    -- volume_cbm
    500     -- weight_kg
);

COMMIT;

