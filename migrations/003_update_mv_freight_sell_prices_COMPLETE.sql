-- ============================================
-- MIGRATION: Update mv_freight_sell_prices Materialized View
-- Purpose: Add origin_code, destination_code, origin_name, destination_name columns
-- Date: 2025-01-17
-- ============================================

-- Step 1: Drop existing view
DROP MATERIALIZED VIEW IF EXISTS mv_freight_sell_prices CASCADE;

-- Step 2: Recreate with new columns added
CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
WITH freight_with_surcharges AS (
  SELECT 
    ofr.tenant_id,
    ofr.id AS rate_id,
    ofr.contract_id,
    ofr.pol_id,
    ofr.pod_id,
    ofr.container_type,
    ofr.buy_amount AS ocean_freight_buy,
    ofr.currency,
    ofr.tt_days,
    ofr.is_preferred,
    ofr.valid_from,
    ofr.valid_to,
    ofr.origin_code,                    -- NEW: Added for V4
    ofr.destination_code,               -- NEW: Added for V4
    rc.vendor_id,
    v.name AS vendor_name,
    pol.location_name AS pol_name,
    pol.unlocode AS pol_code,
    pol.country AS pol_country,
    pol.location_name AS origin_name,   -- NEW: Added for V4 (same as pol_name initially)
    pod.location_name AS pod_name,
    pod.unlocode AS pod_code,
    pod.country AS pod_country,
    pod.location_name AS destination_name, -- NEW: Added for V4 (same as pod_name initially)
    pol.trade_zone AS pol_trade_zone,
    pod.trade_zone AS pod_trade_zone,
    COALESCE(sum(
      CASE
        WHEN s.calc_method = ANY (ARRAY['flat'::text, 'per_container'::text]) THEN s.amount
        WHEN s.calc_method = 'percentage'::text THEN ofr.buy_amount * (s.amount / 100::numeric)
        ELSE 0::numeric
      END), 0::numeric) AS freight_surcharges_total
  FROM ocean_freight_rate ofr
  LEFT JOIN rate_contract rc ON ofr.contract_id = rc.id
  LEFT JOIN vendor v ON rc.vendor_id = v.id
  LEFT JOIN locations pol ON ofr.pol_id = pol.id
  LEFT JOIN locations pod ON ofr.pod_id = pod.id
  LEFT JOIN surcharge s ON s.contract_id = ofr.contract_id 
    AND s.applies_scope = 'freight'::text 
    AND s.is_active = true 
    AND (s.pol_id IS NULL OR s.pol_id = ofr.pol_id) 
    AND (s.pod_id IS NULL OR s.pod_id = ofr.pod_id) 
    AND (s.container_type IS NULL OR s.container_type = ofr.container_type) 
    AND s.tenant_id = ofr.tenant_id
  GROUP BY 
    ofr.tenant_id, ofr.id, ofr.contract_id, ofr.pol_id, ofr.pod_id, 
    ofr.container_type, ofr.buy_amount, ofr.currency, ofr.tt_days, 
    ofr.is_preferred, ofr.valid_from, ofr.valid_to, 
    ofr.origin_code, ofr.destination_code,  -- NEW: Added to GROUP BY
    rc.vendor_id, v.name, 
    pol.location_name, pol.unlocode, pol.country, pol.trade_zone, 
    pod.location_name, pod.unlocode, pod.country, pod.trade_zone
),
rates_with_margins AS (
  SELECT 
    fws.tenant_id,
    fws.rate_id,
    fws.contract_id,
    fws.pol_id,
    fws.pod_id,
    fws.container_type,
    fws.ocean_freight_buy,
    fws.currency,
    fws.tt_days,
    fws.is_preferred,
    fws.valid_from,
    fws.valid_to,
    fws.vendor_id,
    fws.vendor_name,
    fws.pol_name,
    fws.pol_code,
    fws.pol_country,
    fws.pod_name,
    fws.pod_code,
    fws.pod_country,
    fws.pol_trade_zone,
    fws.pod_trade_zone,
    fws.freight_surcharges_total,
    fws.origin_code,                    -- NEW: Pass through from CTE
    fws.destination_code,              -- NEW: Pass through from CTE
    fws.origin_name,                   -- NEW: Pass through from CTE
    fws.destination_name,               -- NEW: Pass through from CTE
    fws.ocean_freight_buy + fws.freight_surcharges_total AS all_in_freight_buy,
    COALESCE((
      SELECT margin_rule_v2.mark_value
      FROM margin_rule_v2
      WHERE margin_rule_v2.level = 'port_pair'::rule_level 
        AND margin_rule_v2.pol_id = fws.pol_id 
        AND margin_rule_v2.pod_id = fws.pod_id 
        AND margin_rule_v2.tenant_id = fws.tenant_id 
        AND (margin_rule_v2.container_type IS NULL OR margin_rule_v2.container_type = fws.container_type) 
        AND CURRENT_DATE >= margin_rule_v2.valid_from 
        AND CURRENT_DATE <= margin_rule_v2.valid_to
      ORDER BY margin_rule_v2.priority
      LIMIT 1
    ), (
      SELECT margin_rule_v2.mark_value
      FROM margin_rule_v2
      WHERE margin_rule_v2.level = 'trade_zone'::rule_level 
        AND margin_rule_v2.tz_o = fws.pol_trade_zone::text 
        AND margin_rule_v2.tz_d = fws.pod_trade_zone::text 
        AND margin_rule_v2.tenant_id = fws.tenant_id 
        AND (margin_rule_v2.container_type IS NULL OR margin_rule_v2.container_type = fws.container_type) 
        AND CURRENT_DATE >= margin_rule_v2.valid_from 
        AND CURRENT_DATE <= margin_rule_v2.valid_to
      ORDER BY margin_rule_v2.priority
      LIMIT 1
    ), (
      SELECT margin_rule_v2.mark_value
      FROM margin_rule_v2
      WHERE margin_rule_v2.level = 'global'::rule_level 
        AND margin_rule_v2.tenant_id = fws.tenant_id 
        AND CURRENT_DATE >= margin_rule_v2.valid_from 
        AND CURRENT_DATE <= margin_rule_v2.valid_to
      ORDER BY margin_rule_v2.priority
      LIMIT 1
    ), 15::numeric) AS margin_value,
    COALESCE((
      SELECT margin_rule_v2.mark_kind::text AS mark_kind
      FROM margin_rule_v2
      WHERE margin_rule_v2.level = 'port_pair'::rule_level 
        AND margin_rule_v2.pol_id = fws.pol_id 
        AND margin_rule_v2.pod_id = fws.pod_id 
        AND margin_rule_v2.tenant_id = fws.tenant_id 
        AND CURRENT_DATE >= margin_rule_v2.valid_from 
        AND CURRENT_DATE <= margin_rule_v2.valid_to
      ORDER BY margin_rule_v2.priority
      LIMIT 1
    ), (
      SELECT margin_rule_v2.mark_kind::text AS mark_kind
      FROM margin_rule_v2
      WHERE margin_rule_v2.level = 'trade_zone'::rule_level 
        AND margin_rule_v2.tz_o = fws.pol_trade_zone::text 
        AND margin_rule_v2.tz_d = fws.pod_trade_zone::text 
        AND margin_rule_v2.tenant_id = fws.tenant_id 
        AND CURRENT_DATE >= margin_rule_v2.valid_from 
        AND CURRENT_DATE <= margin_rule_v2.valid_to
      ORDER BY margin_rule_v2.priority
      LIMIT 1
    ), (
      SELECT margin_rule_v2.mark_kind::text AS mark_kind
      FROM margin_rule_v2
      WHERE margin_rule_v2.level = 'global'::rule_level 
        AND margin_rule_v2.tenant_id = fws.tenant_id 
        AND CURRENT_DATE >= margin_rule_v2.valid_from 
        AND CURRENT_DATE <= margin_rule_v2.valid_to
      ORDER BY margin_rule_v2.priority
      LIMIT 1
    ), 'percentage'::text) AS margin_type
  FROM freight_with_surcharges fws
  LEFT JOIN locations pol ON fws.pol_id = pol.id
  LEFT JOIN locations pod ON fws.pod_id = pod.id
)
SELECT 
  tenant_id,
  rate_id,
  contract_id,
  vendor_id,
  vendor_name AS carrier,
  pol_id,
  pol_name,
  pol_code,
  pol_country,
  pod_id,
  pod_name,
  pod_code,
  pod_country,
  origin_code,                    -- NEW: Added for V4
  destination_code,               -- NEW: Added for V4
  origin_name,                    -- NEW: Added for V4
  destination_name,               -- NEW: Added for V4
  container_type,
  tt_days AS transit_days,
  is_preferred,
  round(ocean_freight_buy, 2) AS ocean_freight_buy,
  round(freight_surcharges_total, 2) AS freight_surcharges,
  round(all_in_freight_buy, 2) AS all_in_freight_buy,
  margin_type,
  margin_value AS margin_percentage,
  round(
    CASE
      WHEN margin_type = 'percentage'::text THEN all_in_freight_buy * (margin_value / 100::numeric)
      WHEN margin_type = 'fixed'::text THEN margin_value
      ELSE all_in_freight_buy * (margin_value / 100::numeric)
    END, 2) AS margin_amount,
  round(
    CASE
      WHEN margin_type = 'percentage'::text THEN all_in_freight_buy * (1::numeric + margin_value / 100::numeric)
      WHEN margin_type = 'fixed'::text THEN all_in_freight_buy + margin_value
      ELSE all_in_freight_buy * (1::numeric + margin_value / 100::numeric)
    END, 2) AS all_in_freight_sell,
  currency,
  valid_from,
  valid_to
FROM rates_with_margins;

-- Step 3: Refresh the view
REFRESH MATERIALIZED VIEW mv_freight_sell_prices;

-- Step 4: Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_origin_code 
  ON mv_freight_sell_prices(origin_code);
  
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_destination_code 
  ON mv_freight_sell_prices(destination_code);
  
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_origin_dest 
  ON mv_freight_sell_prices(origin_code, destination_code);

-- ============================================
-- Verification
-- ============================================
-- Run this to verify the migration:
-- SELECT 
--   rate_id,
--   pol_code, pod_code, pol_name, pod_name,
--   origin_code, destination_code, origin_name, destination_name,
--   contract_id, pol_id, pod_id, vendor_id
-- FROM mv_freight_sell_prices
-- LIMIT 5;

