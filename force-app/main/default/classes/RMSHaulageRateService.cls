/**
 * @description Service class for Haulage Rate operations via RMS API
 * @author RMS Team
 * @date 2025-01-20
 */
public class RMSHaulageRateService {
    
    /**
     * @description List all haulage rates with optional filtering
     * @param vendorId Filter by vendor ID
     * @param routeId Filter by route ID
     * @param transportMode Filter by transport mode
     * @param containerType Filter by container type
     * @param isActive Filter by active status
     * @return List of haulage rate maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listHaulageRates(Decimal vendorId, Decimal routeId, String transportMode, String containerType, Boolean isActive) {
        try {
            String endpoint = '/api/haulage-rates';
            Map<String, String> queryParams = new Map<String, String>();
            
            if (vendorId != null) {
                queryParams.put('vendor_id', String.valueOf(vendorId));
            }
            if (routeId != null) {
                queryParams.put('route_id', String.valueOf(routeId));
            }
            if (String.isNotBlank(transportMode)) {
                queryParams.put('transport_mode', transportMode);
            }
            if (String.isNotBlank(containerType)) {
                queryParams.put('container_type', containerType);
            }
            if (isActive != null) {
                queryParams.put('is_active', String.valueOf(isActive));
            }
            
            String fullEndpoint = RMSApiUtil.buildEndpoint(endpoint, queryParams);
            HttpResponse res = RMSApiUtil.makeGetRequest(fullEndpoint);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> rates = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    rates.add((Map<String, Object>) item);
                }
            }
            
            return rates;
        } catch (Exception e) {
            throw new AuraHandledException('Error listing haulage rates: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get haulage rate by ID
     * @param rateId Rate ID
     * @return Haulage rate map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getHaulageRate(Decimal rateId) {
        try {
            HttpResponse res = RMSApiUtil.makeGetRequest('/api/haulage-rates/' + rateId);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error getting haulage rate: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create a new haulage rate
     * @param rateData Map of rate fields
     * @return Created rate map
     */
    @AuraEnabled
    public static Map<String, Object> createHaulageRate(Map<String, Object> rateData) {
        try {
            rateData = RMSApiUtil.addTenantToPayload(rateData);
            String body = JSON.serialize(rateData);
            HttpResponse res = RMSApiUtil.makePostRequest('/api/haulage-rates', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error creating haulage rate: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update an existing haulage rate
     * @param rateId Rate ID
     * @param updates Map of fields to update
     * @return Updated rate map
     */
    @AuraEnabled
    public static Map<String, Object> updateHaulageRate(Decimal rateId, Map<String, Object> updates) {
        try {
            updates.remove('tenant_id');
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makePutRequest('/api/haulage-rates/' + rateId, body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error updating haulage rate: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a haulage rate
     * @param rateId Rate ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteHaulageRate(Decimal rateId) {
        try {
            HttpResponse res = RMSApiUtil.makeDeleteRequest('/api/haulage-rates/' + rateId);
            Integer statusCode = res.getStatusCode();
            
            if (statusCode >= 200 && statusCode < 300) {
                return true;
            } else {
                String responseBody = res.getBody();
                throw new AuraHandledException('API returned status ' + statusCode + ': ' + responseBody);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting haulage rate: ' + e.getMessage());
        }
    }
}

