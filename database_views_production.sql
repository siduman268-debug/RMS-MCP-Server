-- ==========================================
-- PRODUCTION INLAND PRICING - REALISTIC SQL
-- ==========================================
-- Based on actual table structure and business logic

-- ==========================================
-- 1. CHECK IF LOCATION IS INLAND (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION check_port_type(p_port_code TEXT)
RETURNS TABLE (
  id BIGINT,
  port_code TEXT,
  port_name TEXT,
  is_inland BOOLEAN,
  gateway_id BIGINT,
  gateway_code TEXT,
  gateway_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.unlocode,
    l.location_name,
    (l.is_container_inland = true OR l.location_type IN ('ICD', 'CFS')),
    l.parent_location_id,
    gateway.unlocode,
    gateway.location_name
  FROM locations l
  LEFT JOIN locations gateway ON l.parent_location_id = gateway.id
  WHERE l.unlocode = p_port_code
    AND l.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 2. GET HAULAGE RESPONSIBILITY BY INCOTERM (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION get_haulage_responsibility(p_incoterm TEXT)
RETURNS TABLE (
  term_code TEXT,
  term_name TEXT,
  ihe_arranged_by TEXT,
  ihe_paid_by TEXT,
  ihe_include_in_quote BOOLEAN,
  ihi_arranged_by TEXT,
  ihi_paid_by TEXT,
  ihi_include_in_quote BOOLEAN,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hr.term_code,
    hr.term_name,
    hr.ihe_arranged_by,
    hr.ihe_paid_by,
    hr.ihe_include_in_quote,
    hr.ihi_arranged_by,
    hr.ihi_paid_by,
    hr.ihi_include_in_quote,
    hr.description
  FROM haulage_responsibility hr
  WHERE hr.term_code = p_incoterm
    AND hr.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 3. FIND DIRECT OCEAN FREIGHT RATE (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION find_direct_ocean_freight(
  p_pol_id BIGINT,
  p_pod_id BIGINT,
  p_container_type TEXT
)
RETURNS TABLE (
  rate_id BIGINT,
  buy_amount NUMERIC,
  sell_amount NUMERIC,
  transit_days INTEGER,
  vendor_id BIGINT,
  vendor_name TEXT,
  pol_code TEXT,
  pod_code TEXT,
  valid_from DATE,
  valid_to DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ofr.id,
    ofr.buy_amount,
    ofr.sell_amount,
    ofr.tt_days,
    v.id,
    v.name,
    pol.unlocode,
    pod.unlocode,
    ofr.valid_from,
    ofr.valid_to
  FROM ocean_freight_rate ofr
  JOIN vendors v ON ofr.vendor_id = v.id
  JOIN locations pol ON ofr.pol_id = pol.id
  JOIN locations pod ON ofr.pod_id = pod.id
  WHERE ofr.pol_id = p_pol_id
    AND ofr.pod_id = p_pod_id
    AND ofr.container_type = p_container_type
    AND ofr.is_preferred = true
    AND CURRENT_DATE BETWEEN ofr.valid_from AND ofr.valid_to
    AND ofr.is_active = true
  ORDER BY ofr.buy_amount ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 4. FIND GATEWAY PORT FOR INLAND LOCATION (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION get_gateway_for_inland(p_inland_code TEXT)
RETURNS TABLE (
  inland_id BIGINT,
  inland_code TEXT,
  inland_name TEXT,
  gateway_id BIGINT,
  gateway_code TEXT,
  gateway_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.unlocode,
    l.location_name,
    gateway.id,
    gateway.unlocode,
    gateway.location_name
  FROM locations l
  JOIN locations gateway ON l.parent_location_id = gateway.id
  WHERE l.unlocode = p_inland_code
    AND l.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. FIND HAULAGE ROUTE (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION find_haulage_route(
  p_from_location_id BIGINT,
  p_to_location_id BIGINT
)
RETURNS TABLE (
  route_id BIGINT,
  route_code TEXT,
  route_name TEXT,
  total_distance_km NUMERIC,
  avg_transit_days INTEGER,
  primary_mode TEXT,
  from_code TEXT,
  from_name TEXT,
  to_code TEXT,
  to_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hr.id,
    hr.route_code,
    hr.route_name,
    hr.total_distance_km,
    hr.avg_transit_days,
    hr.primary_mode,
    from_loc.unlocode,
    from_loc.location_name,
    to_loc.unlocode,
    to_loc.location_name
  FROM haulage_route hr
  JOIN locations from_loc ON hr.from_location_id = from_loc.id
  JOIN locations to_loc ON hr.to_location_id = to_loc.id
  WHERE hr.from_location_id = p_from_location_id
    AND hr.to_location_id = p_to_location_id
    AND hr.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 6. GET HAULAGE RATE WITH WEIGHT SLAB MATCHING (CRITICAL!)
-- ==========================================

CREATE OR REPLACE FUNCTION get_weight_based_haulage_rate(
  p_route_id BIGINT,
  p_container_type TEXT,
  p_cargo_weight_mt NUMERIC,
  p_vendor_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  rate_id BIGINT,
  route_id BIGINT,
  vendor_id BIGINT,
  vendor_name TEXT,
  container_type TEXT,
  rate_per_container NUMERIC,
  flat_rate NUMERIC,
  min_weight_kg NUMERIC,
  max_weight_kg NUMERIC,
  currency TEXT,
  valid_from DATE,
  valid_to DATE,
  route_name TEXT,
  weight_slab_applied JSONB
) AS $$
DECLARE
  v_cargo_weight_kg NUMERIC;
BEGIN
  v_cargo_weight_kg := p_cargo_weight_mt * 1000;
  
  RETURN QUERY
  SELECT 
    hrate.id,
    hrate.route_id,
    hrate.vendor_id,
    v.name,
    hrate.container_type,
    hrate.rate_per_container,
    hrate.flat_rate,
    hrate.min_weight_kg,
    hrate.max_weight_kg,
    hrate.currency,
    hrate.valid_from,
    hrate.valid_to,
    hr.route_name,
    jsonb_build_object(
      'container_type', p_container_type,
      'cargo_weight_mt', p_cargo_weight_mt,
      'cargo_weight_kg', v_cargo_weight_kg,
      'min_weight_kg', hrate.min_weight_kg,
      'max_weight_kg', hrate.max_weight_kg,
      'rate_applied', COALESCE(hrate.rate_per_container, hrate.flat_rate),
      'slab_description', 
        CASE 
          WHEN hrate.min_weight_kg = 0 AND hrate.max_weight_kg <= 10000 THEN 'Light cargo (0-10MT)'
          WHEN hrate.min_weight_kg <= 10000 AND hrate.max_weight_kg <= 20000 THEN 'Standard cargo (10-20MT)'
          WHEN hrate.min_weight_kg <= 20000 AND hrate.max_weight_kg <= 26000 THEN 'Heavy cargo (20-26MT)'
          WHEN hrate.min_weight_kg <= 26000 AND hrate.max_weight_kg <= 30000 THEN 'Overweight cargo (26-30MT)'
          WHEN hrate.min_weight_kg <= 32000 AND hrate.max_weight_kg <= 50000 THEN '40HC heavy cargo (32-50MT)'
          ELSE 'Custom weight slab'
        END
    )
  FROM haulage_rate hrate
  JOIN haulage_route hr ON hrate.route_id = hr.id
  JOIN vendors v ON hrate.vendor_id = v.id
  WHERE hrate.route_id = p_route_id
    AND hrate.container_type = p_container_type
    AND (p_vendor_id IS NULL OR hrate.vendor_id = p_vendor_id)
    AND hrate.min_weight_kg <= v_cargo_weight_kg
    AND hrate.max_weight_kg >= v_cargo_weight_kg
    AND CURRENT_DATE BETWEEN hrate.valid_from AND hrate.valid_to
    AND hrate.is_active = true
  ORDER BY hrate.rate_per_container ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 7. GET SURCHARGES (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION get_surcharges(
  p_vendor_id BIGINT,
  p_pol_id BIGINT,
  p_pod_id BIGINT,
  p_container_type TEXT
)
RETURNS TABLE (
  surcharge_id BIGINT,
  charge_code TEXT,
  charge_name TEXT,
  amount NUMERIC,
  currency TEXT,
  uom TEXT,
  container_type TEXT,
  charge_bucket TEXT,
  applies_scope TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.charge_code,
    cc.charge_name,
    s.amount,
    s.currency,
    s.uom,
    s.container_type,
    cc.bucket,
    s.applies_scope
  FROM surcharge s
  JOIN charge_codes cc ON s.charge_code = cc.code
  WHERE s.vendor_id = p_vendor_id
    AND (
      (s.applies_scope = 'POL' AND s.pol_id = p_pol_id)
      OR
      (s.applies_scope = 'POD' AND s.pod_id = p_pod_id)
    )
    AND (s.container_type = p_container_type OR s.container_type IS NULL)
    AND CURRENT_DATE BETWEEN s.valid_from AND s.valid_to
    AND s.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 8. GET MARGIN CALCULATION (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_margin(
  p_pol_code TEXT,
  p_pod_code TEXT,
  p_total_buy NUMERIC
)
RETURNS TABLE (
  margin_type TEXT,
  margin_value NUMERIC,
  margin_amount NUMERIC,
  priority INTEGER
) AS $$
DECLARE
  v_pol_id BIGINT;
  v_pod_id BIGINT;
BEGIN
  -- Get location IDs for the ports
  SELECT id INTO v_pol_id FROM locations WHERE unlocode = p_pol_code;
  SELECT id INTO v_pod_id FROM locations WHERE unlocode = p_pod_code;
  
  RETURN QUERY
  SELECT 
    mr.mark_kind,
    mr.mark_value::NUMERIC,
    CASE 
      WHEN mr.mark_kind = 'pct' THEN p_total_buy * (mr.mark_value::NUMERIC / 100)
      WHEN mr.mark_kind = 'flat' THEN mr.mark_value::NUMERIC
      ELSE 0
    END as margin_amount,
    mr.priority
  FROM margin_rule_v2 mr
  WHERE mr.valid_from <= CURRENT_DATE 
    AND mr.valid_to >= CURRENT_DATE
    AND (
      -- Global margin (always applies)
      mr.level = 'global'
      OR
      -- Port-specific margin
      (mr.pol_id = v_pol_id AND mr.pod_id = v_pod_id)
      OR
      -- Trade zone margin (if tz_o and tz_d are set)
      (mr.tz_o IS NOT NULL AND mr.tz_d IS NOT NULL)
      OR
      -- Mode-specific margin
      (mr.mode IS NOT NULL)
    )
  ORDER BY mr.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 9. COMPLETE INLAND PRICING FUNCTION (PRODUCTION)
-- ==========================================

CREATE OR REPLACE FUNCTION get_production_inland_quote(
  p_pol_code TEXT,
  p_pod_code TEXT,
  p_container_type TEXT,
  p_container_count INTEGER DEFAULT 1,
  p_cargo_weight_mt NUMERIC DEFAULT 20,
  p_incoterm TEXT DEFAULT 'CIF',
  p_haulage_type TEXT DEFAULT 'carrier'
)
RETURNS TABLE (
  success BOOLEAN,
  pricing_scenario TEXT,
  pol_info JSONB,
  pod_info JSONB,
  gateway_info JSONB,
  ocean_freight JSONB,
  origin_charges JSONB,
  destination_charges JSONB,
  ihe_charges JSONB,
  ihi_charges JSONB,
  haulage_responsibility JSONB,
  weight_slab_info JSONB,
  margin_info JSONB,
  totals JSONB,
  error_message TEXT
) AS $$
DECLARE
  v_pol_id BIGINT;
  v_pod_id BIGINT;
  v_pol_is_inland BOOLEAN;
  v_pod_is_inland BOOLEAN;
  v_pol_gateway_id BIGINT;
  v_pod_gateway_id BIGINT;
  v_pol_gateway_code TEXT;
  v_pod_gateway_code TEXT;
  v_scenario_type TEXT;
  v_rate_source TEXT;
  v_direct_rate_id BIGINT;
  v_direct_buy_amount NUMERIC;
  v_direct_sell_amount NUMERIC;
  v_direct_transit_days INTEGER;
  v_direct_vendor_id BIGINT;
  v_direct_vendor_name TEXT;
  v_gateway_rate_id BIGINT;
  v_gateway_buy_amount NUMERIC;
  v_gateway_sell_amount NUMERIC;
  v_gateway_transit_days INTEGER;
  v_gateway_vendor_id BIGINT;
  v_gateway_vendor_name TEXT;
  v_final_rate_id BIGINT;
  v_final_buy_amount NUMERIC;
  v_final_sell_amount NUMERIC;
  v_final_transit_days INTEGER;
  v_final_vendor_id BIGINT;
  v_final_vendor_name TEXT;
  v_ihe_route_id BIGINT;
  v_ihe_rate_amount NUMERIC;
  v_ihi_route_id BIGINT;
  v_ihi_rate_amount NUMERIC;
  v_origin_charges_total NUMERIC := 0;
  v_dest_charges_total NUMERIC := 0;
  v_margin_amount NUMERIC := 0;
  v_total_buy NUMERIC;
  v_total_sell NUMERIC;
  v_haulage_resp JSONB;
  v_weight_slab_info JSONB;
  v_error_msg TEXT;
BEGIN
  BEGIN
    -- Step 1: Get port information
    SELECT id, (is_container_inland = true OR location_type IN ('ICD', 'CFS')), parent_location_id
    INTO v_pol_id, v_pol_is_inland, v_pol_gateway_id
    FROM locations WHERE unlocode = p_pol_code AND is_active = true;
    
    SELECT id, (is_container_inland = true OR location_type IN ('ICD', 'CFS')), parent_location_id
    INTO v_pod_id, v_pod_is_inland, v_pod_gateway_id
    FROM locations WHERE unlocode = p_pod_code AND is_active = true;
    
    IF v_pol_id IS NULL OR v_pod_id IS NULL THEN
      v_error_msg := 'One or both locations not found';
      RETURN QUERY SELECT false, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::JSONB, 
                          NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, 
                          NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, v_error_msg;
      RETURN;
    END IF;
    
    -- Get gateway codes
    IF v_pol_gateway_id IS NOT NULL THEN
      SELECT unlocode INTO v_pol_gateway_code FROM locations WHERE id = v_pol_gateway_id;
    END IF;
    
    IF v_pod_gateway_id IS NOT NULL THEN
      SELECT unlocode INTO v_pod_gateway_code FROM locations WHERE id = v_pod_gateway_id;
    END IF;
    
    -- Step 2: Determine scenario
    IF NOT v_pol_is_inland AND NOT v_pod_is_inland THEN
      v_scenario_type := 'DIRECT';
    ELSIF v_pol_is_inland AND NOT v_pod_is_inland THEN
      v_scenario_type := 'POL_INLAND';
    ELSIF NOT v_pol_is_inland AND v_pod_is_inland THEN
      v_scenario_type := 'POD_INLAND';
    ELSIF v_pol_is_inland AND v_pod_is_inland THEN
      v_scenario_type := 'BOTH_INLAND';
    END IF;
    
    -- Step 3: Try direct rate first
    SELECT rate_id, buy_amount, sell_amount, transit_days, vendor_id, vendor_name
    INTO v_direct_rate_id, v_direct_buy_amount, v_direct_sell_amount, v_direct_transit_days, v_direct_vendor_id, v_direct_vendor_name
    FROM find_direct_ocean_freight(v_pol_id, v_pod_id, p_container_type);
    
    -- Step 4: Try gateway rate if no direct rate
    IF v_direct_rate_id IS NULL THEN
      -- Try POL gateway to POD
      IF v_pol_is_inland AND v_pol_gateway_id IS NOT NULL THEN
        SELECT rate_id, buy_amount, sell_amount, transit_days, vendor_id, vendor_name
        INTO v_gateway_rate_id, v_gateway_buy_amount, v_gateway_sell_amount, v_gateway_transit_days, v_gateway_vendor_id, v_gateway_vendor_name
        FROM find_direct_ocean_freight(v_pol_gateway_id, v_pod_id, p_container_type);
      END IF;
      
      -- Try POL to POD gateway
      IF v_gateway_rate_id IS NULL AND v_pod_is_inland AND v_pod_gateway_id IS NOT NULL THEN
        SELECT rate_id, buy_amount, sell_amount, transit_days, vendor_id, vendor_name
        INTO v_gateway_rate_id, v_gateway_buy_amount, v_gateway_sell_amount, v_gateway_transit_days, v_gateway_vendor_id, v_gateway_vendor_name
        FROM find_direct_ocean_freight(v_pol_id, v_pod_gateway_id, p_container_type);
      END IF;
      
      -- Try gateway to gateway
      IF v_gateway_rate_id IS NULL AND v_pol_is_inland AND v_pod_is_inland AND 
         v_pol_gateway_id IS NOT NULL AND v_pod_gateway_id IS NOT NULL THEN
        SELECT rate_id, buy_amount, sell_amount, transit_days, vendor_id, vendor_name
        INTO v_gateway_rate_id, v_gateway_buy_amount, v_gateway_sell_amount, v_gateway_transit_days, v_gateway_vendor_id, v_gateway_vendor_name
        FROM find_direct_ocean_freight(v_pol_gateway_id, v_pod_gateway_id, p_container_type);
      END IF;
    END IF;
    
    -- Step 5: Select final rate
    IF v_direct_rate_id IS NOT NULL THEN
      v_final_rate_id := v_direct_rate_id;
      v_final_buy_amount := v_direct_buy_amount;
      v_final_sell_amount := v_direct_sell_amount;
      v_final_transit_days := v_direct_transit_days;
      v_final_vendor_id := v_direct_vendor_id;
      v_final_vendor_name := v_direct_vendor_name;
      v_rate_source := 'DIRECT';
    ELSIF v_gateway_rate_id IS NOT NULL THEN
      v_final_rate_id := v_gateway_rate_id;
      v_final_buy_amount := v_gateway_buy_amount;
      v_final_sell_amount := v_gateway_sell_amount;
      v_final_transit_days := v_gateway_transit_days;
      v_final_vendor_id := v_gateway_vendor_id;
      v_final_vendor_name := v_gateway_vendor_name;
      v_rate_source := 'GATEWAY';
    ELSE
      v_error_msg := 'No ocean freight rate found for this route';
      RETURN QUERY SELECT false, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::JSONB, 
                          NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, 
                          NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, v_error_msg;
      RETURN;
    END IF;
    
    -- Step 6: Get haulage responsibility
    SELECT jsonb_build_object(
      'term_code', term_code,
      'term_name', term_name,
      'ihe_arranged_by', ihe_arranged_by,
      'ihe_paid_by', ihe_paid_by,
      'ihe_include_in_quote', ihe_include_in_quote,
      'ihi_arranged_by', ihi_arranged_by,
      'ihi_paid_by', ihi_paid_by,
      'ihi_include_in_quote', ihi_include_in_quote,
      'description', description
    ) INTO v_haulage_resp
    FROM get_haulage_responsibility(p_incoterm);
    
    -- Step 7: Get surcharges (local charges)
    SELECT COALESCE(SUM(amount), 0) INTO v_origin_charges_total
    FROM get_surcharges(v_final_vendor_id, v_pol_id, NULL, p_container_type)
    WHERE applies_scope = 'POL';
    
    SELECT COALESCE(SUM(amount), 0) INTO v_dest_charges_total
    FROM get_surcharges(v_final_vendor_id, NULL, v_pod_id, p_container_type)
    WHERE applies_scope = 'POD';
    
    -- Step 8: Calculate IHE/IHI charges based on haulage responsibility
    IF p_haulage_type = 'carrier' THEN
      -- IHE charges (POL inland → gateway)
      IF v_pol_is_inland AND v_pol_gateway_id IS NOT NULL THEN
        -- Find haulage route
        SELECT route_id INTO v_ihe_route_id
        FROM find_haulage_route(v_pol_id, v_pol_gateway_id);
        
        IF v_ihe_route_id IS NOT NULL THEN
          -- Get weight-based rate
          SELECT rate_per_container, weight_slab_applied
          INTO v_ihe_rate_amount, v_weight_slab_info
          FROM get_weight_based_haulage_rate(v_ihe_route_id, p_container_type, p_cargo_weight_mt, v_final_vendor_id);
        END IF;
      END IF;
      
      -- IHI charges (gateway → POD inland)
      IF v_pod_is_inland AND v_pod_gateway_id IS NOT NULL THEN
        -- Find haulage route
        SELECT route_id INTO v_ihi_route_id
        FROM find_haulage_route(v_pod_gateway_id, v_pod_id);
        
        IF v_ihi_route_id IS NOT NULL THEN
          -- Get weight-based rate
          SELECT rate_per_container
          INTO v_ihi_rate_amount
          FROM get_weight_based_haulage_rate(v_ihi_route_id, p_container_type, p_cargo_weight_mt, v_final_vendor_id);
        END IF;
      END IF;
    END IF;
    
    -- Step 9: Calculate margin
    SELECT margin_amount INTO v_margin_amount
    FROM calculate_margin(p_pol_code, p_pod_code, v_final_buy_amount);
    
    -- Step 10: Calculate totals
    v_total_buy := (v_final_buy_amount + COALESCE(v_ihe_rate_amount, 0) + COALESCE(v_ihi_rate_amount, 0) + v_origin_charges_total + v_dest_charges_total) * p_container_count;
    v_total_sell := v_total_buy + v_margin_amount;
    
    -- Step 11: Build response
    RETURN QUERY SELECT 
      true,
      CASE WHEN v_rate_source = 'DIRECT' THEN 'direct_rate' ELSE 'via_gateway' END,
      jsonb_build_object(
        'id', v_pol_id,
        'unlocode', p_pol_code,
        'is_container_inland', v_pol_is_inland,
        'gateway_id', v_pol_gateway_id,
        'gateway_code', v_pol_gateway_code
      ),
      jsonb_build_object(
        'id', v_pod_id,
        'unlocode', p_pod_code,
        'is_container_inland', v_pod_is_inland,
        'gateway_id', v_pod_gateway_id,
        'gateway_code', v_pod_gateway_code
      ),
      CASE 
        WHEN v_rate_source = 'GATEWAY' THEN jsonb_build_object(
          'pol_gateway_id', v_pol_gateway_id,
          'pol_gateway_code', v_pol_gateway_code,
          'pod_gateway_id', v_pod_gateway_id,
          'pod_gateway_code', v_pod_gateway_code
        )
        ELSE NULL
      END,
      jsonb_build_object(
        'rate_id', v_final_rate_id,
        'vendor_id', v_final_vendor_id,
        'vendor_name', v_final_vendor_name,
        'buy_amount', v_final_buy_amount,
        'sell_amount', v_final_sell_amount,
        'transit_days', v_final_transit_days,
        'total_buy', v_final_buy_amount * p_container_count,
        'total_sell', v_final_sell_amount * p_container_count
      ),
      jsonb_build_object(
        'charges', to_jsonb(get_surcharges(v_final_vendor_id, v_pol_id, NULL, p_container_type)),
        'total', v_origin_charges_total * p_container_count,
        'count', (SELECT COUNT(*) FROM get_surcharges(v_final_vendor_id, v_pol_id, NULL, p_container_type) WHERE applies_scope = 'POL')
      ),
      jsonb_build_object(
        'charges', to_jsonb(get_surcharges(v_final_vendor_id, NULL, v_pod_id, p_container_type)),
        'total', v_dest_charges_total * p_container_count,
        'count', (SELECT COUNT(*) FROM get_surcharges(v_final_vendor_id, NULL, v_pod_id, p_container_type) WHERE applies_scope = 'POD')
      ),
      CASE 
        WHEN v_ihe_rate_amount > 0 THEN jsonb_build_object(
          'route_id', v_ihe_route_id,
          'rate_per_container', v_ihe_rate_amount,
          'total_amount', v_ihe_rate_amount * p_container_count,
          'included_in_quote', true,
          'arranged_by', 'carrier',
          'paid_by', 'carrier'
        )
        ELSE NULL
      END,
      CASE 
        WHEN v_ihi_rate_amount > 0 THEN jsonb_build_object(
          'route_id', v_ihi_route_id,
          'rate_per_container', v_ihi_rate_amount,
          'total_amount', v_ihi_rate_amount * p_container_count,
          'included_in_quote', true,
          'arranged_by', 'carrier',
          'paid_by', 'carrier'
        )
        ELSE NULL
      END,
      v_haulage_resp,
      v_weight_slab_info,
      jsonb_build_object(
        'margin_type', 'percentage',
        'margin_value', 10,
        'margin_amount', v_margin_amount
      ),
      jsonb_build_object(
        'ocean_freight_total', v_final_buy_amount * p_container_count,
        'haulage_total', (COALESCE(v_ihe_rate_amount, 0) + COALESCE(v_ihi_rate_amount, 0)) * p_container_count,
        'local_charges_total', (v_origin_charges_total + v_dest_charges_total) * p_container_count,
        'margin_total', v_margin_amount,
        'grand_total_usd', v_total_sell,
        'currency', 'USD'
      ),
      NULL::TEXT;
      
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      false, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::JSONB, 
      NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, 
      NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, NULL::JSONB, SQLERRM::TEXT;
  END;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 10. PERFORMANCE INDEXES (PRODUCTION)
-- ==========================================

-- Locations indexes
CREATE INDEX IF NOT EXISTS idx_locations_unlocode_active ON locations(unlocode) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_locations_inland ON locations(is_container_inland) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_location_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type) WHERE is_active = true;

-- Ocean freight rate indexes
CREATE INDEX IF NOT EXISTS idx_ocean_freight_route ON ocean_freight_rate(pol_id, pod_id, container_type);
CREATE INDEX IF NOT EXISTS idx_ocean_freight_preferred ON ocean_freight_rate(is_preferred) WHERE is_preferred = true;
CREATE INDEX IF NOT EXISTS idx_ocean_freight_valid ON ocean_freight_rate(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_ocean_freight_active ON ocean_freight_rate(is_active) WHERE is_active = true;

-- Haulage route indexes
CREATE INDEX IF NOT EXISTS idx_haulage_route_active ON haulage_route(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_haulage_route_legs ON haulage_route(from_location_id, to_location_id);

-- Haulage rate indexes
CREATE INDEX IF NOT EXISTS idx_haulage_rate_route ON haulage_rate(route_id, container_type);
CREATE INDEX IF NOT EXISTS idx_haulage_rate_weight ON haulage_rate(min_weight_kg, max_weight_kg);
CREATE INDEX IF NOT EXISTS idx_haulage_rate_valid ON haulage_rate(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_haulage_rate_active ON haulage_rate(is_active) WHERE is_active = true;

-- Surcharge indexes
CREATE INDEX IF NOT EXISTS idx_surcharge_vendor ON surcharge(vendor_id, applies_scope);
CREATE INDEX IF NOT EXISTS idx_surcharge_pol ON surcharge(pol_id) WHERE applies_scope = 'POL';
CREATE INDEX IF NOT EXISTS idx_surcharge_pod ON surcharge(pod_id) WHERE applies_scope = 'POD';
CREATE INDEX IF NOT EXISTS idx_surcharge_valid ON surcharge(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_surcharge_active ON surcharge(is_active) WHERE is_active = true;

-- Margin rules indexes
CREATE INDEX IF NOT EXISTS idx_margin_rule_v2_level ON margin_rule_v2(level);
CREATE INDEX IF NOT EXISTS idx_margin_rule_v2_pol_pod ON margin_rule_v2(pol_id, pod_id);
CREATE INDEX IF NOT EXISTS idx_margin_rule_v2_priority ON margin_rule_v2(priority DESC);
CREATE INDEX IF NOT EXISTS idx_margin_rule_v2_valid ON margin_rule_v2(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_margin_rule_v2_tenant ON margin_rule_v2(tenant_id);

-- Haulage responsibility indexes
CREATE INDEX IF NOT EXISTS idx_haulage_resp_term ON haulage_responsibility(term_code, is_active);
CREATE INDEX IF NOT EXISTS idx_haulage_resp_active ON haulage_responsibility(is_active) WHERE is_active = true;

-- ==========================================
-- 11. SAMPLE DATA SETUP (PRODUCTION)
-- ==========================================

-- Note: Sample data insertion is optional and may be skipped if constraints conflict
-- You can manually insert haulage responsibility rules based on your business requirements

-- Example haulage responsibility rules (uncomment and modify as needed):
/*
INSERT INTO haulage_responsibility (
  term_code, term_name, 
  ihe_arranged_by, ihe_paid_by, ihe_include_in_quote,
  ihi_arranged_by, ihi_paid_by, ihi_include_in_quote,
  description, is_active
) VALUES 
  ('FOB', 'Free On Board', 
   'shipper', 'shipper', false,
   'consignee', 'consignee', false,
   'Shipper arranges export haulage, consignee arranges import haulage', true),
  
  ('CIF', 'Cost, Insurance and Freight',
   'shipper', 'shipper', true,
   'shipper', 'shipper', true,
   'Shipper arranges and pays for all haulage', true),
   
  ('EXW', 'Ex Works',
   'buyer', 'buyer', false,
   'buyer', 'buyer', false,
   'Buyer arranges all haulage', true),
   
  ('FCA', 'Free Carrier',
   'shipper', 'shipper', false,
   'consignee', 'consignee', false,
   'Shipper arranges export haulage, consignee arranges import haulage', true),
   
  ('CPT', 'Carriage Paid To',
   'shipper', 'shipper', true,
   'shipper', 'shipper', true,
   'Shipper arranges and pays for all haulage', true),
   
  ('DAP', 'Delivered At Place',
   'shipper', 'shipper', true,
   'shipper', 'shipper', true,
   'Shipper arranges and pays for all haulage', true),
   
  ('DDP', 'Delivered Duty Paid',
   'shipper', 'shipper', true,
   'shipper', 'shipper', true,
   'Shipper arranges and pays for all haulage', true);
*/

-- ==========================================
-- 12. TESTING FUNCTIONS (PRODUCTION)
-- ==========================================

-- Function to test the complete production inland pricing
CREATE OR REPLACE FUNCTION test_production_inland_pricing(
  p_pol_code TEXT,
  p_pod_code TEXT,
  p_container_type TEXT,
  p_cargo_weight_mt NUMERIC DEFAULT 20
)
RETURNS TABLE (
  test_name TEXT,
  result JSONB
) AS $$
BEGIN
  -- Test 1: Port type check
  RETURN QUERY SELECT 
    'Port Type Check'::TEXT,
    to_jsonb(check_port_type(p_pol_code));
  
  -- Test 2: Haulage responsibility
  RETURN QUERY SELECT 
    'Haulage Responsibility (CIF)'::TEXT,
    to_jsonb(get_haulage_responsibility('CIF'));
  
  -- Test 3: Direct ocean freight
  RETURN QUERY SELECT 
    'Direct Ocean Freight'::TEXT,
    to_jsonb(find_direct_ocean_freight(
      (SELECT id FROM locations WHERE unlocode = p_pol_code),
      (SELECT id FROM locations WHERE unlocode = p_pod_code),
      p_container_type
    ));
  
  -- Test 4: Complete production inland pricing
  RETURN QUERY SELECT 
    'Production Inland Pricing'::TEXT,
    to_jsonb(get_production_inland_quote(
      p_pol_code, p_pod_code, p_container_type, 1, p_cargo_weight_mt, 'CIF', 'carrier'
    ));
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 13. DEBUGGING FUNCTIONS (PRODUCTION)
-- ==========================================

-- Function to debug haulage rate issues
CREATE OR REPLACE FUNCTION debug_haulage_rates(
  p_from_location_id BIGINT,
  p_to_location_id BIGINT,
  p_container_type TEXT,
  p_cargo_weight_mt NUMERIC
)
RETURNS TABLE (
  debug_step TEXT,
  result TEXT,
  details JSONB
) AS $$
DECLARE
  v_cargo_weight_kg NUMERIC;
BEGIN
  v_cargo_weight_kg := p_cargo_weight_mt * 1000;
  
  -- Check if route exists
  RETURN QUERY SELECT 
    'Route exists?'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END,
    jsonb_build_object('route_count', COUNT(*))
  FROM haulage_route
  WHERE from_location_id = p_from_location_id
    AND to_location_id = p_to_location_id
    AND is_active = true;
  
  -- Check if rates exist for vendor
  RETURN QUERY SELECT 
    'Rates exist for vendor?'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END,
    jsonb_build_object('rate_count', COUNT(*))
  FROM haulage_rate hrate
  JOIN haulage_route hr ON hrate.route_id = hr.id
  WHERE hr.from_location_id = p_from_location_id
    AND hr.to_location_id = p_to_location_id
    AND hrate.container_type = p_container_type;
  
  -- Check weight slab matching
  RETURN QUERY SELECT 
    'Weight slab matches?'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END,
    jsonb_build_object('matching_rates', COUNT(*))
  FROM haulage_rate hrate
  JOIN haulage_route hr ON hrate.route_id = hr.id
  WHERE hr.from_location_id = p_from_location_id
    AND hr.to_location_id = p_to_location_id
    AND hrate.container_type = p_container_type
    AND hrate.min_weight_kg <= v_cargo_weight_kg
    AND hrate.max_weight_kg >= v_cargo_weight_kg;
    
  -- Show all matching criteria
  RETURN QUERY SELECT 
    'All matching criteria'::TEXT,
    'DETAILS'::TEXT,
    jsonb_agg(jsonb_build_object(
      'route_name', hr.route_name,
      'container_type', hrate.container_type,
      'vendor', v.name,
      'min_weight_kg', hrate.min_weight_kg,
      'max_weight_kg', hrate.max_weight_kg,
      'rate_per_container', hrate.rate_per_container,
      'weight_match', CASE 
        WHEN v_cargo_weight_kg BETWEEN hrate.min_weight_kg AND hrate.max_weight_kg 
        THEN 'MATCHES' 
        ELSE 'NO MATCH' 
      END
    ))
  FROM haulage_rate hrate
  JOIN haulage_route hr ON hrate.route_id = hr.id
  JOIN vendors v ON hrate.vendor_id = v.id
  WHERE hr.from_location_id = p_from_location_id
    AND hr.to_location_id = p_to_location_id
    AND hrate.container_type = p_container_type;
END;
$$ LANGUAGE plpgsql;
