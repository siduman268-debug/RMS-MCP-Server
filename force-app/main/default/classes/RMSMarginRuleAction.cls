/**
 * @description Custom Apex Action for Margin Rule operations
 * @author RMS Development Team
 * @date 2025-01-27
 */
public with sharing class RMSMarginRuleAction {
    
    /**
     * @description Get Margin Rules from RMS API
     * @param level Rule level (global, trade_zone, port_pair)
     * @param markKind Mark kind (pct, flat)
     * @return List of Margin Rule records
     */
    @InvocableMethod(label='Get Margin Rules' description='Retrieve margin rules from RMS API')
    public static List<MarginRuleResponse> getMarginRules(List<MarginRuleRequest> requests) {
        List<MarginRuleResponse> responses = new List<MarginRuleResponse>();
        
        for (MarginRuleRequest request : requests) {
            try {
                MarginRuleResponse response = new MarginRuleResponse();
                
                // Build query parameters
                Map<String, String> queryParams = new Map<String, String>();
                if (String.isNotBlank(request.level)) {
                    queryParams.put('level', request.level);
                }
                if (String.isNotBlank(request.markKind)) {
                    queryParams.put('mark_kind', request.markKind);
                }
                
                // Call RMS API
                String endpoint = RMSApiUtil.buildEndpoint('/api/margin-rules', queryParams);
                HttpResponse httpResponse = RMSApiUtil.makeGetRequest(endpoint);
                
                if (httpResponse.getStatusCode() == 200) {
                    response.isSuccess = true;
                    response.rules = parseMarginRules(httpResponse.getBody());
                    response.message = 'Successfully retrieved ' + response.rules.size() + ' rules';
                } else {
                    response.isSuccess = false;
                    response.message = 'API Error: ' + httpResponse.getStatusCode() + ' - ' + httpResponse.getBody();
                }
                
                responses.add(response);
                
            } catch (Exception e) {
                MarginRuleResponse errorResponse = new MarginRuleResponse();
                errorResponse.isSuccess = false;
                errorResponse.message = 'Error: ' + e.getMessage();
                responses.add(errorResponse);
            }
        }
        
        return responses;
    }
    
    // Helper methods for parsing API responses
    private static List<MarginRuleWrapper> parseMarginRules(String jsonResponse) {
        List<MarginRuleWrapper> rules = new List<MarginRuleWrapper>();
        try {
            Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(jsonResponse);
            List<Object> dataList = (List<Object>) responseMap.get('data');
            
            if (dataList != null) {
                for (Object data : dataList) {
                    Map<String, Object> ruleData = (Map<String, Object>) data;
                    MarginRuleWrapper rule = new MarginRuleWrapper();
                    rule.id = (String) ruleData.get('id');
                    rule.level = (String) ruleData.get('level');
                    rule.markKind = (String) ruleData.get('mark_kind');
                    rule.markValue = (Decimal) ruleData.get('mark_value');
                    rule.polCode = (String) ruleData.get('pol_code');
                    rule.podCode = (String) ruleData.get('pod_code');
                    rule.priority = (Integer) ruleData.get('priority');
                    rule.validFrom = (String) ruleData.get('valid_from');
                    rule.validTo = (String) ruleData.get('valid_to');
                    rules.add(rule);
                }
            }
        } catch (Exception e) {
            System.debug('Error parsing margin rules: ' + e.getMessage());
        }
        return rules;
    }
    
    // Input/Output classes for Flow integration
    
    public class MarginRuleRequest {
        @InvocableVariable(label='Level' description='Rule level (global, trade_zone, port_pair)')
        public String level;
        
        @InvocableVariable(label='Mark Kind' description='Mark kind (pct, flat)')
        public String markKind;
    }
    
    public class MarginRuleResponse {
        @InvocableVariable(label='Success' description='Whether the operation was successful')
        public Boolean isSuccess;
        
        @InvocableVariable(label='Message' description='Response message')
        public String message;
        
        @InvocableVariable(label='Rules' description='List of margin rules')
        public List<MarginRuleWrapper> rules;
    }
    
    // Wrapper classes for data transfer
    public class MarginRuleWrapper {
        public String id;
        public String level;
        public String markKind;
        public Decimal markValue;
        public String polCode;
        public String podCode;
        public Integer priority;
        public String validFrom;
        public String validTo;
    }
}
