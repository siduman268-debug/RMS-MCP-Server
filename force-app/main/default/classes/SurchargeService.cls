/**
 * @description Service class for Surcharge operations
 * @author RMS Team
 * @date 2025-01-27
 */
public class SurchargeService {
    
    /**
     * @description Create a new surcharge
     * @param surcharge Surcharge__c record
     * @return Surcharge__c Created record
     */
    public static Surcharge__c createSurcharge(Surcharge__c surcharge) {
        Map<String, Object> payload = RMSApiUtil.convertToApiFormat(surcharge, 'Surcharge__c');
        String body = JSON.serialize(payload);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges', 'POST', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Surcharge__c createdSurcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
        
        return createdSurcharge;
    }
    
    /**
     * @description Update an existing surcharge
     * @param surchargeId RMS surcharge ID
     * @param updates Map of fields to update
     * @return Surcharge__c Updated record
     */
    public static Surcharge__c updateSurcharge(String surchargeId, Map<String, Object> updates) {
        String body = JSON.serialize(updates);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'PUT', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Surcharge__c updatedSurcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
        
        return updatedSurcharge;
    }
    
    /**
     * @description Get surcharge by ID
     * @param surchargeId RMS surcharge ID
     * @return Surcharge__c Surcharge record
     */
    public static Surcharge__c getSurcharge(String surchargeId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'GET', null);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Surcharge__c surcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
        
