-- ============================================================================
-- Update LCL Pricing Function - Remove PER_CFT references
-- ============================================================================

DROP FUNCTION IF EXISTS calculate_lcl_freight_cost(BIGINT, NUMERIC, NUMERIC);

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
        WHEN 'PER_TON' THEN
            v_freight_cost := (v_chargeable_weight_kg / 1000) * v_rate.rate_per_ton;
            v_basis := 'TON';
        WHEN 'PER_KG' THEN
            v_freight_cost := v_chargeable_weight_kg * v_rate.rate_per_kg;
            v_basis := 'KG';
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid rate basis: ' || v_rate.rate_basis
            );
    END CASE;
    
    -- Apply minimum charge
    v_freight_cost := GREATEST(v_freight_cost, COALESCE(v_rate.minimum_charge, 0));
    
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
            WHEN v_rate.rate_basis = 'PER_TON' THEN v_rate.rate_per_ton
            WHEN v_rate.rate_basis = 'PER_KG' THEN v_rate.rate_per_kg
        END,
        'minimum_charge_applied', v_freight_cost = COALESCE(v_rate.minimum_charge, 0),
        'currency', v_rate.currency
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_lcl_freight_cost IS 'Calculate LCL freight cost with chargeable weight logic: MAX(actual_weight, volumetric_weight)';

-- Test the function
SELECT calculate_lcl_freight_cost(
    14,     -- rate_id (3-5 CBM slab for Maersk INNSA-NLRTM)
    3.5,    -- volume_cbm
    500     -- weight_kg
);

SELECT calculate_lcl_freight_cost(
    13,     -- rate_id (0-3 CBM slab, should apply $80 minimum)
    1.0,    -- volume_cbm
    100     -- weight_kg
);

