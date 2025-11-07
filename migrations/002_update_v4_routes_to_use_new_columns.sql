-- ============================================
-- MIGRATION: Update V4 Routes to Use New Columns
-- Purpose: After origin_code/destination_code columns are added,
--          update V4 routes to use them directly instead of mapping
-- Date: 2025-01-17
-- ============================================

-- This is a code change, not a database migration
-- Update src/routes/v4-routes.ts to use origin_code/destination_code

-- BEFORE (current - uses mapping):
-- .eq('pol_code', origin.toUpperCase())

-- AFTER (after migration - uses new columns):
-- .eq('origin_code', origin.toUpperCase())

-- ============================================
-- Code Changes Required:
-- ============================================

-- File: src/routes/v4-routes.ts
-- 
-- Search and replace:
-- 1. Line ~64: .eq('pol_code', origin.toUpperCase()) 
--    → .eq('origin_code', origin.toUpperCase())
-- 
-- 2. Line ~65: .eq('pod_code', destination.toUpperCase())
--    → .eq('destination_code', destination.toUpperCase())
--
-- 3. Line ~254: Same changes for prepare-quote endpoint
--
-- 4. Update comments to reflect direct column usage

-- ============================================
-- Benefits After Migration:
-- ============================================

-- ✅ Direct column access (no mapping needed)
-- ✅ Better performance (direct index usage)
-- ✅ Clearer code (no translation layer)
-- ✅ Future-ready for routing perspective (pol/pod can differ from origin/destination)

