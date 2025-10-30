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
                String endpoint = '/api/search-rates';
                String requestBody = JSON.serialize(new Map<String, Object>{
                    'pol_code' => request.polCode,
                    'pod_code' => request.podCode,
                    'container_type' => request.containerType,
                    'contract_id' => request.contractId
                });
                HttpResponse httpResponse = RMSApiUtil.makePostRequest(endpoint, requestBody);
                
                if (httpResponse.getStatusCode() == 200) {
                    response.isSuccess = true;
                    List<OceanFreightRateWrapper> ratesList = parseOceanFreightRates(httpResponse.getBody());
                    response.rates = JSON.serialize(ratesList);
                    response.message = 'Successfully retrieved ' + ratesList.size() + ' rates';
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
    // Maps materialized view response fields to wrapper fields
    private static List<OceanFreightRateWrapper> parseOceanFreightRates(String jsonResponse) {
        List<OceanFreightRateWrapper> rates = new List<OceanFreightRateWrapper>();
        try {
            Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(jsonResponse);
            List<Object> dataList = (List<Object>) responseMap.get('data');
            
            if (dataList != null) {
                for (Object data : dataList) {
                    Map<String, Object> rateData = (Map<String, Object>) data;
                    OceanFreightRateWrapper rate = new OceanFreightRateWrapper();
                    
                    // Map API response fields (from materialized view) to wrapper fields
                    // API returns: rate_id, ocean_freight_buy, transit_days, etc.
                    Object rateIdObj = rateData.get('rate_id');
                    rate.id = rateIdObj != null ? String.valueOf(rateIdObj) : null;
                    
                    rate.polCode = (String) rateData.get('pol_code');
                    rate.podCode = (String) rateData.get('pod_code');
                    rate.containerType = (String) rateData.get('container_type');
                    
                    // Get pricing from nested pricing object
                    Map<String, Object> pricing = (Map<String, Object>) rateData.get('pricing');
                    if (pricing != null) {
                        Object buyAmountObj = pricing.get('ocean_freight_buy');
                        rate.buyAmount = buyAmountObj != null ? (Decimal) Double.valueOf(buyAmountObj) : null;
                        rate.currencyCode = (String) pricing.get('currency');
                    }
                    
                    // transit_days from materialized view
                    Object ttDaysObj = rateData.get('transit_days');
                    rate.ttDays = ttDaysObj != null ? Integer.valueOf(ttDaysObj) : null;
                    
                    // contract_id might not be in materialized view, check both field names
                    Object contractIdObj = rateData.get('contract_id');
                    if (contractIdObj == null) {
                        contractIdObj = rateData.get('contractId'); // Try camelCase
                    }
                    rate.contractId = contractIdObj != null ? Integer.valueOf(contractIdObj) : null;
                    
                    // Get validity from nested validity object
                    Map<String, Object> validity = (Map<String, Object>) rateData.get('validity');
                    if (validity != null) {
                        rate.validFrom = (String) validity.get('from');
                        rate.validTo = (String) validity.get('to');
                    }
                    
                    rates.add(rate);
                }
            }
        } catch (Exception e) {
            System.debug('Error parsing ocean freight rates: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
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
        
        @InvocableVariable(label='Rates' description='Rates data as JSON string')
        public String rates;
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
