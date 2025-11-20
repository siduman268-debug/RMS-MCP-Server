# Bulk API Implementation Plan
**Date**: 2025-11-20  
**Purpose**: Add efficient bulk upload API endpoints to replace multiple single-record calls

---

## Current Problem

The existing bulk upload flow is inefficient:
```
LWC → Apex loops 50 times → API called 50 times → Database inserts 50 times
```

**Issues**:
- 50 HTTP callouts for 50 records (Salesforce limit: 100)
- Slow performance (~5-10 seconds for 50 records)
- No transaction safety (partial failures leave inconsistent state)
- Difficult error handling

---

## Proposed Solution

Add dedicated bulk endpoints that accept arrays:
```
LWC → Apex calls once → API processes array → Database batch insert
```

**Benefits**:
- 1 HTTP callout for 50 records (99% reduction)
- Fast performance (~1-2 seconds for 50 records)
- Transactional safety (all-or-nothing, or partial with rollback)
- Clear error reporting per record

---

## Implementation

### Step 1: Add Bulk API Endpoints (src/index.ts)

#### POST /api/vendors/bulk
```typescript
fastify.post('/api/vendors/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const tenantId = (request as any).tenant_id;
        const vendors = request.body as any[];
        
        if (!Array.isArray(vendors) || vendors.length === 0) {
            return reply.code(400).send({
                success: false,
                error: 'Request body must be a non-empty array of vendors'
            });
        }

        const results = {
            successCount: 0,
            errorCount: 0,
            errors: [] as string[],
            insertedIds: [] as number[]
        };

        // Add tenant_id to all records
        const vendorsWithTenant = vendors.map(v => ({ ...v, tenant_id: tenantId }));

        // Batch insert (PostgreSQL supports up to 1000 rows)
        const { data, error } = await supabase
            .from('vendor')
            .insert(vendorsWithTenant)
            .select('id');

        if (error) {
            console.error('Bulk vendor insert error:', error);
            return reply.code(500).send({
                success: false,
                error: error.message,
                errorCount: vendors.length
            });
        }

        results.successCount = data.length;
        results.insertedIds = data.map(v => v.id);

        // Audit logging (single entry for bulk operation)
        await logAudit(
            supabase, 
            tenantId, 
            'vendor', 
            'bulk', 
            'CREATE', 
            undefined, 
            undefined, 
            undefined, 
            { count: results.successCount, ids: results.insertedIds }
        );

        return reply.send({
            success: true,
            ...results
        });

    } catch (error: any) {
        console.error('Bulk vendor upload error:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || String(error)
        });
    }
});
```

#### POST /api/contracts/bulk
```typescript
fastify.post('/api/contracts/bulk', async (request, reply) => {
    // Similar structure to vendors bulk endpoint
});
```

### Step 2: Update Apex to Use Bulk Endpoints

#### RMSVendorService.cls
```apex
@AuraEnabled
public static BulkOperationResult bulkCreateVendors(List<Map<String, Object>> vendors) {
    BulkOperationResult result = new BulkOperationResult();
    
    try {
        // Single API call with array of vendors
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:RMS_API/api/vendors/bulk');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(vendors));
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() == 200) {
            Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            result.successCount = (Integer) response.get('successCount');
            result.errorCount = (Integer) response.get('errorCount');
            result.errors = (List<String>) response.get('errors');
        } else {
            result.errorCount = vendors.size();
            result.errors.add('API Error: ' + res.getStatus());
        }
        
    } catch (Exception e) {
        result.errorCount = vendors.size();
        result.errors.add('Exception: ' + e.getMessage());
    }
    
    return result;
}
```

### Step 3: Add Error Handling for Partial Failures

For better error handling, process records individually but in a transaction:

