/**
 * @description Service class for Ocean Freight Rate operations
 * @author RMS Team
 * @date 2025-01-27
 */
public class OceanFreightRateService {
    
    /**
     * @description Create a new ocean freight rate
     * @param rate Ocean_Freight_Rate__c record
     * @return Ocean_Freight_Rate__c Created record
     */
    public static Ocean_Freight_Rate__c createRate(Ocean_Freight_Rate__c rate) {
        Map<String, Object> payload = RMSApiUtil.convertToApiFormat(rate, 'Ocean_Freight_Rate__c');
        String body = JSON.serialize(payload);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates', 'POST', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Ocean_Freight_Rate__c createdRate = (Ocean_Freight_Rate__c) RMSApiUtil.convertFromApiFormat(data, 'Ocean_Freight_Rate__c');
        
        return createdRate;
    }
    
    /**
     * @description Update an existing ocean freight rate
     * @param rateId RMS rate ID
     * @param updates Map of fields to update
     * @return Ocean_Freight_Rate__c Updated record
     */
    public static Ocean_Freight_Rate__c updateRate(String rateId, Map<String, Object> updates) {
        String body = JSON.serialize(updates);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates/' + rateId, 'PUT', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Ocean_Freight_Rate__c updatedRate = (Ocean_Freight_Rate__c) RMSApiUtil.convertFromApiFormat(data, 'Ocean_Freight_Rate__c');
        
        return updatedRate;
    }
    
    /**
     * @description Get ocean freight rate by ID
     * @param rateId RMS rate ID
     * @return Ocean_Freight_Rate__c Rate record
     */
    public static Ocean_Freight_Rate__c getRate(String rateId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates/' + rateId, 'GET', null);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Ocean_Freight_Rate__c rate = (Ocean_Freight_Rate__c) RMSApiUtil.convertFromApiFormat(data, 'Ocean_Freight_Rate__c');
        
        return rate;
    }
    
