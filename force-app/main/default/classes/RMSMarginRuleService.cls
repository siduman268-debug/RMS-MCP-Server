public with sharing class RMSMarginRuleService {
    
    @AuraEnabled
    public static List<Map<String, Object>> listMarginRules(String scope) {
        try {
            String endpoint = '/api/margin-rules?limit=1000';
            
            if (String.isNotBlank(scope)) {
                endpoint += '&scope=' + EncodingUtil.urlEncode(scope, 'UTF-8');
            }
            
            HttpResponse res = RMSApiUtil.makeApiCall(endpoint, 'GET', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> rules = new List<Map<String, Object>>();
            if (response.containsKey('data')) {
                Object dataObj = response.get('data');
                if (dataObj instanceof List<Object>) {
                    for (Object item : (List<Object>) dataObj) {
                        if (item instanceof Map<String, Object>) {
                            rules.add((Map<String, Object>) item);
                        }
                    }
                }
            }
            
            return rules;
        } catch (Exception e) {
            throw new AuraHandledException('Error listing margin rules: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Object> getMarginRule(String ruleId) {
        try {
            HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'GET', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error getting margin rule: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Object> createMarginRule(Map<String, Object> ruleData) {
        try {
            HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules', 'POST', ruleData);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error creating margin rule: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Object> updateMarginRule(String ruleId, Map<String, Object> updates) {
        try {
            HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'PUT', updates);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error updating margin rule: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Boolean deleteMarginRule(String ruleId) {
        try {
            HttpResponse res = RMSApiUtil.makeApiCall('/api/margin-rules/' + ruleId, 'DELETE', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Boolean) response.get('success');
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting margin rule: ' + e.getMessage());
        }
    }
}

