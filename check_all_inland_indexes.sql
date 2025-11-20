-- Check all inland haulage indexes
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'ocean_freight_rate' 
  AND indexname IN (
    'idx_ocean_freight_inland_pricing_model',
    'idx_ocean_freight_ihe_included',
    'idx_ocean_freight_ihi_included'
  )
ORDER BY indexname;

-- Also check the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ocean_freight_rate' 
  AND column_name = 'includes_inland_haulage';

-- Test that the column works with a simple query
SELECT COUNT(*) as total_rates,
       COUNT(includes_inland_haulage) as rates_with_haulage_data
FROM ocean_freight_rate;