    /**
     * @description Get ocean freight rate by ID for LWC (with field-level permissions)
     * @param rateId RMS rate ID
     * @return Map<String, Object> Rate record with filtered fields
     */
    @AuraEnabled
    public static Map<String, Object> getRateForLWC(String rateId) {
        try {
            HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates/' + rateId, 'GET', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> rate = (Map<String, Object>) response.get('data');
            
            if (rate == null) {
                throw new AuraHandledException('Ocean freight rate not found: ' + rateId);
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(rate, RMSPermissionService.ENTITY_RATE);
        } catch (Exception e) {
            throw new AuraHandledException('Error getting rate: ' + e.getMessage());
        }
    }
    
    /**
     * @description List ocean freight rates with optional filters
     * @param filters Map of filter parameters
     * @return List<Ocean_Freight_Rate__c> List of rates
     */
    public static List<Ocean_Freight_Rate__c> listRates(Map<String, Object> filters) {
        String endpoint = '/api/ocean-freight-rates';
        
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
        
        List<Ocean_Freight_Rate__c> rates = new List<Ocean_Freight_Rate__c>();
        List<Object> dataList = (List<Object>) response.get('data');
        
        for (Object item : dataList) {
            Map<String, Object> data = (Map<String, Object>) item;
            Ocean_Freight_Rate__c rate = (Ocean_Freight_Rate__c) RMSApiUtil.convertFromApiFormat(data, 'Ocean_Freight_Rate__c');
            rates.add(rate);
        }
        
        return rates;
    }
    
    /**
     * @description Delete ocean freight rate
     * @param rateId RMS rate ID
     * @return Boolean Success status
     */
    public static Boolean deleteRate(String rateId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates/' + rateId, 'DELETE', null);
        
        return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
    }
    
    /**
     * @description Search rates by route and container type
     * @param polCode Port of Loading code
     * @param podCode Port of Discharge code
     * @param containerType Container type
     * @return List<Ocean_Freight_Rate__c> Matching rates
     */
    public static List<Ocean_Freight_Rate__c> searchRates(String polCode, String podCode, String containerType) {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('pol_code', polCode);
        filters.put('pod_code', podCode);
        filters.put('container_type', containerType);
        
        return listRates(filters);
    }
    
    // ==========================================
    // @AuraEnabled METHODS FOR LWC
    // ==========================================
    
    /**
     * @description List ocean freight rates for LWC
     * @param filtersJson JSON string of filter parameters
     * @return List<Map<String, Object>> List of rates as maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listRatesForLWC(String filtersJson) {
        try {
            Map<String, Object> filters = filtersJson != null ? 
                (Map<String, Object>) JSON.deserializeUntyped(filtersJson) : 
                new Map<String, Object>();
            
            String endpoint = '/api/ocean-freight-rates';
            
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
            
            List<Map<String, Object>> rates = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    rates.add((Map<String, Object>) item);
                }
            }
            
            // Filter fields based on field-level permissions (e.g., buy_amount is secret for sales users)
            return RMSPermissionService.filterRecordsByPermission(rates, RMSPermissionService.ENTITY_RATE);
        } catch (Exception e) {
            throw new AuraHandledException('Error listing rates: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create ocean freight rate for LWC
     * @param rateData Map of rate fields
     * @return Map<String, Object> Created rate
     */
    @AuraEnabled
    public static Map<String, Object> createRateForLWC(Map<String, Object> rateData) {
        try {
            // Check create permission - only pricing users can create rates
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_RATE, RMSPermissionService.PERMISSION_CREATE);
            
            // Ensure tenant_id is included (RLS enforcement)
            rateData = RMSApiUtil.addTenantToPayload(rateData);
            String body = JSON.serialize(rateData);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates', 'POST', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> createdRate = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(createdRate, RMSPermissionService.ENTITY_RATE);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating rate: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update ocean freight rate for LWC
     * @param rateId RMS rate ID
     * @param updates Map of fields to update
     * @return Map<String, Object> Updated rate
     */
    @AuraEnabled
    public static Map<String, Object> updateRateForLWC(String rateId, Map<String, Object> updates) {
        try {
            // Check edit permission - only pricing users can edit rates
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_RATE, RMSPermissionService.PERMISSION_EDIT);
            
            // Prevent tenant_id modification (RLS enforcement)
            updates.remove('tenant_id');
            
            // Note: API RLS will enforce tenant isolation on the backend
            // Additional verification can be added if needed by fetching the record first
            
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates/' + rateId, 'PUT', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> updatedRate = (Map<String, Object>) response.get('data');
            
            // Verify tenant access (RLS check)
            String rateTenantId = (String) updatedRate.get('tenant_id');
            String userTenantId = RMSApiUtil.getTenantId();
            if (String.isNotBlank(rateTenantId) && !rateTenantId.equals(userTenantId)) {
                throw new AuraHandledException('Access denied: This rate belongs to a different tenant.');
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(updatedRate, RMSPermissionService.ENTITY_RATE);
        } catch (Exception e) {
            throw new AuraHandledException('Error updating rate: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete ocean freight rate for LWC
     * @param rateId RMS rate ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteRateForLWC(String rateId) {
        try {
            // Check delete permission - only pricing users can delete rates
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_RATE, RMSPermissionService.PERMISSION_DELETE);
            
            // Note: API RLS will enforce tenant isolation on the backend
            // The API will reject deletion if the rate doesn't belong to the user's tenant
            HttpResponse res = RMSApiUtil.makeApiCall('/api/ocean-freight-rates/' + rateId, 'DELETE', null);
            
            if (res.getStatusCode() == 403 || res.getStatusCode() == 404) {
                // 403 = Forbidden (tenant mismatch), 404 = Not found (tenant mismatch)
                throw new AuraHandledException('Access denied: This rate belongs to a different tenant or does not exist.');
            }
            
            return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting rate: ' + e.getMessage());
        }
    }
    
    /**
     * @description Mark rate as preferred for LWC
     * @param rateId RMS rate ID
     * @param isPreferred Preferred status
     * @return Map<String, Object> Updated rate
     */
    @AuraEnabled
    public static Map<String, Object> markRateAsPreferred(String rateId, Boolean isPreferred) {
        try {
            // Check mark preferred permission - only pricing users can mark rates as preferred
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_RATE, RMSPermissionService.PERMISSION_MARK_PREFERRED);
            
            Map<String, Object> updates = new Map<String, Object>{
                'is_preferred' => isPreferred
            };
            return updateRateForLWC(rateId, updates);
        } catch (Exception e) {
            throw new AuraHandledException('Error marking rate as preferred: ' + e.getMessage());
        }
    }
    
    /**
     * @description Bulk create rates from CSV data
     * @param ratesList List of rate maps
     * @return List<Map<String, Object>> Results with created rates or errors
     */
    @AuraEnabled
    public static List<Map<String, Object>> bulkCreateRates(List<Map<String, Object>> ratesList) {
        try {
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            
            for (Map<String, Object> rateData : ratesList) {
                try {
                    Map<String, Object> created = createRateForLWC(rateData);
                    results.add(created);
                } catch (Exception e) {
                    Map<String, Object> errorResult = new Map<String, Object>();
                    errorResult.put('error', e.getMessage());
                    errorResult.put('data', rateData);
                    results.add(errorResult);
                }
            }
            
            return results;
        } catch (Exception e) {
            throw new AuraHandledException('Error in bulk create rates: ' + e.getMessage());
        }
    }
}

