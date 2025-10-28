/**
 * @description Custom Apex Action for Surcharge operations
 * @author RMS Development Team
 * @date 2025-01-27
 */
public with sharing class RMSSurchargeAction {
    
    /**
     * @description Get Surcharges from RMS API
     * @param chargeCode Charge code (optional)
     * @param appliesScope Applies scope (origin, port, freight, dest, door, other)
     * @return List of Surcharge records
     */
    @InvocableMethod(label='Get Surcharges' description='Retrieve surcharges from RMS API')
    public static List<SurchargeResponse> getSurcharges(List<SurchargeRequest> requests) {
        List<SurchargeResponse> responses = new List<SurchargeResponse>();
        
        for (SurchargeRequest request : requests) {
            try {
                SurchargeResponse response = new SurchargeResponse();
                
                // Build query parameters
                Map<String, String> queryParams = new Map<String, String>();
                if (String.isNotBlank(request.chargeCode)) {
                    queryParams.put('charge_code', request.chargeCode);
                }
                if (String.isNotBlank(request.appliesScope)) {
                    queryParams.put('applies_scope', request.appliesScope);
                }
                
                // Call RMS API
                String endpoint = RMSApiUtil.buildEndpoint('/api/surcharges', queryParams);
                HttpResponse httpResponse = RMSApiUtil.makeGetRequest(endpoint);
                
                if (httpResponse.getStatusCode() == 200) {
                    response.isSuccess = true;
                    response.surcharges = parseSurcharges(httpResponse.getBody());
                    response.message = 'Successfully retrieved ' + response.surcharges.size() + ' surcharges';
                } else {
                    response.isSuccess = false;
                    response.message = 'API Error: ' + httpResponse.getStatusCode() + ' - ' + httpResponse.getBody();
                }
                
                responses.add(response);
                
            } catch (Exception e) {
                SurchargeResponse errorResponse = new SurchargeResponse();
                errorResponse.isSuccess = false;
                errorResponse.message = 'Error: ' + e.getMessage();
                responses.add(errorResponse);
            }
        }
        
        return responses;
    }
    
    // Helper methods for parsing API responses
    private static List<SurchargeWrapper> parseSurcharges(String jsonResponse) {
        List<SurchargeWrapper> surcharges = new List<SurchargeWrapper>();
        try {
            Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(jsonResponse);
            List<Object> dataList = (List<Object>) responseMap.get('data');
            
            if (dataList != null) {
                for (Object data : dataList) {
                    Map<String, Object> surchargeData = (Map<String, Object>) data;
                    SurchargeWrapper surcharge = new SurchargeWrapper();
                    surcharge.id = (String) surchargeData.get('id');
                    surcharge.chargeCode = (String) surchargeData.get('charge_code');
                    surcharge.amount = (Decimal) surchargeData.get('amount');
                    surcharge.currencyCode = (String) surchargeData.get('currency');
                    surcharge.appliesScope = (String) surchargeData.get('applies_scope');
                    surcharge.uom = (String) surchargeData.get('uom');
                    surcharge.calcMethod = (String) surchargeData.get('calc_method');
                    surcharge.polCode = (String) surchargeData.get('pol_code');
                    surcharge.podCode = (String) surchargeData.get('pod_code');
                    surcharge.containerType = (String) surchargeData.get('container_type');
                    surcharge.validFrom = (String) surchargeData.get('valid_from');
                    surcharge.validTo = (String) surchargeData.get('valid_to');
                    surcharges.add(surcharge);
                }
            }
        } catch (Exception e) {
            System.debug('Error parsing surcharges: ' + e.getMessage());
        }
        return surcharges;
    }
    
    // Input/Output classes for Flow integration
    
    public class SurchargeRequest {
        @InvocableVariable(label='Charge Code' description='Charge code (optional)')
        public String chargeCode;
        
        @InvocableVariable(label='Applies Scope' description='Applies scope (origin, port, freight, dest, door, other)')
        public String appliesScope;
    }
    
    public class SurchargeResponse {
        @InvocableVariable(label='Success' description='Whether the operation was successful')
        public Boolean isSuccess;
        
        @InvocableVariable(label='Message' description='Response message')
        public String message;
        
        @InvocableVariable(label='Surcharges' description='List of surcharges')
        public List<SurchargeWrapper> surcharges;
    }
    
    // Wrapper classes for data transfer
    public class SurchargeWrapper {
        public String id;
        public String chargeCode;
        public Decimal amount;
        public String currencyCode;
        public String appliesScope;
        public String uom;
        public String calcMethod;
        public String polCode;
        public String podCode;
        public String containerType;
        public String validFrom;
        public String validTo;
    }
}
