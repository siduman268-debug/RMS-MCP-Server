/**
 * @description Service class for Margin Rule operations
 * @author RMS Team
 * @date 2025-01-27
 */
public class MarginRuleService {
    
    /**
     * @description Create a new margin rule
     * @param rule Margin_Rule__c record
     * @return Margin_Rule__c Created record
     */
    public static Margin_Rule__c createRule(Margin_Rule__c rule) {
        Map<String, Object> payload = RMSApiUtil.convertToApiFormat(rule, 'Margin_Rule__c');
        String body = JSON.serialize(payload);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules', 'POST', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Margin_Rule__c createdRule = (Margin_Rule__c) RMSApiUtil.convertFromApiFormat(data, 'Margin_Rule__c');
        
        return createdRule;
    }
    
    /**
     * @description Update an existing margin rule
     * @param ruleId RMS rule ID
     * @param updates Map of fields to update
     * @return Margin_Rule__c Updated record
     */
    public static Margin_Rule__c updateRule(String ruleId, Map<String, Object> updates) {
        String body = JSON.serialize(updates);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'PUT', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Margin_Rule__c updatedRule = (Margin_Rule__c) RMSApiUtil.convertFromApiFormat(data, 'Margin_Rule__c');
        
        return updatedRule;
    }
    
    /**
     * @description Get margin rule by ID
     * @param ruleId RMS rule ID
     * @return Margin_Rule__c Rule record
     */
    public static Margin_Rule__c getRule(String ruleId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'GET', null);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Margin_Rule__c rule = (Margin_Rule__c) RMSApiUtil.convertFromApiFormat(data, 'Margin_Rule__c');
        
        return rule;
    }
    
    /**
     * @description List margin rules with optional filters
     * @param filters Map of filter parameters
     * @return List<Margin_Rule__c> List of rules
     */
    public static List<Margin_Rule__c> listRules(Map<String, Object> filters) {
        String endpoint = '/api/margin-rules';
        
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
        
        List<Margin_Rule__c> rules = new List<Margin_Rule__c>();
        List<Object> dataList = (List<Object>) response.get('data');
        
        for (Object item : dataList) {
            Map<String, Object> data = (Map<String, Object>) item;
            Margin_Rule__c rule = (Margin_Rule__c) RMSApiUtil.convertFromApiFormat(data, 'Margin_Rule__c');
            rules.add(rule);
        }
        
        return rules;
    }
    
    /**
     * @description Delete margin rule
     * @param ruleId RMS rule ID
     * @return Boolean Success status
     */
    public static Boolean deleteRule(String ruleId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'DELETE', null);
        
        return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
    }
    
    /**
     * @description Get global margin rules
     * @return List<Margin_Rule__c> Global rules
     */
    public static List<Margin_Rule__c> getGlobalRules() {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('level', 'global');
        
        return listRules(filters);
    }
    
    /**
     * @description Get port pair margin rules
     * @param polCode Port of Loading code
     * @param podCode Port of Discharge code
     * @return List<Margin_Rule__c> Port pair rules
     */
    public static List<Margin_Rule__c> getPortPairRules(String polCode, String podCode) {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('level', 'port_pair');
        filters.put('pol_code', polCode);
        filters.put('pod_code', podCode);
        
        return listRules(filters);
    }
    
    // ==========================================
    // @AuraEnabled METHODS FOR LWC
    // ==========================================
    
    /**
     * @description List margin rules for LWC
     * @param filtersJson JSON string of filter parameters
     * @return List<Map<String, Object>> List of margin rules as maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listRulesForLWC(String filtersJson) {
        try {
            Map<String, Object> filters = filtersJson != null ? 
                (Map<String, Object>) JSON.deserializeUntyped(filtersJson) : 
                new Map<String, Object>();
            
            String endpoint = '/api/margin-rules';
            
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
            
            List<Map<String, Object>> rules = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    rules.add((Map<String, Object>) item);
                }
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterRecordsByPermission(rules, RMSPermissionService.ENTITY_MARGIN_RULE);
        } catch (Exception e) {
            throw new AuraHandledException('Error listing margin rules: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create margin rule for LWC
     * @param ruleData Map of rule fields
     * @return Map<String, Object> Created rule
     */
    @AuraEnabled
    public static Map<String, Object> createRuleForLWC(Map<String, Object> ruleData) {
        try {
            // Check create permission - only pricing users can create margin rules (not sales users)
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_MARGIN_RULE, RMSPermissionService.PERMISSION_CREATE);
            
            // Ensure tenant_id is included (RLS enforcement)
            ruleData = RMSApiUtil.addTenantToPayload(ruleData);
            String body = JSON.serialize(ruleData);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules', 'POST', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> createdRule = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(createdRule, RMSPermissionService.ENTITY_MARGIN_RULE);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating margin rule: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update margin rule for LWC
     * @param ruleId RMS rule ID
     * @param updates Map of fields to update
     * @return Map<String, Object> Updated rule
     */
    @AuraEnabled
    public static Map<String, Object> updateRuleForLWC(String ruleId, Map<String, Object> updates) {
        try {
            // Check edit permission - only pricing users can edit margin rules (not sales users)
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_MARGIN_RULE, RMSPermissionService.PERMISSION_EDIT);
            
            // Prevent tenant_id modification (RLS enforcement)
            updates.remove('tenant_id');
            
            // Note: API RLS will enforce tenant isolation on the backend
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'PUT', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> updatedRule = (Map<String, Object>) response.get('data');
            
            // Verify tenant access (RLS check)
            String ruleTenantId = (String) updatedRule.get('tenant_id');
            String userTenantId = RMSApiUtil.getTenantId();
            if (String.isNotBlank(ruleTenantId) && !ruleTenantId.equals(userTenantId)) {
                throw new AuraHandledException('Access denied: This margin rule belongs to a different tenant.');
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(updatedRule, RMSPermissionService.ENTITY_MARGIN_RULE);
        } catch (Exception e) {
            throw new AuraHandledException('Error updating margin rule: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete margin rule for LWC
     * @param ruleId RMS rule ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteRuleForLWC(String ruleId) {
        try {
            // Check delete permission - only pricing users can delete margin rules
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_MARGIN_RULE, RMSPermissionService.PERMISSION_DELETE);
            
            // Note: API RLS will enforce tenant isolation on the backend
            HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'DELETE', null);
            
            if (res.getStatusCode() == 403 || res.getStatusCode() == 404) {
                throw new AuraHandledException('Access denied: This margin rule belongs to a different tenant or does not exist.');
            }
            
            return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting margin rule: ' + e.getMessage());
        }
    }
    
    /**
     * @description Bulk create margin rules from CSV data
     * @param rulesList List of rule maps
     * @return List<Map<String, Object>> Results with created rules or errors
     */
    @AuraEnabled
    public static List<Map<String, Object>> bulkCreateRules(List<Map<String, Object>> rulesList) {
        try {
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            
            for (Map<String, Object> ruleData : rulesList) {
                try {
                    Map<String, Object> created = createRuleForLWC(ruleData);
                    results.add(created);
                } catch (Exception e) {
                    Map<String, Object> errorResult = new Map<String, Object>();
                    errorResult.put('error', e.getMessage());
                    errorResult.put('data', ruleData);
                    results.add(errorResult);
                }
            }
            
            return results;
        } catch (Exception e) {
            throw new AuraHandledException('Error in bulk create margin rules: ' + e.getMessage());
        }
    }
}

