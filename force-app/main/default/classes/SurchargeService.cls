/**
 * @description Service class for Surcharge operations
 * @author RMS Team
 * @date 2025-01-27
 */
public class SurchargeService {
    
    /**
     * @description Create a new surcharge
     * @param surcharge Surcharge__c record
     * @return Surcharge__c Created record
     */
    public static Surcharge__c createSurcharge(Surcharge__c surcharge) {
        Map<String, Object> payload = RMSApiUtil.convertToApiFormat(surcharge, 'Surcharge__c');
        String body = JSON.serialize(payload);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges', 'POST', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Surcharge__c createdSurcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
        
        return createdSurcharge;
    }
    
    /**
     * @description Update an existing surcharge
     * @param surchargeId RMS surcharge ID
     * @param updates Map of fields to update
     * @return Surcharge__c Updated record
     */
    public static Surcharge__c updateSurcharge(String surchargeId, Map<String, Object> updates) {
        String body = JSON.serialize(updates);
        
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'PUT', body);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Surcharge__c updatedSurcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
        
        return updatedSurcharge;
    }
    
    /**
     * @description Get surcharge by ID
     * @param surchargeId RMS surcharge ID
     * @return Surcharge__c Surcharge record
     */
    public static Surcharge__c getSurcharge(String surchargeId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'GET', null);
        Map<String, Object> response = RMSApiUtil.parseResponse(res);
        
        Map<String, Object> data = (Map<String, Object>) response.get('data');
        Surcharge__c surcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
        
        return surcharge;
    }
    
    /**
     * @description List surcharges with optional filters
     * @param filters Map of filter parameters
     * @return List<Surcharge__c> List of surcharges
     */
    public static List<Surcharge__c> listSurcharges(Map<String, Object> filters) {
        String endpoint = '/api/surcharges';
        
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
        
        List<Surcharge__c> surcharges = new List<Surcharge__c>();
        List<Object> dataList = (List<Object>) response.get('data');
        
        for (Object item : dataList) {
            Map<String, Object> data = (Map<String, Object>) item;
            Surcharge__c surcharge = (Surcharge__c) RMSApiUtil.convertFromApiFormat(data, 'Surcharge__c');
            surcharges.add(surcharge);
        }
        
        return surcharges;
    }
    
    /**
     * @description Delete surcharge
     * @param surchargeId RMS surcharge ID
     * @return Boolean Success status
     */
    public static Boolean deleteSurcharge(String surchargeId) {
        HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'DELETE', null);
        
        return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
    }
    
    /**
     * @description Get surcharges by charge code
     * @param chargeCode Charge code (THC, BAF, etc.)
     * @return List<Surcharge__c> Matching surcharges
     */
    public static List<Surcharge__c> getSurchargesByCode(String chargeCode) {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('charge_code', chargeCode);
        
        return listSurcharges(filters);
    }
    
    /**
     * @description Get surcharges by applies scope
     * @param appliesScope Scope (origin, port, freight, dest, door, other)
     * @return List<Surcharge__c> Matching surcharges
     */
    public static List<Surcharge__c> getSurchargesByScope(String appliesScope) {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('applies_scope', appliesScope);
        
        return listSurcharges(filters);
    }
    
    /**
     * @description Get active surcharges
     * @return List<Surcharge__c> Active surcharges
     */
    public static List<Surcharge__c> getActiveSurcharges() {
        Map<String, Object> filters = new Map<String, Object>();
        filters.put('is_active', true);
        
        return listSurcharges(filters);
    }
}
