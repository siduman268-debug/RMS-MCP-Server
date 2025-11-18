public with sharing class RMSSurchargeService {
    
    @AuraEnabled
    public static List<Map<String, Object>> listSurcharges(
        Decimal vendorId,
        Decimal contractId,
        String polCode,
        String podCode,
        String containerType,
        String appliesScope
    ) {
        try {
            String endpoint = '/api/surcharges?limit=1000';
            
            if (vendorId != null) {
                endpoint += '&vendor_id=' + String.valueOf(vendorId);
            }
            if (contractId != null) {
                endpoint += '&contract_id=' + String.valueOf(contractId);
            }
            if (String.isNotBlank(polCode)) {
                endpoint += '&pol_code=' + EncodingUtil.urlEncode(polCode, 'UTF-8');
            }
            if (String.isNotBlank(podCode)) {
                endpoint += '&pod_code=' + EncodingUtil.urlEncode(podCode, 'UTF-8');
            }
            if (String.isNotBlank(containerType)) {
                endpoint += '&container_type=' + EncodingUtil.urlEncode(containerType, 'UTF-8');
            }
            if (String.isNotBlank(appliesScope)) {
                endpoint += '&applies_scope=' + EncodingUtil.urlEncode(appliesScope, 'UTF-8');
            }
            
            HttpResponse res = RMSApiUtil.makeApiCall(endpoint, 'GET', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> surcharges = new List<Map<String, Object>>();
            if (response.containsKey('data')) {
                Object dataObj = response.get('data');
                if (dataObj instanceof List<Object>) {
                    for (Object item : (List<Object>) dataObj) {
                        if (item instanceof Map<String, Object>) {
                            surcharges.add((Map<String, Object>) item);
                        }
                    }
                }
            }
            
            return surcharges;
        } catch (Exception e) {
            throw new AuraHandledException('Error listing surcharges: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Object> getSurcharge(String surchargeId) {
        try {
            HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'GET', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error getting surcharge: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Object> createSurcharge(Map<String, Object> surchargeData) {
        try {
            String body = JSON.serialize(surchargeData);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges', 'POST', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error creating surcharge: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Object> updateSurcharge(String surchargeId, Map<String, Object> updates) {
        try {
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'PUT', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Map<String, Object>) response.get('data');
        } catch (Exception e) {
            throw new AuraHandledException('Error updating surcharge: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Boolean deleteSurcharge(String surchargeId) {
        try {
            HttpResponse res = RMSApiUtil.makeApiCall('/api/surcharges/' + surchargeId, 'DELETE', null);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            return (Boolean) response.get('success');
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting surcharge: ' + e.getMessage());
        }
    }
}

