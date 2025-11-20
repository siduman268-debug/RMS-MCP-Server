-- ============================================================================
-- Verification: Check includes_inland_haulage migration success
-- Run this to verify the migration completed successfully
-- ============================================================================

-- 1. Check if the column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'ocean_freight_rate' 
  AND column_name = 'includes_inland_haulage';

-- 2. Check if the indexes were created
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'ocean_freight_rate' 
  AND indexname LIKE '%inland%';

-- 3. Get the column comment
SELECT 
    col_description('ocean_freight_rate'::regclass, 
                    (SELECT ordinal_position 
                     FROM information_schema.columns 
                     WHERE table_name = 'ocean_freight_rate' 
                       AND column_name = 'includes_inland_haulage')) as column_comment;

-- 4. Count total ocean freight rates
SELECT COUNT(*) as total_rates
FROM ocean_freight_rate;

-- 5. Count rates by pricing model (should all be NULL initially)
SELECT 
    includes_inland_haulage->>'pricing_model' as pricing_model,
    COUNT(*) as count
FROM ocean_freight_rate
GROUP BY includes_inland_haulage->>'pricing_model'
ORDER BY count DESC;

-- 6. Show sample rates to verify NULL values
SELECT 
    id,
    origin_code,
    destination_code,
    container_type,
    buy_amount,
    includes_inland_haulage
FROM ocean_freight_rate
LIMIT 10;

-- 7. Test JSONB insertion (dry run - commented out)
-- Uncomment to test inserting sample data
/*
UPDATE ocean_freight_rate 
SET includes_inland_haulage = jsonb_build_object(
  'ihe_included', true,
  'ihi_included', false,
  'pricing_model', 'all_inclusive',
  'ihe_from_location', 'f0828e63-a2f2-4742-b4b4-a9cc6851b42c',
  'notes', 'Test: Carrier includes ICD Sonipat to Mundra Port in ocean freight'
)
WHERE origin_code = 'INSON' 
  AND destination_code = 'INMUN'
  AND id = (SELECT id FROM ocean_freight_rate WHERE origin_code = 'INSON' AND destination_code = 'INMUN' LIMIT 1);

-- Query to see the test data
SELECT 
    id,
    origin_code,
    destination_code,
    includes_inland_haulage
FROM ocean_freight_rate
WHERE includes_inland_haulage IS NOT NULL;
*/

-- 8. Test JSON index performance
EXPLAIN ANALYZE
SELECT id, origin_code, destination_code, includes_inland_haulage
FROM ocean_freight_rate
WHERE includes_inland_haulage->>'pricing_model' = 'all_inclusive';

COMMIT;