        return surcharge;
    }
    
    /**
     * @description List surcharges with optional filters
     * @param filters Map of filter parameters
     * @return List<Surcharge__c> List of surcharges
     */
    public static List<Surcharge__c> listSurcharges(Map<String, Object> filters) {
        String endpoint = '/api/surcharges';
        
        if (filters != null && !filters.isEmpty()) {
            List<String> params = new List<String>();
            for (String key : filters.keySet()) {
                if (filters.get(key) != null) {
                    params.add(key + '=' + EncodingUtil.urlEncode(String.valueOf(filters.get(key)), 'UTF-8'));
                }
            }
            if (!params.isEmpty()) {
                endpoint += '?' + String.join(params, '&');
            }
        }
        
        HttpResponse res = RMSApiUtil.makeApiCall(endpoint, 'GET', null);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        List<Surcharge__c> surcharges = new List<Surcharge__c>();
        List<Object> dataList = (List<Object>) response.get('data');
        
        for (Object item : dataList) {
            Map<String, Object> data = (Map<String, Object>) item;
            Surcharge__c surcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
            surcharges.add(surcharge);
        }
        
        return surcharges;
    }
    
    /**
     * @description Delete surcharge
     * @param surchargeId RMS surcharge ID
     * @return Boolean Success status
     */
    public static Boolean deleteSurcharge(String surchargeId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'DELETE', null);
        
        return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
    }
    
    /**
     * @description Get surcharges by charge code
     * @param chargeCode Charge code (THC, BAF, etc.)
     * @return List<Surcharge__c> Matching surcharges
     */
    public static List<Surcharge__c> getSurchargesByCode(String chargeCode) {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('charge_code', chargeCode);
        
        return listSurcharges(filters);
    }
    
    /**
     * @description Get surcharges by applies scope
     * @param appliesScope Scope (origin, port, freight, dest, door, other)
     * @return List<Surcharge__c> Matching surcharges
     */
    public static List<Surcharge__c> getSurchargesByScope(String appliesScope) {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('applies_scope', appliesScope);
        
        return listSurcharges(filters);
    }
    
    /**
     * @description Get active surcharges
     * @return List<Surcharge__c> Active surcharges
     */
    public static List<Surcharge__c> getActiveSurcharges() {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('is_active', true);
        
        return listSurcharges(filters);
    }
    
    // ==========================================
    // @AuraEnabled METHODS FOR LWC
    // ==========================================
    
    /**
     * @description List surcharges for LWC
     * @param filtersJson JSON string of filter parameters
     * @return List<Map<String, Object>> List of surcharges as maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listSurchargesForLWC(String filtersJson) {
        try {
            Map<String, Object> filters = filtersJson != null ? 
                (Map<String, Object>) JSON.deserializeUntyped(filtersJson) : 
                new Map<String, Object>();
            
            String endpoint = '/api/surcharges';
            
            if (filters != null && !filters.isEmpty()) {
                List<String> params = new List<String>();
                for (String key : filters.keySet()) {
                    if (filters.get(key) != null) {
                        params.add(key + '=' + EncodingUtil.urlEncode(String.valueOf(filters.get(key)), 'UTF-8'));
                    }
                }
                if (!params.isEmpty()) {
                    endpoint += '?' + String.join(params, '&');
                }
            }
            
            HttpResponse res = RMSApiUtil.makeApiCall(endpoint, 'GET', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> surcharges = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    surcharges.add((Map<String, Object>) item);
                }
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterRecordsByPermission(surcharges, RMSPermissionService.ENTITY_SURCHARGE);
        } catch (Exception e) {
            throw new AuraHandledException('Error listing surcharges: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create surcharge for LWC
     * @param surchargeData Map of surcharge fields
     * @return Map<String, Object> Created surcharge
     */
    @AuraEnabled
    public static Map<String, Object> createSurchargeForLWC(Map<String, Object> surchargeData) {
        try {
            // Check create permission - sales users can create surcharges
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_SURCHARGE, RMSPermissionService.PERMISSION_CREATE);
            
            // Ensure tenant_id is included (RLS enforcement)
            surchargeData = RMSApiUtil.addTenantToPayload(surchargeData);
            String body = JSON.serialize(surchargeData);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges', 'POST', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> createdSurcharge = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(createdSurcharge, RMSPermissionService.ENTITY_SURCHARGE);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating surcharge: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update surcharge for LWC
     * @param surchargeId RMS surcharge ID
     * @param updates Map of fields to update
     * @return Map<String, Object> Updated surcharge
     */
    @AuraEnabled
    public static Map<String, Object> updateSurchargeForLWC(String surchargeId, Map<String, Object> updates) {
        try {
            // Check edit permission - sales users can edit surcharges
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_SURCHARGE, RMSPermissionService.PERMISSION_EDIT);
            
            // Prevent tenant_id modification (RLS enforcement)
            updates.remove('tenant_id');
            
            // Note: API RLS will enforce tenant isolation on the backend
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'PUT', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> updatedSurcharge = (Map<String, Object>) response.get('data');
            
            // Verify tenant access (RLS check)
            String surchargeTenantId = (String) updatedSurcharge.get('tenant_id');
            String userTenantId = RMSApiUtil.getTenantId();
            if (String.isNotBlank(surchargeTenantId) && !surchargeTenantId.equals(userTenantId)) {
                throw new AuraHandledException('Access denied: This surcharge belongs to a different tenant.');
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(updatedSurcharge, RMSPermissionService.ENTITY_SURCHARGE);
        } catch (Exception e) {
            throw new AuraHandledException('Error updating surcharge: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete surcharge for LWC
     * @param surchargeId RMS surcharge ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteSurchargeForLWC(String surchargeId) {
        try {
            // Check delete permission - sales users can delete surcharges
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_SURCHARGE, RMSPermissionService.PERMISSION_DELETE);
            
            // Note: API RLS will enforce tenant isolation on the backend
            HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'DELETE', null);
            
            if (res.getStatusCode() == 403 || res.getStatusCode() == 404) {
                throw new AuraHandledException('Access denied: This surcharge belongs to a different tenant or does not exist.');
            }
            
            return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting surcharge: ' + e.getMessage());
        }
    }
    
    /**
     * @description Bulk create surcharges from CSV data
     * @param surchargesList List of surcharge maps
     * @return List<Map<String, Object>> Results with created surcharges or errors
     */
    @AuraEnabled
    public static List<Map<String, Object>> bulkCreateSurcharges(List<Map<String, Object>> surchargesList) {
        try {
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            
            for (Map<String, Object> surchargeData : surchargesList) {
                try {
                    Map<String, Object> created = createSurchargeForLWC(surchargeData);
                    results.add(created);
                } catch (Exception e) {
                    Map<String, Object> errorResult = new Map<String, Object>();
                    errorResult.put('error', e.getMessage());
                    errorResult.put('data', surchargeData);
                    results.add(errorResult);
                }
            }
            
            return results;
        } catch (Exception e) {
            throw new AuraHandledException('Error in bulk create surcharges: ' + e.getMessage());
        }
    }
}

