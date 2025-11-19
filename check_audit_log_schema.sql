-- Check the audit log schema and sample data
-- This verifies the audit logging infrastructure is ready

-- 1. Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'rms_audit_log'
ORDER BY ordinal_position;

-- 2. Check indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'rms_audit_log';

-- 3. Check recent audit entries (if any)
SELECT 
    id,
    table_name,
    action,
    record_id,
    user_email,
    source,
    created_at,
    CASE 
        WHEN changed_fields IS NOT NULL THEN jsonb_pretty(changed_fields::jsonb)
        ELSE NULL
    END as changed_fields_formatted
FROM rms_audit_log
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check audit counts by table
SELECT 
    table_name,
    action,
    COUNT(*) as audit_count
FROM rms_audit_log
GROUP BY table_name, action
ORDER BY table_name, action;

-- 5. Check for any audit entries from today
SELECT 
    table_name,
    action,
    COUNT(*) as count_today
FROM rms_audit_log
WHERE created_at >= CURRENT_DATE
GROUP BY table_name, action
ORDER BY table_name, action;

