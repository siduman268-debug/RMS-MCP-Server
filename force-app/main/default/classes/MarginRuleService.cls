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
}

