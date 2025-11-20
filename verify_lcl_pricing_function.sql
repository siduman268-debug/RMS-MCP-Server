-- ============================================================================
-- LCL Pricing Function Verification
-- ============================================================================

-- Step 1: Check what rates exist
SELECT 
    id,
    vendor_id,
    origin_code,
    destination_code,
    pricing_model,
    min_volume_cbm,
    max_volume_cbm,
    rate_per_cbm,
    minimum_charge,
    is_active,
    valid_from,
    valid_to
FROM lcl_ocean_freight_rate
ORDER BY origin_code, destination_code, min_volume_cbm;

-- Step 2: Test pricing function with correct rate ID
-- Example: 3.5 CBM shipment, 500 kg weight
-- Should match the 3-5 CBM slab for INNSA-NLRTM (rate_id = 14, $52/CBM)

SELECT calculate_lcl_freight_cost(
    14,     -- rate_id (3-5 CBM slab for Maersk INNSA-NLRTM)
    3.5,    -- volume_cbm
    500     -- weight_kg
);

-- Step 3: Test with first slab (should apply minimum charge)
SELECT calculate_lcl_freight_cost(
    13,     -- rate_id (0-3 CBM slab for Maersk INNSA-NLRTM)
    1.5,    -- volume_cbm (below minimum charge threshold)
    200     -- weight_kg
);

-- Step 4: Test volumetric weight trigger
-- 3.5 CBM × 1000 = 3500 kg volumetric weight > 500 kg actual
-- Chargeable weight should be 3500 kg
SELECT calculate_lcl_freight_cost(
    14,     -- rate_id (3-5 CBM slab)
    3.5,    -- volume_cbm
    500     -- weight_kg (lighter than volumetric)
);

-- Step 5: Test FLAT_RATE pricing (CMA CGM)
SELECT calculate_lcl_freight_cost(
    23,     -- rate_id (CMA CGM INNSA-NLRTM Direct, FLAT_RATE)
    5.0,    -- volume_cbm
    2000    -- weight_kg
);

-- Step 6: Verify current date is within validity period
SELECT 
    id,
    origin_code || '-' || destination_code AS route,
    valid_from,
    valid_to,
    CURRENT_DATE BETWEEN valid_from AND valid_to AS is_valid_today
FROM lcl_ocean_freight_rate;

