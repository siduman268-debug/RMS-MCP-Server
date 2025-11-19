/**
 * @description Service class for Charge Code Lookup operations from charge_master table
 * @author RMS Team
 * @date 2025-01-19
 */
public class RMSChargeLookupService {
    
    /**
     * @description Search charge codes from charge_master table
     * @param searchTerm Search term (charge code or charge name)
     * @param resultLimit Maximum number of results (default: 50)
     * @return List<Map<String, Object>> List of charge codes with label and value
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> searchChargeCodes(String searchTerm, Integer resultLimit) {
        try {
            String endpoint = '/api/charge-codes';
            Map<String, String> queryParams = new Map<String, String>();
            
            if (String.isNotBlank(searchTerm)) {
                queryParams.put('search', searchTerm);
            }
            
            if (resultLimit != null && resultLimit > 0) {
                queryParams.put('limit', String.valueOf(resultLimit));
            } else {
                queryParams.put('limit', '50');
            }
            
            // Only active charge codes
            queryParams.put('is_active', 'true');
            
            String fullEndpoint = RMSApiUtil.buildEndpoint(endpoint, queryParams);
            HttpResponse res = RMSApiUtil.makeGetRequest(fullEndpoint);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> chargeCodes = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    Map<String, Object> charge = (Map<String, Object>) item;
                    Map<String, Object> chargeOption = new Map<String, Object>();
                    
                    String code = (String) charge.get('charge_code');
                    String name = (String) charge.get('charge_name');
                    String category = (String) charge.get('charge_category');
                    
                    // Format: "THC - Terminal Handling Charge (PORT)"
                    String label = code + ' - ' + name;
                    if (String.isNotBlank(category)) {
                        label += ' (' + category + ')';
                    }
                    
                    chargeOption.put('label', label);
                    chargeOption.put('value', code);
                    chargeOption.put('code', code);
                    chargeOption.put('name', name);
                    chargeOption.put('category', category);
                    chargeOption.put('defaultCalcMethod', charge.get('default_calc_method'));
                    chargeOption.put('defaultUom', charge.get('default_uom'));
                    
                    chargeCodes.add(chargeOption);
                }
            }
            
            return chargeCodes;
        } catch (Exception e) {
            System.debug('Error searching charge codes: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error searching charge codes: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get all active charge codes (for initial load)
     * @return List<Map<String, Object>> List of all active charge codes
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAllChargeCodes() {
        return searchChargeCodes('', 100);
    }
}

