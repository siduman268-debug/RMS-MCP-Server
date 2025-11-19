-- ==================================================================
-- MIGRATION: Rename timestamp column to created_at in rms_audit_log
-- Purpose: Fix reserved keyword issue with 'timestamp'
-- Date: 2025-11-19
-- ==================================================================

-- Rename the column from timestamp to created_at
ALTER TABLE rms_audit_log 
RENAME COLUMN timestamp TO created_at;

-- Drop old index if it exists
DROP INDEX IF EXISTS idx_audit_timestamp;

-- Create new index with correct column name
CREATE INDEX IF NOT EXISTS idx_rms_audit_log_timestamp ON rms_audit_log(created_at DESC);

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rms_audit_log' 
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully renamed timestamp column to created_at';
END $$;

