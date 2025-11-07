# How to Fix the SQL Syntax Error

## Error Message
```
ERROR: 42601: syntax error at or near "FROM" LINE 17: FROM ocean_freight_rate ofr
```

## Root Cause
The error occurs because:
1. **Comments (`--`) in the middle of the SELECT list** break SQL syntax
2. **Missing commas** between columns
3. **Incomplete view definition** - the example was just a template

## Solution

### Step 1: Get Your Current View Definition

Run this query to see your actual view definition:

```sql
SELECT pg_get_viewdef('mv_freight_sell_prices', true);
```

This will show you the complete, working SELECT statement.

### Step 2: Copy the Complete Definition

Copy the entire SELECT statement from the output.

### Step 3: Add New Columns Correctly

Add the new columns to your SELECT list, following these rules:

#### ✅ CORRECT Syntax:
```sql
CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  ofr.id as rate_id,
  pol.unlocode as pol_code,           -- Existing column
  pod.unlocode as pod_code,            -- Existing column
  pol.name as pol_name,                -- Existing column
  pod.name as pod_name,                -- Existing column
  ofr.origin_code,                     -- NEW: Add this
  ofr.destination_code,                 -- NEW: Add this
  pol.name as origin_name,             -- NEW: Add this
  pod.name as destination_name,       -- NEW: Add this
  -- Continue with ALL your other existing columns
  ofr.container_type,
  ofr.buy_amount as ocean_freight_buy,
  -- ... all other columns from your original view
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id
-- ... all other JOINs
WHERE ofr.is_active = true;
```

#### ❌ WRONG - Don't Do This:
```sql
SELECT 
  ofr.id as rate_id,
  -- Old columns (for V1/V2/V3)  ← COMMENT IN SELECT LIST BREAKS SYNTAX
  pol.unlocode as pol_code,
  -- New columns (for V4)        ← COMMENT IN SELECT LIST BREAKS SYNTAX
  ofr.origin_code,
FROM ocean_freight_rate ofr  ← Missing columns, trailing comma
```

### Step 4: Key Rules

1. **NO comments (`--`) inside the SELECT list** - only before SELECT
2. **Comma between every column** (except the last one before FROM)
3. **Include ALL columns** from your original view
4. **Add new columns** after `pod_name`
5. **No trailing comma** before FROM

### Step 5: Complete Template

```sql
-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS mv_freight_sell_prices CASCADE;

-- Recreate with new columns
CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  -- Copy ALL columns from your original view definition
  -- Add these 4 new columns after pod_name:
  ofr.origin_code,
  ofr.destination_code,
  pol.name as origin_name,
  pod.name as destination_name,
  -- Continue with rest of your original columns
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id
-- ... all other JOINs from original view
WHERE ofr.is_active = true;

-- Refresh
REFRESH MATERIALIZED VIEW mv_freight_sell_prices;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_origin_code 
  ON mv_freight_sell_prices(origin_code);
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_destination_code 
  ON mv_freight_sell_prices(destination_code);
```

## Quick Fix Checklist

- [ ] Got current view definition with `pg_get_viewdef()`
- [ ] Copied complete SELECT statement
- [ ] Added 4 new columns: `origin_code`, `destination_code`, `origin_name`, `destination_name`
- [ ] No comments (`--`) in SELECT list
- [ ] Commas between all columns
- [ ] No trailing comma before FROM
- [ ] All original columns included
- [ ] All original JOINs included
- [ ] Tested the CREATE statement

## Still Having Issues?

Share your actual view definition (from `pg_get_viewdef`) and I can help you add the new columns correctly!

