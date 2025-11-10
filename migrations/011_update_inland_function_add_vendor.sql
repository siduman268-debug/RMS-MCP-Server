-- Migration: Update simplified_inland_function to accept vendor_id and prioritize carrier-matched haulage rates

DROP FUNCTION IF EXISTS simplified_inland_function(TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION simplified_inland_function(
    p_pol_code TEXT,
    p_pod_code TEXT,
    p_container_type TEXT,
    p_container_count INTEGER,
    p_cargo_weight_mt NUMERIC,
    p_haulage_type TEXT,
    p_vendor_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_pol_id UUID;
    v_pod_id UUID;
    v_pol_is_inland BOOLEAN;
    v_pod_is_inland BOOLEAN;
    v_ihe_charges JSONB;
    v_ihi_charges JSONB;
    v_haulage_record RECORD;
    v_haulage_route_record RECORD;
    v_exchange_rate NUMERIC := 83.0; -- Default fallback
    v_ihe_buy_inr NUMERIC := 0;
    v_ihe_sell_inr NUMERIC := 0;
    v_ihe_buy_usd NUMERIC := 0;
    v_ihe_sell_usd NUMERIC := 0;
    v_ihi_buy_inr NUMERIC := 0;
    v_ihi_sell_inr NUMERIC := 0;
    v_ihi_buy_usd NUMERIC := 0;
    v_ihi_sell_usd NUMERIC := 0;
BEGIN
    -- Step 1: Get current exchange rate from fx_rate table
    BEGIN
        SELECT (1.0 / rate) as usd_to_inr_rate
        INTO v_exchange_rate
        FROM fx_rate
        WHERE base_ccy = 'INR'
        AND quote_ccy = 'USD'
        AND rate_date = CURRENT_DATE
        ORDER BY rate_date DESC
        LIMIT 1;

        IF v_exchange_rate IS NULL THEN
            SELECT (1.0 / rate) as usd_to_inr_rate
            INTO v_exchange_rate
            FROM fx_rate
            WHERE base_ccy = 'INR'
            AND quote_ccy = 'USD'
            ORDER BY rate_date DESC
            LIMIT 1;
        END IF;

        IF v_exchange_rate IS NULL THEN
            v_exchange_rate := 83.0;
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            v_exchange_rate := 83.0;
    END;

    -- Step 2: Get location IDs and check if inland
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

    -- Step 3: Check if IHE is needed (POL is inland AND haulage_type is 'carrier')
    IF v_pol_is_inland AND p_haulage_type = 'carrier' THEN
        BEGIN
            SELECT
                hr.id as route_id,
                hr.route_name,
                hr.total_distance_km,
                hr.avg_transit_days,
                gateway.unlocode as gateway_code,
                gateway.location_name as gateway_name
            INTO v_haulage_route_record
            FROM haulage_route hr
            JOIN locations gateway ON hr.to_location_id = gateway.id
            WHERE hr.from_location_id = v_pol_id
            AND hr.is_active = true
            LIMIT 1;

            IF v_haulage_route_record.route_id IS NOT NULL THEN
                SELECT
                    hrate.id,
                    hrate.rate_per_container,
                    hrate.flat_rate,
                    hrate.currency,
                    v.name as vendor_name
                INTO v_haulage_record
                FROM haulage_rate hrate
                JOIN vendor v ON hrate.vendor_id = v.id
                WHERE hrate.route_id = v_haulage_route_record.route_id
                AND hrate.container_type = p_container_type
                AND (
                    (hrate.min_weight_kg IS NULL AND hrate.max_weight_kg IS NULL) OR
                    (hrate.min_weight_kg IS NULL AND hrate.max_weight_kg >= (p_cargo_weight_mt * 1000)) OR
                    (hrate.max_weight_kg IS NULL AND hrate.min_weight_kg <= (p_cargo_weight_mt * 1000)) OR
                    (hrate.min_weight_kg <= (p_cargo_weight_mt * 1000) AND hrate.max_weight_kg >= (p_cargo_weight_mt * 1000))
                )
                AND CURRENT_DATE BETWEEN hrate.valid_from AND hrate.valid_to
                AND hrate.is_active = true
                AND (p_vendor_id IS NULL OR hrate.vendor_id = p_vendor_id)
                ORDER BY hrate.vendor_id = p_vendor_id DESC, hrate.rate_per_container ASC
                LIMIT 1;

                IF v_haulage_record.id IS NOT NULL THEN
                    v_ihe_buy_inr := v_haulage_record.rate_per_container * p_container_count;
                    v_ihe_sell_inr := v_haulage_record.rate_per_container * p_container_count;
                    v_ihe_buy_usd := v_ihe_buy_inr / v_exchange_rate;
                    v_ihe_sell_usd := v_ihe_sell_inr / v_exchange_rate;

                    v_ihe_charges := jsonb_build_object(
                        'found', true,
                        'rate_id', v_haulage_record.id,
                        'rate_per_container_inr', v_haulage_record.rate_per_container,
                        'total_amount_inr', v_ihe_buy_inr,
                        'total_amount_usd', v_ihe_buy_usd,
                        'currency', v_haulage_record.currency,
                        'exchange_rate', v_exchange_rate,
                        'vendor_name', v_haulage_record.vendor_name,
                        'route_name', v_haulage_route_record.route_name,
                        'haulage_type', 'IHE'
                    );
                ELSE
                    v_ihe_charges := jsonb_build_object(
                        'found', false,
                        'message', 'No IHE haulage rate found for weight ' || p_cargo_weight_mt || ' MT'
                    );
                END IF;
            ELSE
                v_ihe_charges := jsonb_build_object(
                    'found', false,
                    'message', 'No IHE haulage route found from ' || p_pol_code
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
        IF NOT v_pol_is_inland THEN
            v_ihe_charges := jsonb_build_object(
                'found', false,
                'message', 'POL is not inland, no IHE needed'
            );
        ELSE
            v_ihe_charges := jsonb_build_object(
                'found', false,
                'message', 'Haulage type is ' || p_haulage_type || ', IHE not needed for merchant haulage'
            );
        END IF;
    END IF;

    -- Step 4: Check if IHI is needed (POD is inland AND haulage_type is 'carrier')
    IF v_pod_is_inland AND p_haulage_type = 'carrier' THEN
        BEGIN
            SELECT
                hr.id as route_id,
                hr.route_name,
                hr.total_distance_km,
                hr.avg_transit_days,
                gateway.unlocode as gateway_code,
                gateway.location_name as gateway_name
            INTO v_haulage_route_record
            FROM haulage_route hr
            JOIN locations gateway ON hr.from_location_id = gateway.id
            WHERE hr.to_location_id = v_pod_id
            AND hr.is_active = true
            LIMIT 1;

            IF v_haulage_route_record.route_id IS NOT NULL THEN
                SELECT
                    hrate.id,
                    hrate.rate_per_container,
                    hrate.flat_rate,
                    hrate.currency,
                    v.name as vendor_name
                INTO v_haulage_record
                FROM haulage_rate hrate
                JOIN vendor v ON hrate.vendor_id = v.id
                WHERE hrate.route_id = v_haulage_route_record.route_id
                AND hrate.container_type = p_container_type
                AND (
                    (hrate.min_weight_kg IS NULL AND hrate.max_weight_kg IS NULL) OR
                    (hrate.min_weight_kg IS NULL AND hrate.max_weight_kg >= (p_cargo_weight_mt * 1000)) OR
                    (hrate.max_weight_kg IS NULL AND hrate.min_weight_kg <= (p_cargo_weight_mt * 1000)) OR
                    (hrate.min_weight_kg <= (p_cargo_weight_mt * 1000) AND hrate.max_weight_kg >= (p_cargo_weight_mt * 1000))
                )
                AND CURRENT_DATE BETWEEN hrate.valid_from AND hrate.valid_to
                AND hrate.is_active = true
                AND (p_vendor_id IS NULL OR hrate.vendor_id = p_vendor_id)
                ORDER BY hrate.vendor_id = p_vendor_id DESC, hrate.rate_per_container ASC
                LIMIT 1;

                IF v_haulage_record.id IS NOT NULL THEN
                    v_ihi_buy_inr := v_haulage_record.rate_per_container * p_container_count;
                    v_ihi_sell_inr := v_haulage_record.rate_per_container * p_container_count;
                    v_ihi_buy_usd := v_ihi_buy_inr / v_exchange_rate;
                    v_ihi_sell_usd := v_ihi_sell_inr / v_exchange_rate;

                    v_ihi_charges := jsonb_build_object(
                        'found', true,
                        'rate_id', v_haulage_record.id,
                        'rate_per_container_inr', v_haulage_record.rate_per_container,
                        'total_amount_inr', v_ihi_buy_inr,
                        'total_amount_usd', v_ihi_buy_usd,
                        'currency', v_haulage_record.currency,
                        'exchange_rate', v_exchange_rate,
                        'vendor_name', v_haulage_record.vendor_name,
                        'route_name', v_haulage_route_record.route_name,
                        'haulage_type', 'IHI'
                    );
                ELSE
                    v_ihi_charges := jsonb_build_object(
                        'found', false,
                        'message', 'No IHI haulage rate found for weight ' || p_cargo_weight_mt || ' MT'
                    );
                END IF;
            ELSE
                v_ihi_charges := jsonb_build_object(
                    'found', false,
                    'message', 'No IHI haulage route found to ' || p_pod_code
                );
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                v_ihi_charges := jsonb_build_object(
                    'found', false,
                    'error', SQLERRM::TEXT
                );
        END;
    ELSE
        IF NOT v_pod_is_inland THEN
            v_ihi_charges := jsonb_build_object(
                'found', false,
                'message', 'POD is not inland, no IHI needed'
            );
        ELSE
            v_ihi_charges := jsonb_build_object(
                'found', false,
                'message', 'Haulage type is ' || p_haulage_type || ', IHI not needed for merchant haulage'
            );
        END IF;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'pol_code', p_pol_code,
        'pod_code', p_pod_code,
        'pol_is_inland', v_pol_is_inland,
        'pod_is_inland', v_pod_is_inland,
        'container_type', p_container_type,
        'container_count', p_container_count,
        'haulage_type', p_haulage_type,
        'ihe_charges', v_ihe_charges,
        'ihi_charges', v_ihi_charges,
        'exchange_rate', v_exchange_rate,
        'message', 'V3 function - IHE and IHI haulage logic completed'
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_message', 'V3 function error: ' || SQLERRM::TEXT
        );
END;
$$ LANGUAGE plpgsql;

