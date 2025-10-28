-- Database Schema Analysis Queries
-- Run these queries to understand the actual table structures, constraints, and validations

-- ==========================================
-- 1. OCEAN FREIGHT RATE TABLE SCHEMA
-- ==========================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'ocean_freight_rate' 
ORDER BY ordinal_position;

-- ==========================================
-- 2. SURCHARGE TABLE SCHEMA
-- ==========================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'surcharge' 
ORDER BY ordinal_position;

-- ==========================================
-- 3. LOCATIONS TABLE SCHEMA
-- ==========================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'locations' 
ORDER BY ordinal_position;

-- ==========================================
-- 4. CHARGE_MASTER TABLE SCHEMA
-- ==========================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'charge_master' 
ORDER BY ordinal_position;

-- ==========================================
-- 5. CHECK CONSTRAINTS FOR ALL TABLES
-- ==========================================
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('ocean_freight_rate', 'surcharge', 'locations', 'charge_master')
    AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- ==========================================
-- 6. FOREIGN KEY CONSTRAINTS
-- ==========================================
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('ocean_freight_rate', 'surcharge', 'locations', 'charge_master')
ORDER BY tc.table_name, tc.constraint_name;

-- ==========================================
-- 7. UNIQUE CONSTRAINTS
-- ==========================================
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_name IN ('ocean_freight_rate', 'surcharge', 'locations', 'charge_master')
ORDER BY tc.table_name, tc.constraint_name;

-- ==========================================
-- 8. SAMPLE DATA FROM EACH TABLE
-- ==========================================

-- Sample ocean freight rates
SELECT * FROM ocean_freight_rate LIMIT 3;

-- Sample surcharges
SELECT * FROM surcharge LIMIT 3;

-- Sample locations
SELECT * FROM locations LIMIT 5;

-- Sample charge master
SELECT * FROM charge_master LIMIT 5;

-- ==========================================
-- 9. ENUM VALUES (if any)
-- ==========================================
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%calc_method%' 
   OR t.typname LIKE '%uom%'
   OR t.typname LIKE '%applies_scope%'
ORDER BY t.typname, e.enumsortorder;

-- ==========================================
-- 10. INDEXES
-- ==========================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('ocean_freight_rate', 'surcharge', 'locations', 'charge_master')
ORDER BY tablename, indexname;

