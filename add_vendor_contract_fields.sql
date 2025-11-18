-- ==================================================================
-- MIGRATION: Add vendor_code and contract_number fields
-- Purpose: Improve vendor and contract identification in UI
-- Date: 2025-11-18
-- ==================================================================

-- ==================================================================
-- STEP 1: Add vendor_code to vendor table
-- ==================================================================
ALTER TABLE vendor 
ADD COLUMN IF NOT EXISTS vendor_code TEXT;

-- Create unique index on vendor_code per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_code 
ON vendor(vendor_code, tenant_id) 
WHERE vendor_code IS NOT NULL;

-- Update existing records with codes based on name
UPDATE vendor 
SET vendor_code = 
  CASE 
    WHEN UPPER(name) LIKE '%MAERSK%' THEN 'MSK'
    WHEN UPPER(name) = 'MSC' THEN 'MSC'
    WHEN UPPER(name) LIKE '%CMA%CGM%' THEN 'CMA'
    WHEN UPPER(name) LIKE '%HAPAG%' THEN 'HLCU'
    WHEN UPPER(name) = 'ONE' THEN 'ONE'
    WHEN UPPER(name) LIKE '%COSCO%' THEN 'COSU'
    WHEN UPPER(name) LIKE '%EVERGREEN%' THEN 'EGLV'
    WHEN UPPER(name) LIKE '%ACME%' THEN 'ACME'
    WHEN UPPER(name) LIKE '%BLUEDART%' THEN 'BLUD'
    WHEN UPPER(name) LIKE '%CONCOR%' THEN 'CONC'
    WHEN UPPER(name) LIKE '%GATI%' THEN 'GATI'
    WHEN UPPER(name) LIKE '%MAHINDRA%' THEN 'MLL'
    WHEN UPPER(name) LIKE '%TCI%' THEN 'TCI'
    WHEN UPPER(name) LIKE '%VRL%' THEN 'VRL'
    WHEN UPPER(name) LIKE '%INDIAN RAIL%' THEN 'IR'
    WHEN UPPER(name) LIKE '%INLAND WATER%' THEN 'IWA'
    ELSE UPPER(SUBSTRING(REPLACE(name, ' ', ''), 1, 4))
  END
WHERE vendor_code IS NULL;

-- ==================================================================
-- STEP 2: Add contract_number to rate_contract table
-- ==================================================================
ALTER TABLE rate_contract 
ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- Create unique index on contract_number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_contract_number 
ON rate_contract(contract_number, tenant_id) 
WHERE contract_number IS NOT NULL;

-- Update existing records with auto-generated contract numbers
-- Format: SPOT-{vendor_code}-{year} or CNTR-{vendor_code}-{year}-{id}
UPDATE rate_contract rc
SET contract_number = 
  CASE 
    WHEN rc.is_spot THEN 
      CONCAT('SPOT-', COALESCE(v.vendor_code, CAST(rc.vendor_id AS TEXT)), '-', EXTRACT(YEAR FROM rc.effective_from))
    ELSE 
      CONCAT('CNTR-', COALESCE(v.vendor_code, CAST(rc.vendor_id AS TEXT)), '-', EXTRACT(YEAR FROM rc.effective_from), '-', LPAD(CAST(rc.id AS TEXT), 4, '0'))
  END
FROM vendor v
WHERE rc.vendor_id = v.id 
AND rc.contract_number IS NULL;

-- ==================================================================
-- VERIFICATION QUERIES
-- ==================================================================

-- Verify vendor codes
SELECT 
    id,
    name,
    vendor_code,
    vendor_type,
    tenant_id
FROM vendor
ORDER BY name;

-- Verify contract numbers
SELECT 
    rc.id,
    rc.contract_number,
    rc.name,
    v.vendor_code,
    v.name as vendor_name,
    rc.effective_from,
    rc.effective_to,
    rc.is_spot,
    rc.tenant_id
FROM rate_contract rc
LEFT JOIN vendor v ON rc.vendor_id = v.id
ORDER BY rc.id;

-- ==================================================================
-- EXAMPLE RESULTS
-- ==================================================================

/*
VENDORS WITH CODES:
id | name                      | vendor_code | vendor_type      | tenant_id
---|---------------------------|-------------|------------------|----------
 1 | Generic Carrier           | GENE        | OCEAN_CARRIER    | 00000000...
 2 | ACME Lines                | ACME        | OCEAN_CARRIER    | 00000000...
 3 | Maersk                    | MSK         | OCEAN_CARRIER    | 00000000...
 4 | MSC                       | MSC         | OCEAN_CARRIER    | 00000000...
 5 | CMA CGM                   | CMA         | OCEAN_CARRIER    | 00000000...
 6 | Hapag-Lloyd               | HLCU        | OCEAN_CARRIER    | 00000000...
 7 | ONE                       | ONE         | OCEAN_CARRIER    | 00000000...
 8 | COSCO                     | COSU        | OCEAN_CARRIER    | 00000000...
 9 | Evergreen                 | EGLV        | OCEAN_CARRIER    | 00000000...
10 | MAERSK                    | MSK         | OCEAN_CARRIER    | 00000000...

CONTRACTS WITH NUMBERS:
id | contract_number     | name                      | vendor_code | vendor_name    | effective_from | effective_to | is_spot
---|---------------------|---------------------------|-------------|----------------|----------------|--------------|--------
 1 | SPOT-GENE-2025      | Spot Ocean Base           | GENE        | Generic        | 2025-10-07     | 2026-01-05   | true
 2 | SPOT-ACME-2025      | ACME Lines SPOT           | ACME        | ACME Lines     | 2025-10-07     | 2026-01-05   | true
 3 | SPOT-MSK-2025       | Maersk SPOT               | MSK         | Maersk         | 2025-10-07     | 2026-01-05   | true
11 | CNTR-GENE-2025-0011 | Generic Carrier CONTRACT  | GENE        | Generic        | 2025-01-01     | 2025-12-31   | false
12 | CNTR-ACME-2025-0012 | ACME Lines CONTRACT 2025  | ACME        | ACME Lines     | 2025-01-01     | 2025-12-31   | false
13 | CNTR-MSK-2025-0013  | Maersk CONTRACT 2025      | MSK         | Maersk         | 2025-01-01     | 2025-12-31   | false
*/

-- ==================================================================
-- ROLLBACK SCRIPT (if needed)
-- ==================================================================
/*
-- Remove indexes
DROP INDEX IF EXISTS idx_vendor_code;
DROP INDEX IF EXISTS idx_rate_contract_number;

-- Remove columns
ALTER TABLE vendor DROP COLUMN IF EXISTS vendor_code;
ALTER TABLE rate_contract DROP COLUMN IF EXISTS contract_number;
*/

