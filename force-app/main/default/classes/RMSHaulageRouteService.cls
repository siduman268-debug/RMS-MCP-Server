/**
 * @description Service class for Haulage Route operations via RMS API
 * @author RMS Team
 * @date 2025-01-20
 */
public class RMSHaulageRouteService {
    
    /**
     * @description List all haulage routes with optional filtering
     * @param fromLocation Filter by from location code
     * @param toLocation Filter by to location code
     * @param primaryMode Filter by primary transport mode
     * @param isActive Filter by active status
     * @return List of haulage route maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listHaulageRoutes(String fromLocation, String toLocation, String primaryMode, Boolean isActive) {
        try {
            String endpoint = '/api/haulage-routes';
            Map<String, String> queryParams = new Map<String, String>();
            
            if (String.isNotBlank(fromLocation)) {
                queryParams.put('from_location', fromLocation);
            }
            if (String.isNotBlank(toLocation)) {
                queryParams.put('to_location', toLocation);
            }
            if (String.isNotBlank(primaryMode)) {
                queryParams.put('primary_mode', primaryMode);
            }
            if (isActive != null) {
                queryParams.put('is_active', String.valueOf(isActive));
            }
            
            String fullEndpoint = RMSApiUtil.buildEndpoint(endpoint, queryParams);
            HttpResponse res = RMSApiUtil.makeGetRequest(fullEndpoint);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> routes = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    routes.add((Map<String, Object>) item);
                }
            }
            
            return routes;
        } catch (Exception e) {
            throw new AuraHandledException('Error listing haulage routes: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get haulage route by ID
     * @param routeId Route ID
     * @return Haulage route map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getHaulageRoute(Decimal routeId) {
        try {
            HttpResponse res = RMSApiUtil.makeGetRequest('/api/haulage-routes/' + routeId);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error getting haulage route: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create a new haulage route
     * @param routeData Map of route fields
     * @return Created route map
     */
    @AuraEnabled
    public static Map<String, Object> createHaulageRoute(Map<String, Object> routeData) {
        try {
            routeData = RMSApiUtil.addTenantToPayload(routeData);
            String body = JSON.serialize(routeData);
            HttpResponse res = RMSApiUtil.makePostRequest('/api/haulage-routes', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error creating haulage route: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update an existing haulage route
     * @param routeId Route ID
     * @param updates Map of fields to update
     * @return Updated route map
     */
    @AuraEnabled
    public static Map<String, Object> updateHaulageRoute(Decimal routeId, Map<String, Object> updates) {
        try {
            updates.remove('tenant_id');
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makePutRequest('/api/haulage-routes/' + routeId, body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error updating haulage route: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a haulage route
     * @param routeId Route ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteHaulageRoute(Decimal routeId) {
        try {
            HttpResponse res = RMSApiUtil.makeDeleteRequest('/api/haulage-routes/' + routeId);
            Integer statusCode = res.getStatusCode();
            
            if (statusCode >= 200 && statusCode < 300) {
                return true;
            } else {
                String responseBody = res.getBody();
                throw new AuraHandledException('API returned status ' + statusCode + ': ' + responseBody);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting haulage route: ' + e.getMessage());
        }
    }
}

