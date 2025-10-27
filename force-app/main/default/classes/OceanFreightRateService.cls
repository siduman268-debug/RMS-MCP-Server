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
}
