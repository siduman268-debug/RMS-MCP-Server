-- ============================================================================
-- Migration: Add missing inland haulage indexes
-- Purpose: Add the 2 missing indexes for ihe_included and ihi_included
-- Date: 2025-11-20
-- ============================================================================

-- Check if indexes already exist before creating
DO $$ 
BEGIN
    -- Create index for ihe_included if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_ocean_freight_ihe_included'
    ) THEN
        CREATE INDEX idx_ocean_freight_ihe_included 
        ON ocean_freight_rate ((includes_inland_haulage->>'ihe_included'));
        RAISE NOTICE 'Created index: idx_ocean_freight_ihe_included';
    ELSE
        RAISE NOTICE 'Index idx_ocean_freight_ihe_included already exists';
    END IF;

    -- Create index for ihi_included if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_ocean_freight_ihi_included'
    ) THEN
        CREATE INDEX idx_ocean_freight_ihi_included 
        ON ocean_freight_rate ((includes_inland_haulage->>'ihi_included'));
        RAISE NOTICE 'Created index: idx_ocean_freight_ihi_included';
    ELSE
        RAISE NOTICE 'Index idx_ocean_freight_ihi_included already exists';
    END IF;
END $$;

-- Verify all 3 indexes now exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'ocean_freight_rate' 
  AND indexname LIKE '%inland%'
ORDER BY indexname;

COMMIT;

