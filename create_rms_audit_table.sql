-- ==================================================================
-- RMS AUDIT LOG TABLE
-- Purpose: Track all CRUD operations across RMS entities
-- Date: 2025-11-19
-- ==================================================================

-- Drop existing table if needed (for clean migrations)
-- DROP TABLE IF EXISTS rms_audit_log CASCADE;

-- Create audit log table
CREATE TABLE IF NOT EXISTS rms_audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  user_id TEXT,
  user_email TEXT,
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT DEFAULT 'SALESFORCE_LWC',
  ip_address INET,
  user_agent TEXT
);

-- Add comments for documentation
COMMENT ON TABLE rms_audit_log IS 'Audit trail for all RMS CRUD operations';
COMMENT ON COLUMN rms_audit_log.tenant_id IS 'Tenant UUID for multi-tenancy';
COMMENT ON COLUMN rms_audit_log.table_name IS 'Name of the table being modified (vendor, rate_contract, etc.)';
COMMENT ON COLUMN rms_audit_log.record_id IS 'ID of the record being modified (as string for flexibility)';
COMMENT ON COLUMN rms_audit_log.action IS 'Type of operation: CREATE, UPDATE, DELETE';
COMMENT ON COLUMN rms_audit_log.user_id IS 'Salesforce user ID or system user ID';
COMMENT ON COLUMN rms_audit_log.user_email IS 'Email of the user performing the action';
COMMENT ON COLUMN rms_audit_log.changed_fields IS 'Array of field names that were changed (for UPDATE)';
COMMENT ON COLUMN rms_audit_log.old_values IS 'Previous values before change (for UPDATE/DELETE)';
COMMENT ON COLUMN rms_audit_log.new_values IS 'New values after change (for CREATE/UPDATE)';
COMMENT ON COLUMN rms_audit_log.source IS 'Source of the change: SALESFORCE_LWC, MCP_TOOL, API_DIRECT, etc.';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_tenant 
  ON rms_audit_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_table_record 
  ON rms_audit_log(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp 
  ON rms_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user 
  ON rms_audit_log(user_id) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_action 
  ON rms_audit_log(action);

-- Create composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_audit_tenant_table_timestamp 
  ON rms_audit_log(tenant_id, table_name, created_at DESC);

-- ==================================================================
-- HELPER FUNCTION: Get audit history for a specific record
-- ==================================================================
CREATE OR REPLACE FUNCTION get_audit_history(
  p_table_name TEXT,
  p_record_id TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  action TEXT,
  user_email TEXT,
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.action,
    a.user_email,
    a.changed_fields,
    a.old_values,
    a.new_values,
    a.created_at
  FROM rms_audit_log a
  WHERE a.table_name = p_table_name
    AND a.record_id = p_record_id
    AND (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id)
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_audit_history IS 'Get complete audit history for a specific record';

-- ==================================================================
-- HELPER FUNCTION: Get recent changes for a tenant
-- ==================================================================
CREATE OR REPLACE FUNCTION get_recent_changes(
  p_tenant_id UUID,
  p_limit INT DEFAULT 100,
  p_table_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  table_name TEXT,
  record_id TEXT,
  action TEXT,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.table_name,
    a.record_id,
    a.action,
    a.user_email,
    a.created_at
  FROM rms_audit_log a
  WHERE a.tenant_id = p_tenant_id
    AND (p_table_name IS NULL OR a.table_name = p_table_name)
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_recent_changes IS 'Get recent changes for a tenant, optionally filtered by table';

-- ==================================================================
-- SAMPLE QUERIES (for reference)
-- ==================================================================

-- Get all changes for a specific vendor
-- SELECT * FROM get_audit_history('vendor', '1', '00000000-0000-0000-0000-000000000001');

-- Get recent changes across all tables for a tenant
-- SELECT * FROM get_recent_changes('00000000-0000-0000-0000-000000000001', 50);

-- Get all changes by a specific user
-- SELECT * FROM rms_audit_log 
-- WHERE user_email = 'user@example.com' 
-- ORDER BY created_at DESC 
-- LIMIT 100;

-- Get all deletions
-- SELECT * FROM rms_audit_log 
-- WHERE action = 'DELETE' 
-- ORDER BY created_at DESC;

-- Get changes for ocean_freight_rate table in last 24 hours
-- SELECT * FROM rms_audit_log 
-- WHERE table_name = 'ocean_freight_rate' 
--   AND created_at > NOW() - INTERVAL '24 hours'
-- ORDER BY created_at DESC;

-- ==================================================================
-- VERIFICATION QUERIES
-- ==================================================================

-- Check if table was created successfully
-- SELECT COUNT(*) as audit_records FROM rms_audit_log;

-- Check indexes
-- SELECT schemaname, tablename, indexname 
-- FROM pg_indexes 
-- WHERE tablename = 'rms_audit_log';

-- Check functions
-- SELECT proname, prosrc 
-- FROM pg_proc 
-- WHERE proname LIKE '%audit%';

-- ==================================================================
-- GRANT PERMISSIONS (adjust as needed for your setup)
-- ==================================================================

-- Grant necessary permissions to authenticated users
-- GRANT SELECT, INSERT ON rms_audit_log TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE rms_audit_log_id_seq TO authenticated;

-- Grant read-only access to audit log for reporting
-- GRANT SELECT ON rms_audit_log TO audit_viewer;

-- ==================================================================

