-- ==================================================================
-- MIGRATION: Add contract_number to rate_contract table
-- Purpose: Add human-readable contract identifiers
-- Format: {vendor_id}-{SPOT/CNTR}-{YYYYMM}{sequence}
-- Example: 3-SPOT-202510-001, 3-CNTR-202501-012
-- Date: 2025-11-18
-- ==================================================================

-- ==================================================================
-- STEP 1: Add contract_number column
-- ==================================================================
ALTER TABLE rate_contract 
ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- Create unique index on contract_number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_contract_number 
ON rate_contract(contract_number, tenant_id) 
WHERE contract_number IS NOT NULL;

-- ==================================================================
-- STEP 2: Create a function to generate contract numbers
-- ==================================================================
CREATE OR REPLACE FUNCTION generate_contract_number(
    p_vendor_id bigint,
    p_is_spot boolean,
    p_effective_from date,
    p_contract_id bigint
)
RETURNS TEXT AS $$
DECLARE
    v_type TEXT;
    v_date_prefix TEXT;
    v_sequence TEXT;
BEGIN
    -- Determine type
    v_type := CASE WHEN p_is_spot THEN 'SPOT' ELSE 'CNTR' END;
    
    -- Format date as YYYYMM
    v_date_prefix := TO_CHAR(p_effective_from, 'YYYYMM');
    
    -- Format contract ID as 3-digit sequence
    v_sequence := LPAD(CAST(p_contract_id AS TEXT), 3, '0');
    
    -- Combine: vendor_id-type-YYYYMM-sequence
    RETURN CONCAT(
        p_vendor_id, '-',
        v_type, '-',
        v_date_prefix, '-',
        v_sequence
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==================================================================
-- STEP 3: Update existing records with auto-generated contract numbers
-- ==================================================================
UPDATE rate_contract
SET contract_number = generate_contract_number(
    vendor_id,
    is_spot,
    effective_from,
    id
)
WHERE contract_number IS NULL;

-- ==================================================================
-- STEP 4: Create trigger to auto-generate contract_number on insert
-- ==================================================================
CREATE OR REPLACE FUNCTION set_contract_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.contract_number IS NULL THEN
        NEW.contract_number := generate_contract_number(
            NEW.vendor_id,
            NEW.is_spot,
            NEW.effective_from,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_contract_number ON rate_contract;

CREATE TRIGGER trigger_set_contract_number
BEFORE INSERT ON rate_contract
FOR EACH ROW
EXECUTE FUNCTION set_contract_number();

-- ==================================================================
-- VERIFICATION QUERIES
-- ==================================================================

-- Verify contract numbers with vendor names
SELECT 
    rc.id,
    rc.contract_number,
    rc.name as contract_name,
    v.name as vendor_name,
    rc.vendor_id,
    rc.effective_from,
    rc.effective_to,
    rc.is_spot,
    rc.tenant_id
FROM rate_contract rc
LEFT JOIN vendor v ON rc.vendor_id = v.id
ORDER BY rc.contract_number;

-- ==================================================================
-- EXAMPLE RESULTS
-- ==================================================================

/*
CONTRACTS WITH NUMBERS AND VENDOR NAMES:
id | contract_number      | contract_name              | vendor_name    | vendor_id | effective_from | effective_to | is_spot
---|----------------------|----------------------------|----------------|-----------|----------------|--------------|--------
 1 | 1-SPOT-202510-001    | Spot Ocean Base            | Generic        | 1         | 2025-10-07     | 2026-01-05   | true
 2 | 2-SPOT-202510-002    | ACME Lines SPOT            | ACME Lines     | 2         | 2025-10-07     | 2026-01-05   | true
 3 | 3-SPOT-202510-003    | Maersk SPOT                | Maersk         | 3         | 2025-10-07     | 2026-01-05   | true
 4 | 4-SPOT-202510-004    | MSC SPOT                   | MSC            | 4         | 2025-10-07     | 2026-01-05   | true
11 | 1-CNTR-202501-011    | Generic Carrier CONTRACT   | Generic        | 1         | 2025-01-01     | 2025-12-31   | false
12 | 2-CNTR-202501-012    | ACME Lines CONTRACT 2025   | ACME Lines     | 2         | 2025-01-01     | 2025-12-31   | false
13 | 3-CNTR-202501-013    | Maersk CONTRACT 2025       | Maersk         | 3         | 2025-01-01     | 2025-12-31   | false
*/

-- ==================================================================
-- TEST: Insert a new contract to verify trigger
-- ==================================================================
/*
-- This should auto-generate contract_number
INSERT INTO rate_contract (
    vendor_id,
    mode,
    name,
    effective_from,
    effective_to,
    is_spot,
    currency,
    tenant_id
) VALUES (
    3,
    'ocean',
    'Maersk Test SPOT',
    '2025-11-01',
    '2025-12-31',
    true,
    'USD',
    '00000000-0000-0000-0000-000000000001'
);

-- Check the result
SELECT id, contract_number, name, vendor_id, is_spot 
FROM rate_contract 
WHERE name = 'Maersk Test SPOT';

-- Expected: contract_number = '3-SPOT-202511-XXX'
*/

-- ==================================================================
-- ROLLBACK SCRIPT (if needed)
-- ==================================================================
/*
-- Remove trigger and function
DROP TRIGGER IF EXISTS trigger_set_contract_number ON rate_contract;
DROP FUNCTION IF EXISTS set_contract_number();
DROP FUNCTION IF EXISTS generate_contract_number(bigint, boolean, date, bigint);

-- Remove index
DROP INDEX IF EXISTS idx_rate_contract_number;

-- Remove column
ALTER TABLE rate_contract DROP COLUMN IF EXISTS contract_number;
*/

