# Vendor & Contract CRUD Operations Guide

## 🎯 What Was Added

We've added full **CREATE, UPDATE, DELETE** operations for Vendors and Contracts. Previously, these entities were **READ-ONLY**. Now they support complete CRUD (Create, Read, Update, Delete) operations.

---

## 📋 Summary of Changes

### ✅ **Vendor Endpoints**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List all vendors (existing) |
| GET | `/api/vendors/:vendorId` | Get vendor by ID (existing) |
| **POST** | `/api/vendors` | **Create new vendor** ⭐ NEW |
| **PUT** | `/api/vendors/:vendorId` | **Update vendor** ⭐ NEW |
| **DELETE** | `/api/vendors/:vendorId` | **Delete vendor** ⭐ NEW |

### ✅ **Contract Endpoints**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts` | List all contracts (existing) |
| GET | `/api/contracts/:contractId` | Get contract by ID (existing) |
| **POST** | `/api/contracts` | **Create new contract** ⭐ NEW |
| **PUT** | `/api/contracts/:contractId` | **Update contract** ⭐ NEW |
| **DELETE** | `/api/contracts/:contractId` | **Delete contract** ⭐ NEW |

### ✅ **Ocean Freight Rates** (Already Complete)
All CRUD operations were already working for Ocean Freight Rates.

---

## 🚀 Deploy to VM

### Step 1: SSH into the VM
```bash
ssh root@185.199.53.169
cd /root/rms-mcp-server
```

### Step 2: Pull Latest Changes
```bash
git pull origin master
```

### Step 3: Rebuild and Restart Docker
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Step 4: Verify Deployment
```bash
# Check logs
docker-compose logs -f --tail=50

# Should see: "Server listening at http://0.0.0.0:3000"
```

---

## 🧪 Test CRUD Operations

### Test Vendor CRUD
```bash
cd /root/rms-mcp-server
chmod +x test-vendor-crud.sh
./test-vendor-crud.sh
```

**Expected Output:**
```
✅ Token obtained
✅ Vendor created with ID: 123
✅ Vendor read successfully
✅ Vendor updated successfully
✅ Vendors list retrieved
✅ Vendor deleted successfully
✅ Vendor deletion verified
```

### Test Contract CRUD
```bash
chmod +x test-contract-crud.sh
./test-contract-crud.sh
```

**Expected Output:**
```
✅ Token obtained
✅ Using Vendor ID: 1
✅ Contract created with ID: 456
   Contract Number: 1-SPOT-202511-456
✅ Contract read successfully
✅ Contract updated successfully
✅ Contracts list retrieved
✅ Contract deleted successfully
✅ Contract deletion verified
```

---

## 🔒 Security Features

All endpoints are protected by:
1. **JWT Authentication** - Valid token required
2. **Tenant Isolation** - Only see data for your tenant
3. **Row-Level Security (RLS)** - Database-level enforcement
4. **Field Protection** - Cannot modify `tenant_id`, `id`, `created_at`

---

## 📝 API Usage Examples

### Create a Vendor
```bash
curl -X POST "http://185.199.53.169:3000/api/vendors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "MAERSK LINE",
    "alias": "MSK",
    "vendor_type": "carrier",
    "mode": ["ocean"],
    "external_ref": "MSK-001"
  }'
```

### Update a Vendor
```bash
curl -X PUT "http://185.199.53.169:3000/api/vendors/123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "MAERSK LINE UPDATED",
    "mode": ["ocean", "air"]
  }'
```

### Delete a Vendor
```bash
curl -X DELETE "http://185.199.53.169:3000/api/vendors/123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create a Contract
```bash
curl -X POST "http://185.199.53.169:3000/api/contracts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "vendor_id": 1,
    "name": "Ocean Freight Contract Q1",
    "mode": "ocean",
    "is_spot": false,
    "effective_from": "2025-01-01",
    "effective_to": "2025-03-31",
    "currency": "USD",
    "terms": {"payment_terms": "30 days"}
  }'
```

### Update a Contract
```bash
curl -X PUT "http://185.199.53.169:3000/api/contracts/456" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Ocean Freight Contract Q1-Q2",
    "effective_to": "2025-06-30"
  }'
```

### Delete a Contract
```bash
curl -X DELETE "http://185.199.53.169:3000/api/contracts/456" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔍 Troubleshooting

### Issue: 401 Unauthorized
**Solution:** Get a new JWT token first:
```bash
curl -X POST "http://185.199.53.169:3000/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "user_id": "user-001"
  }'
```

### Issue: 404 Not Found
**Solution:** Ensure VM is updated and Docker is running:
```bash
docker-compose ps
# Should show: rms-api-server running
```

### Issue: 500 Server Error
**Solution:** Check Docker logs:
```bash
docker-compose logs -f --tail=100
```

---

## ✅ Test Checklist

- [ ] Deploy code to VM
- [ ] Run `test-vendor-crud.sh` - all tests pass
- [ ] Run `test-contract-crud.sh` - all tests pass
- [ ] Test from Salesforce UI - Create, Edit, Delete vendor
- [ ] Test from Salesforce UI - Create, Edit, Delete contract
- [ ] Verify tenant isolation (cannot see other tenant's data)
- [ ] Verify RLS policies (database enforces access control)

---

## 🎉 What This Enables

Now you can:
1. ✅ **Create vendors** directly from Salesforce UI
2. ✅ **Edit vendor details** (name, type, mode, etc.)
3. ✅ **Delete vendors** from the system
4. ✅ **Create contracts** for any vendor
5. ✅ **Edit contract terms** (dates, amounts, conditions)
6. ✅ **Delete contracts** when no longer needed
7. ✅ **All changes write back to Supabase database**
8. ✅ **Full tenant isolation and security**

The full circle is now complete: **Salesforce ↔ API ↔ Supabase Database** 🚀

