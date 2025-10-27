/**
 * @description Utility class for RMS API integration
 * @author RMS Team
 * @date 2025-01-27
 */
public class RMSApiUtil {
    
    private static final String NAMED_CREDENTIAL = 'RMS_API';
    private static final String TENANT_ID = '00000000-0000-0000-0000-000000000001';
    
    /**
     * @description Get authentication token from RMS API
     * @return String JWT token
     */
    public static String getAuthToken() {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:' + NAMED_CREDENTIAL + '/api/auth/token');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody('{"tenant_id": "' + TENANT_ID + '"}');
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() == 200) {
            Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            return (String) response.get('token');
        } else {
            throw new RMSApiException('Failed to get auth token: ' + res.getBody());
        }
    }
    
    /**
     * @description Make authenticated API call to RMS
     * @param endpoint API endpoint
     * @param method HTTP method
     * @param body Request body (optional)
     * @return HttpResponse
     */
    public static HttpResponse makeApiCall(String endpoint, String method, String body) {
        String token = getAuthToken();
        
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:' + NAMED_CREDENTIAL + endpoint);
        req.setMethod(method);
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('x-tenant-id', TENANT_ID);
        req.setHeader('Content-Type', 'application/json');
        
        if (String.isNotBlank(body)) {
            req.setBody(body);
        }
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        return res;
    }
    
    /**
     * @description Parse API response and handle errors
     * @param res HttpResponse
     * @return Map<String, Object> Parsed response
     */
    public static Map<String, Object> parseResponse(HttpResponse res) {
        if (res.getStatusCode() >= 200 && res.getStatusCode() < 300) {
            return (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        } else {
            throw new RMSApiException('API call failed: ' + res.getStatusCode() + ' - ' + res.getBody());
        }
    }
    
    /**
     * @description Convert Salesforce record to RMS API format
     * @param record SObject record
     * @param objectType Object type (Ocean_Freight_Rate__c, Margin_Rule__c, Surcharge__c)
     * @return Map<String, Object> API payload
     */
    public static Map<String, Object> convertToApiFormat(SObject record, String objectType) {
        Map<String, Object> payload = new Map<String, Object>();
        
        switch on objectType {
            when 'Ocean_Freight_Rate__c' {
                Ocean_Freight_Rate__c rate = (Ocean_Freight_Rate__c) record;
                payload.put('contract_id', rate.Contract_ID__c);
                payload.put('pol_code', rate.POL_Code__c);
                payload.put('pod_code', rate.POD_Code__c);
                payload.put('container_type', rate.Container_Type__c);
                payload.put('buy_amount', rate.Buy_Amount__c);
                payload.put('currency', rate.Currency__c);
                payload.put('tt_days', rate.Transit_Days__c);
                payload.put('valid_from', rate.Valid_From__c?.format());
                payload.put('valid_to', rate.Valid_To__c?.format());
                payload.put('is_preferred', rate.Is_Preferred__c);
            }
            when 'Margin_Rule__c' {
                Margin_Rule__c rule = (Margin_Rule__c) record;
                payload.put('level', rule.Level__c);
                payload.put('pol_code', rule.POL_Code__c);
                payload.put('pod_code', rule.POD_Code__c);
                payload.put('mark_kind', rule.Mark_Kind__c);
                payload.put('mark_value', rule.Mark_Value__c);
                payload.put('priority', rule.Priority__c);
                payload.put('valid_from', rule.Valid_From__c?.format());
                payload.put('valid_to', rule.Valid_To__c?.format());
            }
            when 'Surcharge__c' {
                Surcharge__c surcharge = (Surcharge__c) record;
                payload.put('vendor_id', surcharge.Vendor_ID__c);
                payload.put('contract_id', surcharge.Contract_ID__c);
                payload.put('charge_code', surcharge.Charge_Code__c);
                payload.put('amount', surcharge.Amount__c);
                payload.put('currency', surcharge.Currency__c);
                payload.put('uom', surcharge.UOM__c);
                payload.put('calc_method', surcharge.Calc_Method__c);
                payload.put('applies_scope', surcharge.Applies_Scope__c);
                payload.put('pol_code', surcharge.POL_Code__c);
                payload.put('pod_code', surcharge.POD_Code__c);
                payload.put('container_type', surcharge.Container_Type__c);
                payload.put('valid_from', surcharge.Valid_From__c?.format());
                payload.put('valid_to', surcharge.Valid_To__c?.format());
            }
        }
        
        return payload;
    }
    
    /**
     * @description Convert RMS API response to Salesforce record
     * @param apiData API response data
     * @param objectType Object type
     * @return SObject Salesforce record
     */
    public static SObject convertFromApiFormat(Map<String, Object> apiData, String objectType) {
        SObject record;
        
        switch on objectType {
            when 'Ocean_Freight_Rate__c' {
                Ocean_Freight_Rate__c rate = new Ocean_Freight_Rate__c();
                rate.RMS_ID__c = String.valueOf(apiData.get('id'));
                rate.Contract_ID__c = (Decimal) apiData.get('contract_id');
                rate.POL_Code__c = (String) apiData.get('pol_code');
                rate.POD_Code__c = (String) apiData.get('pod_code');
                rate.Container_Type__c = (String) apiData.get('container_type');
                rate.Buy_Amount__c = (Decimal) apiData.get('buy_amount');
                rate.Currency__c = (String) apiData.get('currency');
                rate.Transit_Days__c = (Decimal) apiData.get('tt_days');
                rate.Valid_From__c = Date.valueOf((String) apiData.get('valid_from'));
                rate.Valid_To__c = Date.valueOf((String) apiData.get('valid_to'));
                rate.Is_Preferred__c = (Boolean) apiData.get('is_preferred');
                rate.Tenant_ID__c = TENANT_ID;
                record = rate;
            }
            when 'Margin_Rule__c' {
                Margin_Rule__c rule = new Margin_Rule__c();
                rule.RMS_ID__c = String.valueOf(apiData.get('id'));
                rule.Level__c = (String) apiData.get('level');
                rule.POL_Code__c = (String) apiData.get('pol_code');
                rule.POD_Code__c = (String) apiData.get('pod_code');
                rule.Mark_Kind__c = (String) apiData.get('mark_kind');
                rule.Mark_Value__c = (Decimal) apiData.get('mark_value');
                rule.Priority__c = (Decimal) apiData.get('priority');
                rule.Valid_From__c = Date.valueOf((String) apiData.get('valid_from'));
                rule.Valid_To__c = Date.valueOf((String) apiData.get('valid_to'));
                rule.Tenant_ID__c = TENANT_ID;
                record = rule;
            }
            when 'Surcharge__c' {
                Surcharge__c surcharge = new Surcharge__c();
                surcharge.RMS_ID__c = String.valueOf(apiData.get('id'));
                surcharge.Vendor_ID__c = (Decimal) apiData.get('vendor_id');
                surcharge.Contract_ID__c = (Decimal) apiData.get('contract_id');
                surcharge.Charge_Code__c = (String) apiData.get('charge_code');
                surcharge.Amount__c = (Decimal) apiData.get('amount');
                surcharge.Currency__c = (String) apiData.get('currency');
                surcharge.UOM__c = (String) apiData.get('uom');
                surcharge.Calc_Method__c = (String) apiData.get('calc_method');
                surcharge.Applies_Scope__c = (String) apiData.get('applies_scope');
                surcharge.POL_Code__c = (String) apiData.get('pol_code');
                surcharge.POD_Code__c = (String) apiData.get('pod_code');
                surcharge.Container_Type__c = (String) apiData.get('container_type');
                surcharge.Valid_From__c = Date.valueOf((String) apiData.get('valid_from'));
                surcharge.Valid_To__c = Date.valueOf((String) apiData.get('valid_to'));
                surcharge.Is_Active__c = (Boolean) apiData.get('is_active');
                surcharge.Tenant_ID__c = TENANT_ID;
                record = surcharge;
            }
        }
        
        return record;
    }
    
    /**
     * @description Custom exception for RMS API errors
     */
    public class RMSApiException extends Exception {}
}
