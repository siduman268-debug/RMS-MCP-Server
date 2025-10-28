/**
 * @description Custom Apex Action for Ocean Freight Rate operations
 * @author RMS Development Team
 * @date 2025-01-27
 */
public with sharing class RMSOceanFreightRateAction {
    
    /**
     * @description Get Ocean Freight Rates from RMS API
     * @param polCode Port of Loading code
     * @param podCode Port of Discharge code
     * @param containerType Container type (20GP, 40GP, 40HC, etc.)
     * @param contractId Contract ID (optional)
     * @return List of Ocean Freight Rate records
     */
    @InvocableMethod(label='Get Ocean Freight Rates' description='Retrieve ocean freight rates from RMS API')
    public static List<OceanFreightRateResponse> getOceanFreightRates(List<OceanFreightRateRequest> requests) {
        List<OceanFreightRateResponse> responses = new List<OceanFreightRateResponse>();
        
        for (OceanFreightRateRequest request : requests) {
            try {
                OceanFreightRateResponse response = new OceanFreightRateResponse();
                
                // Build query parameters
                Map<String, String> queryParams = new Map<String, String>();
                if (String.isNotBlank(request.polCode)) {
                    queryParams.put('pol_code', request.polCode);
                }
                if (String.isNotBlank(request.podCode)) {
                    queryParams.put('pod_code', request.podCode);
                }
                if (String.isNotBlank(request.containerType)) {
                    queryParams.put('container_type', request.containerType);
                }
                if (request.contractId != null) {
                    queryParams.put('contract_id', String.valueOf(request.contractId));
                }
                
                // Call RMS API
                String endpoint = RMSApiUtil.buildEndpoint('/api/ocean-freight-rates', queryParams);
                HttpResponse httpResponse = RMSApiUtil.makeGetRequest(endpoint);
                
                if (httpResponse.getStatusCode() == 200) {
                    response.isSuccess = true;
                    response.rates = parseOceanFreightRates(httpResponse.getBody());
                    response.message = 'Successfully retrieved ' + response.rates.size() + ' rates';
                } else {
                    response.isSuccess = false;
                    response.message = 'API Error: ' + httpResponse.getStatusCode() + ' - ' + httpResponse.getBody();
                }
                
                responses.add(response);
                
            } catch (Exception e) {
                OceanFreightRateResponse errorResponse = new OceanFreightRateResponse();
                errorResponse.isSuccess = false;
                errorResponse.message = 'Error: ' + e.getMessage();
                responses.add(errorResponse);
            }
        }
        
        return responses;
    }
    
    // Helper methods for parsing API responses
    private static List<OceanFreightRateWrapper> parseOceanFreightRates(String jsonResponse) {
        List<OceanFreightRateWrapper> rates = new List<OceanFreightRateWrapper>();
        try {
            Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(jsonResponse);
            List<Object> dataList = (List<Object>) responseMap.get('data');
            
            if (dataList != null) {
                for (Object data : dataList) {
                    Map<String, Object> rateData = (Map<String, Object>) data;
                    OceanFreightRateWrapper rate = new OceanFreightRateWrapper();
                    rate.id = (String) rateData.get('id');
                    rate.polCode = (String) rateData.get('pol_code');
                    rate.podCode = (String) rateData.get('pod_code');
                    rate.containerType = (String) rateData.get('container_type');
                    rate.buyAmount = (Decimal) rateData.get('buy_amount');
                    rate.currencyCode = (String) rateData.get('currency');
                    rate.ttDays = (Integer) rateData.get('tt_days');
                    rate.contractId = (Integer) rateData.get('contract_id');
                    rate.validFrom = (String) rateData.get('valid_from');
                    rate.validTo = (String) rateData.get('valid_to');
                    rates.add(rate);
                }
            }
        } catch (Exception e) {
            System.debug('Error parsing ocean freight rates: ' + e.getMessage());
        }
        return rates;
    }
    
    // Input/Output classes for Flow integration
    
    public class OceanFreightRateRequest {
        @InvocableVariable(label='POL Code' description='Port of Loading code' required=true)
        public String polCode;
        
        @InvocableVariable(label='POD Code' description='Port of Discharge code' required=true)
        public String podCode;
        
        @InvocableVariable(label='Container Type' description='Container type (20GP, 40GP, 40HC, etc.)' required=true)
        public String containerType;
        
        @InvocableVariable(label='Contract ID' description='Contract ID (optional)')
        public Integer contractId;
    }
    
    public class OceanFreightRateResponse {
        @InvocableVariable(label='Success' description='Whether the operation was successful')
        public Boolean isSuccess;
        
        @InvocableVariable(label='Message' description='Response message')
        public String message;
        
        @InvocableVariable(label='Rates' description='List of ocean freight rates')
        public List<OceanFreightRateWrapper> rates;
    }
    
    // Wrapper classes for data transfer
    public class OceanFreightRateWrapper {
        @InvocableVariable(label='Rate ID')
        public String id;
        
        @InvocableVariable(label='POL Code')
        public String polCode;
        
        @InvocableVariable(label='POD Code')
        public String podCode;
        
        @InvocableVariable(label='Container Type')
        public String containerType;
        
        @InvocableVariable(label='Buy Amount')
        public Decimal buyAmount;
        
        @InvocableVariable(label='Currency')
        public String currencyCode;
        
        @InvocableVariable(label='Transit Time (Days)')
        public Integer ttDays;
        
        @InvocableVariable(label='Contract ID')
        public Integer contractId;
        
        @InvocableVariable(label='Valid From')
        public String validFrom;
        
        @InvocableVariable(label='Valid To')
        public String validTo;
    }
}
