/**
 * @description Service class for Haulage Responsibility operations via RMS API
 * @author RMS Team
 * @date 2025-01-20
 */
public class RMSHaulageResponsibilityService {
    
    /**
     * @description List all haulage responsibilities with optional filtering
     * @param termCategory Filter by term category (INCOTERM, CUSTOM, STANDARD)
     * @param isActive Filter by active status
     * @return List of haulage responsibility maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listHaulageResponsibilities(String termCategory, Boolean isActive) {
        try {
            String endpoint = '/api/haulage-responsibilities';
            Map<String, String> queryParams = new Map<String, String>();
            
            if (String.isNotBlank(termCategory)) {
                queryParams.put('term_category', termCategory);
            }
            if (isActive != null) {
                queryParams.put('is_active', String.valueOf(isActive));
            }
            
            String fullEndpoint = RMSApiUtil.buildEndpoint(endpoint, queryParams);
            HttpResponse res = RMSApiUtil.makeGetRequest(fullEndpoint);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> responsibilities = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    responsibilities.add((Map<String, Object>) item);
                }
            }
            
            return responsibilities;
        } catch (Exception e) {
            throw new AuraHandledException('Error listing haulage responsibilities: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get haulage responsibility by ID
     * @param respId Responsibility ID
     * @return Haulage responsibility map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getHaulageResponsibility(Decimal respId) {
        try {
            HttpResponse res = RMSApiUtil.makeGetRequest('/api/haulage-responsibilities/' + respId);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error getting haulage responsibility: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create a new haulage responsibility
     * @param respData Map of responsibility fields
     * @return Created responsibility map
     */
    @AuraEnabled
    public static Map<String, Object> createHaulageResponsibility(Map<String, Object> respData) {
        try {
            String body = JSON.serialize(respData);
            HttpResponse res = RMSApiUtil.makePostRequest('/api/haulage-responsibilities', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error creating haulage responsibility: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update an existing haulage responsibility
     * @param respId Responsibility ID
     * @param updates Map of fields to update
     * @return Updated responsibility map
     */
    @AuraEnabled
    public static Map<String, Object> updateHaulageResponsibility(Decimal respId, Map<String, Object> updates) {
        try {
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makePutRequest('/api/haulage-responsibilities/' + respId, body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error updating haulage responsibility: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a haulage responsibility
     * @param respId Responsibility ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteHaulageResponsibility(Decimal respId) {
        try {
            HttpResponse res = RMSApiUtil.makeDeleteRequest('/api/haulage-responsibilities/' + respId);
            Integer statusCode = res.getStatusCode();
            
            if (statusCode >= 200 && statusCode < 300) {
                return true;
            } else {
                String responseBody = res.getBody();
                throw new AuraHandledException('API returned status ' + statusCode + ': ' + responseBody);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting haulage responsibility: ' + e.getMessage());
        }
    }
}

