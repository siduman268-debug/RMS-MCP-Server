# Deployment Steps: Vendor & Contract Card UI

## ⚠️ IMPORTANT: Run in this order!

## Step 1: Add contract_number to Database (FIRST!)

### Option A: Run SQL via Supabase Dashboard
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy the contents of `add_contract_number_field.sql`
5. Paste and click **RUN**

### Option B: Run SQL via psql (if you have access)
```bash
psql -h your-supabase-host.supabase.co -U postgres -d postgres < add_contract_number_field.sql
```

### Verify the migration worked:
```sql
-- Check if contract_number column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rate_contract' 
AND column_name = 'contract_number';

-- Check if contract numbers were generated
SELECT id, contract_number, name, vendor_id, is_spot 
FROM rate_contract 
ORDER BY id 
LIMIT 10;
```

**Expected Results:**
```
id | contract_number      | name                    | vendor_id | is_spot
---|----------------------|-------------------------|-----------|--------
 1 | 1-SPOT-202510-001    | Spot Ocean Base         | 1         | true
 2 | 2-SPOT-202510-002    | ACME Lines SPOT         | 2         | true
 3 | 3-SPOT-202510-003    | Maersk SPOT             | 3         | true
```

---

## Step 2: Commit and Push Code Changes

```bash
# Check what we've changed
git status

# Add all changes
git add .

# Commit
git commit -m "feat: add vendor cards, contract cards with auto-generated contract numbers and vendor names"

# Push to origin
git push origin master
```

---

## Step 3: Deploy Backend to VM

```bash
# SSH to VM
ssh your-vm-user@your-vm-ip

# Navigate to project
cd ~/rms-mcp-server

# Pull latest code
git pull origin master

# Rebuild and restart Docker
docker-compose down
docker-compose build
docker-compose up -d

# Check logs
docker-compose logs -f --tail=50

# Test the API (in another terminal)
TOKEN=$(curl -s -X POST "http://localhost:3000/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r '.token')

# Test contracts endpoint
curl -X GET "http://localhost:3000/api/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "contract_number": "1-SPOT-202510-001",
      "name": "Spot Ocean Base",
      "vendor_id": 1,
      "vendor_name": "Generic Carrier",
      "vendor_code": null,
      "vendor_logo": null,
      "effective_from": "2025-10-07",
      "effective_to": "2026-01-05",
      "is_spot": true,
      "currency": "USD"
    }
  ]
}
```

---

## Step 4: Deploy Frontend to Salesforce

```bash
# From your local Windows machine
cd C:\Users\Admin\RMS\rms-mcp-server

# Deploy the Ocean Freight LWC
sf project deploy start --source-dir force-app/main/default/lwc/rmsOceanFreight --target-org RMS-Scratch-Org
```

---

## Step 5: Test in Salesforce

1. Open Salesforce
2. Navigate to **RMS Management** app
3. Go to **Ocean Freight** tab
4. **Verify Vendor Cards:**
   - Should see cards with logos (or initials)
   - Cards should have vendor name and type
   - Click a card → should get blue border + checkmark
5. **Verify Contract Cards:**
   - Should load after selecting a vendor
   - Should show contract number (e.g., "3-SPOT-202510-003")
   - Should show vendor name (e.g., "Maersk")
   - Should show formatted dates
   - Should have SPOT/CONTRACT badge
6. **Test Rate Fetching:**
   - Select vendor → select contract → add filters → click "Fetch Rates"
   - Should load rates for the selected vendor/contract

---

## ⚠️ Troubleshooting

### Issue: SQL migration fails
**Error:** `column "contract_number" already exists`
```sql
-- Check if column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'rate_contract' AND column_name = 'contract_number';

-- If it exists but has no data, just update:
UPDATE rate_contract
SET contract_number = generate_contract_number(vendor_id, is_spot, effective_from, id)
WHERE contract_number IS NULL;
```

### Issue: contract_number is NULL in API response
The SQL migration may not have run. Check:
```sql
SELECT id, contract_number FROM rate_contract LIMIT 5;
```

If all NULL, run the UPDATE statement from the migration file.

### Issue: vendor_name is NULL in API response
1. Check the vendor table has data:
```sql
SELECT id, name FROM vendor LIMIT 5;
```

2. Check the API is doing the join correctly (should see vendor_name in response)

3. Check VM logs for errors:
```bash
docker-compose logs -f
```

### Issue: LWC shows old dropdown instead of cards
Clear Salesforce cache:
1. In Salesforce, press `Ctrl + Shift + Delete`
2. Select "Clear Lightning cache"
3. Refresh the page

Or redeploy:
```bash
sf project deploy start --source-dir force-app/main/default/lwc/rmsOceanFreight --target-org RMS-Scratch-Org --ignore-warnings
```

---

## 📋 Quick Checklist

- [ ] Step 1: Run SQL migration in Supabase
- [ ] Verify contract_number column exists
- [ ] Verify contract numbers are generated
- [ ] Step 2: Commit and push code to Git
- [ ] Step 3: Deploy backend to VM
- [ ] Verify API returns vendor_name and contract_number
- [ ] Step 4: Deploy LWC to Salesforce
- [ ] Step 5: Test vendor cards in Salesforce
- [ ] Step 5: Test contract cards in Salesforce
- [ ] Step 5: Test rate fetching works

---

## 🎯 What Changed

1. **Database:** Added `contract_number` field with auto-generation
2. **API:** Added vendor name/logo to contracts endpoint via JOIN
3. **LWC:** Changed from dropdowns to beautiful card selection

