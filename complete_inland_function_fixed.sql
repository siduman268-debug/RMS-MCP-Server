-- Complete inland function with IHE logic - FIXED VERSION
-- This will add IHE charges when POL is inland, even if direct ocean freight exists

CREATE OR REPLACE FUNCTION complete_inland_function(
    p_pol_code TEXT,
    p_pod_code TEXT,
    p_container_type TEXT,
    p_container_count INTEGER,
    p_cargo_weight_mt NUMERIC,
    p_incoterm TEXT,
    p_haulage_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_pol_id UUID;
    v_pod_id UUID;
    v_pol_is_inland BOOLEAN;
    v_pod_is_inland BOOLEAN;
    v_route_info JSONB;
    v_pricing_info JSONB;
    v_ocean_freight JSONB;
    v_ihe_charges JSONB;
    v_rate_record RECORD;
    v_haulage_record RECORD;
    v_total_buy NUMERIC := 0;
    v_total_sell NUMERIC := 0;
BEGIN
    -- Step 1: Get location IDs and check if inland
    SELECT id, is_container_inland INTO v_pol_id, v_pol_is_inland
    FROM locations 
    WHERE unlocode = p_pol_code AND is_active = true;
    
    IF v_pol_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_message', 'POL location not found: ' || p_pol_code
        );
    END IF;
    
    SELECT id, is_container_inland INTO v_pod_id, v_pod_is_inland
    FROM locations 
    WHERE unlocode = p_pod_code AND is_active = true;
    
    IF v_pod_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_message', 'POD location not found: ' || p_pod_code
        );
    END IF;
    
    -- Step 2: Look for direct ocean freight
    BEGIN
        SELECT 
            rate_id,
            ocean_freight_buy,
            all_in_freight_sell,
            transit_days,
            vendor_id,
            carrier,
            is_preferred,
            valid_from,
            valid_to
        INTO v_rate_record
        FROM mv_freight_sell_prices
        WHERE pol_code = p_pol_code 
        AND pod_code = p_pod_code 
        AND container_type = p_container_type
        AND is_preferred = true
        AND CURRENT_DATE BETWEEN valid_from AND valid_to
        ORDER BY ocean_freight_buy ASC
        LIMIT 1;
        
        IF v_rate_record.rate_id IS NULL THEN
            v_ocean_freight := jsonb_build_object(
                'found', false,
                'message', 'No direct ocean freight rate found'
            );
        ELSE
            v_ocean_freight := jsonb_build_object(
                'found', true,
                'rate_id', v_rate_record.rate_id,
                'ocean_freight_buy', v_rate_record.ocean_freight_buy,
                'all_in_freight_sell', v_rate_record.all_in_freight_sell,
                'transit_days', v_rate_record.transit_days,
                'vendor_id', v_rate_record.vendor_id,
                'vendor_name', v_rate_record.carrier,
                'is_preferred', v_rate_record.is_preferred,
                'valid_from', v_rate_record.valid_from,
                'valid_to', v_rate_record.valid_to
            );
            v_total_buy := v_rate_record.ocean_freight_buy;
            v_total_sell := v_rate_record.all_in_freight_sell;
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            v_ocean_freight := jsonb_build_object(
                'found', false,
                'error', SQLERRM::TEXT
            );
    END;
    
    -- Step 3: Check if IHE is needed (POL is inland)
    IF v_pol_is_inland THEN
        BEGIN
            -- Look for haulage responsibility
            SELECT 
                ihe_arranged_by,
                ihe_paid_by,
                ihe_include_in_quote
            INTO v_haulage_record
            FROM haulage_responsibility
            WHERE term_code = p_incoterm
            AND is_active = true
            LIMIT 1;
            
            IF v_haulage_record.ihe_include_in_quote THEN
                -- Look for haulage route from inland to gateway
                SELECT 
                    hr.id as route_id,
                    hr.route_name,
                    hr.total_distance_km,
                    hr.avg_transit_days,
                    gateway.unlocode as gateway_code,
                    gateway.location_name as gateway_name
                INTO v_haulage_record
                FROM haulage_route hr
                JOIN locations gateway ON hr.to_location_id = gateway.id
                WHERE hr.from_location_id = v_pol_id
                AND hr.is_active = true
                LIMIT 1;
                
                IF v_haulage_record.route_id IS NOT NULL THEN
                    -- Look for haulage rate
                    SELECT 
                        hrate.id,
                        hrate.rate_per_container,
                        hrate.flat_rate,
                        hrate.currency,
                        v.name as vendor_name
                    INTO v_haulage_record
                    FROM haulage_rate hrate
                    JOIN vendor v ON hrate.vendor_id = v.id
                    WHERE hrate.route_id = v_haulage_record.route_id
                    AND hrate.container_type = p_container_type
                    AND hrate.min_weight_kg <= (p_cargo_weight_mt * 1000)
                    AND hrate.max_weight_kg >= (p_cargo_weight_mt * 1000)
                    AND CURRENT_DATE BETWEEN hrate.valid_from AND hrate.valid_to
                    AND hrate.is_active = true
                    ORDER BY hrate.rate_per_container ASC
                    LIMIT 1;
                    
                    IF v_haulage_record.id IS NOT NULL THEN
                        v_ihe_charges := jsonb_build_object(
                            'found', true,
                            'rate_id', v_haulage_record.id,
                            'rate_per_container', v_haulage_record.rate_per_container,
                            'flat_rate', v_haulage_record.flat_rate,
                            'currency', v_haulage_record.currency,
                            'vendor_name', v_haulage_record.vendor_name,
                            'total_amount', v_haulage_record.rate_per_container * p_container_count
                        );
                        v_total_buy := v_total_buy + (v_haulage_record.rate_per_container * p_container_count);
                        v_total_sell := v_total_sell + (v_haulage_record.rate_per_container * p_container_count);
                    ELSE
                        v_ihe_charges := jsonb_build_object(
                            'found', false,
                            'message', 'No haulage rate found for weight ' || p_cargo_weight_mt || ' MT'
                        );
                    END IF;
                ELSE
                    v_ihe_charges := jsonb_build_object(
                        'found', false,
                        'message', 'No haulage route found from ' || p_pol_code
                    );
                END IF;
            ELSE
                v_ihe_charges := jsonb_build_object(
                    'found', false,
                    'message', 'IHE not included in quote for incoterm ' || p_incoterm
                );
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_ihe_charges := jsonb_build_object(
                    'found', false,
                    'error', SQLERRM::TEXT
                );
        END;
    ELSE
        v_ihe_charges := jsonb_build_object(
            'found', false,
            'message', 'POL is not inland, no IHE needed'
        );
    END IF;
    
    -- Step 4: Build route information
    v_route_info := jsonb_build_object(
        'pol_code', p_pol_code,
        'pod_code', p_pod_code,
        'pol_id', v_pol_id,
        'pod_id', v_pod_id,
        'pol_is_inland', v_pol_is_inland,
        'pod_is_inland', v_pod_is_inland,
        'container_type', p_container_type,
        'container_count', p_container_count,
        'ocean_freight', v_ocean_freight,
        'ihe_charges', v_ihe_charges
    );
    
    -- Step 5: Build pricing information (with IHE included)
    v_pricing_info := jsonb_build_object(
        'total_buy', v_total_buy,
        'total_sell', v_total_sell,
        'margin', jsonb_build_object(
            'type', 'percentage',
            'percentage', 10,
            'amount', v_total_sell * 0.1
        ),
        'ocean_freight_found', COALESCE((v_ocean_freight->>'found')::BOOLEAN, false),
        'ihe_charges_found', COALESCE((v_ihe_charges->>'found')::BOOLEAN, false)
    );
    
    -- Step 6: Build final result
    v_result := jsonb_build_object(
        'success', true,
        'route', v_route_info,
        'pricing', v_pricing_info,
        'message', 'Complete inland function with IHE logic completed successfully'
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_message', 'Complete inland function error: ' || SQLERRM::TEXT
        );
END;
$$ LANGUAGE plpgsql;