```typescript
fastify.post('/api/vendors/bulk', async (request, reply) => {
    const vendors = request.body as any[];
    const results = {
        successCount: 0,
        errorCount: 0,
        errors: [] as string[],
        insertedIds: [] as number[]
    };

    // Process each vendor, collecting errors
    for (let i = 0; i < vendors.length; i++) {
        try {
            const vendor = { ...vendors[i], tenant_id: tenantId };
            
            const { data, error } = await supabase
                .from('vendor')
                .insert([vendor])
                .select('id')
                .single();

            if (error) {
                results.errorCount++;
                results.errors.push(`Row ${i + 1}: ${error.message}`);
            } else {
                results.successCount++;
                results.insertedIds.push(data.id);
            }
        } catch (err) {
            results.errorCount++;
            results.errors.push(`Row ${i + 1}: ${err.message}`);
        }
    }

    return reply.send({
        success: results.errorCount === 0,
        ...results
    });
});
```

---

## Performance Comparison

### Current Approach (50 records)
- **Callouts**: 50 HTTP requests
- **Time**: ~5-10 seconds
- **Salesforce Limits**: 50% of callout limit used
- **Database**: 50 individual INSERTs

### New Approach (50 records)
- **Callouts**: 1 HTTP request
- **Time**: ~1-2 seconds
- **Salesforce Limits**: 1% of callout limit used
- **Database**: 1 batch INSERT or 50 transactional INSERTs

**Performance Improvement**: **5-10x faster**, **50x fewer callouts**

---

## Rollout Plan

### Phase 1: Add Bulk Endpoints (1 hour)
- [ ] Add POST /api/vendors/bulk
- [ ] Add POST /api/contracts/bulk
- [ ] Test with sample data

### Phase 2: Update Apex Services (30 min)
- [ ] Update RMSVendorService.bulkCreateVendors
- [ ] Update RMSContractService.bulkCreateContracts
- [ ] Deploy to Salesforce

### Phase 3: Test End-to-End (30 min)
- [ ] Upload 10 vendors via LWC
- [ ] Upload 50 vendors via LWC
- [ ] Upload invalid data (test error handling)
- [ ] Verify audit logs

### Phase 4: Expand to Other Entities (2-4 hours)
- [ ] POST /api/ocean-freight/bulk
- [ ] POST /api/surcharges/bulk
- [ ] POST /api/margin-rules/bulk
- [ ] POST /api/haulage-routes/bulk
- [ ] POST /api/haulage-rates/bulk
- [ ] POST /api/haulage-legs/bulk
- [ ] POST /api/haulage-responsibilities/bulk

---

## Testing

### Unit Tests
```typescript
describe('POST /api/vendors/bulk', () => {
    it('should insert 50 vendors in one batch', async () => {
        const vendors = Array(50).fill(null).map((_, i) => ({
            name: `Vendor ${i}`,
            vendor_type: 'OCEAN_CARRIER',
            mode: ['OCEAN']
        }));

        const response = await fastify.inject({
            method: 'POST',
            url: '/api/vendors/bulk',
            payload: vendors
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().successCount).toBe(50);
    });

    it('should handle partial failures', async () => {
        const vendors = [
            { name: 'Valid Vendor', vendor_type: 'OCEAN_CARRIER', mode: ['OCEAN'] },
            { name: '', vendor_type: 'INVALID', mode: [] }, // Invalid
            { name: 'Another Valid', vendor_type: 'FREIGHT_FORWARDER', mode: ['AIR'] }
        ];

        const response = await fastify.inject({
            method: 'POST',
            url: '/api/vendors/bulk',
            payload: vendors
        });

        expect(response.json().successCount).toBe(2);
        expect(response.json().errorCount).toBe(1);
    });
});
```

---

## Conclusion

**Current State**: Bulk uploads work but are inefficient (50 callouts for 50 records).

**Recommendation**: Implement dedicated bulk API endpoints (`/api/vendors/bulk`, etc.) to achieve 5-10x performance improvement and better error handling.

**Estimated Effort**: 2-3 hours to implement, test, and deploy.

**Priority**: Medium (works now, but optimization would greatly improve UX)

Would you like me to implement the bulk API endpoints now?

