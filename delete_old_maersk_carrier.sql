-- Delete old "Maersk" carrier and keep only "MAERSK"
-- This will update all references first, then delete the duplicate

BEGIN;

-- Step 1: Get the IDs
DO $$
DECLARE
    old_maersk_id UUID;
    new_maersk_id UUID;
BEGIN
    -- Get IDs
    SELECT id INTO old_maersk_id FROM public.carrier WHERE name = 'Maersk' LIMIT 1;
    SELECT id INTO new_maersk_id FROM public.carrier WHERE name = 'MAERSK' LIMIT 1;
    
    IF old_maersk_id IS NULL THEN
        RAISE NOTICE 'Old "Maersk" carrier not found - nothing to do';
        RETURN;
    END IF;
    
    IF new_maersk_id IS NULL THEN
        RAISE EXCEPTION 'New "MAERSK" carrier not found - cannot proceed';
    END IF;
    
    RAISE NOTICE 'Old Maersk ID: %', old_maersk_id;
    RAISE NOTICE 'New MAERSK ID: %', new_maersk_id;
    
    -- Step 2: Update all service records
    UPDATE public.service
    SET carrier_id = new_maersk_id
    WHERE carrier_id = old_maersk_id;
    
    RAISE NOTICE 'Updated service records';
    
    -- Step 3: Update schedule_source_audit records
    UPDATE public.schedule_source_audit
    SET carrier_id = new_maersk_id
    WHERE carrier_id = old_maersk_id;
    
    RAISE NOTICE 'Updated schedule_source_audit records';
    
    -- Step 4: Delete the old "Maersk" carrier
    DELETE FROM public.carrier
    WHERE id = old_maersk_id;
    
    RAISE NOTICE 'Deleted old "Maersk" carrier';
END $$;

-- Step 5: Verify only "MAERSK" remains
SELECT 
    id, 
    name, 
    created_at,
    (SELECT COUNT(*) FROM public.service WHERE carrier_id = carrier.id) as service_count,
    (SELECT COUNT(*) FROM public.schedule_source_audit WHERE carrier_id = carrier.id) as audit_count
FROM public.carrier
WHERE UPPER(name) = 'MAERSK';

-- If this shows only 1 row with name = 'MAERSK', you're good!
-- Then run: COMMIT;
-- If something looks wrong, run: ROLLBACK;

-- COMMIT;
-- ROLLBACK;




