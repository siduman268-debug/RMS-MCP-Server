/**
 * @description Service class for Haulage Leg operations via RMS API
 * @author RMS Team
 * @date 2025-01-20
 */
public class RMSHaulageLegService {
    
    /**
     * @description List all haulage legs with optional filtering
     * @param routeId Filter by route ID
     * @return List of haulage leg maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listHaulageLegs(Decimal routeId) {
        try {
            String endpoint = '/api/haulage-legs';
            Map<String, String> queryParams = new Map<String, String>();
            
            if (routeId != null) {
                queryParams.put('route_id', String.valueOf(routeId));
            }
            
            String fullEndpoint = RMSApiUtil.buildEndpoint(endpoint, queryParams);
            HttpResponse res = RMSApiUtil.makeGetRequest(fullEndpoint);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> legs = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    legs.add((Map<String, Object>) item);
                }
            }
            
            return legs;
        } catch (Exception e) {
            throw new AuraHandledException('Error listing haulage legs: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get haulage leg by ID
     * @param legId Leg ID
     * @return Haulage leg map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getHaulageLeg(Decimal legId) {
        try {
            HttpResponse res = RMSApiUtil.makeGetRequest('/api/haulage-legs/' + legId);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error getting haulage leg: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create a new haulage leg
     * @param legData Map of leg fields
     * @return Created leg map
     */
    @AuraEnabled
    public static Map<String, Object> createHaulageLeg(Map<String, Object> legData) {
        try {
            legData = RMSApiUtil.addTenantToPayload(legData);
            String body = JSON.serialize(legData);
            HttpResponse res = RMSApiUtil.makePostRequest('/api/haulage-legs', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error creating haulage leg: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update an existing haulage leg
     * @param legId Leg ID
     * @param updates Map of fields to update
     * @return Updated leg map
     */
    @AuraEnabled
    public static Map<String, Object> updateHaulageLeg(Decimal legId, Map<String, Object> updates) {
        try {
            updates.remove('tenant_id');
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makePutRequest('/api/haulage-legs/' + legId, body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error updating haulage leg: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a haulage leg
     * @param legId Leg ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteHaulageLeg(Decimal legId) {
        try {
            HttpResponse res = RMSApiUtil.makeDeleteRequest('/api/haulage-legs/' + legId);
            Integer statusCode = res.getStatusCode();
            
            if (statusCode >= 200 && statusCode < 300) {
                return true;
            } else {
                String responseBody = res.getBody();
                throw new AuraHandledException('API returned status ' + statusCode + ': ' + responseBody);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting haulage leg: ' + e.getMessage());
        }
    }
}

