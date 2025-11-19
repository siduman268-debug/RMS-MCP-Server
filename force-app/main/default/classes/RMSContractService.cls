/**
 * @description Service class for Contract operations via RMS API
 * @author RMS Team
 * @date 2025-01-28
 */
public class RMSContractService {
    
    /**
     * @description List all contracts with optional filtering
     * @param vendorId Filter by vendor ID
     * @param isActive Filter by active status
     * @return List of contract maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listContracts(Decimal vendorId, Boolean isActive) {
        try {
            // Check view permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_CONTRACT, RMSPermissionService.PERMISSION_VIEW);
            
            String endpoint = '/api/contracts';
            Map<String, String> queryParams = new Map<String, String>();
            
            if (vendorId != null) {
                queryParams.put('vendor_id', String.valueOf(vendorId));
            }
            if (isActive != null) {
                queryParams.put('is_active', String.valueOf(isActive));
            }
            
            String fullEndpoint = RMSApiUtil.buildEndpoint(endpoint, queryParams);
            HttpResponse res = RMSApiUtil.makeGetRequest(fullEndpoint);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> contracts = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    contracts.add((Map<String, Object>) item);
                }
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterRecordsByPermission(contracts, RMSPermissionService.ENTITY_CONTRACT);
        } catch (Exception e) {
            throw new AuraHandledException('Error listing contracts: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get contract by ID
     * @param contractId Contract ID
     * @return Contract map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getContract(Decimal contractId) {
        try {
            // Check view permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_CONTRACT, RMSPermissionService.PERMISSION_VIEW);
            
            HttpResponse res = RMSApiUtil.makeGetRequest('/api/contracts/' + contractId);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> contract = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(contract, RMSPermissionService.ENTITY_CONTRACT);
        } catch (Exception e) {
            throw new AuraHandledException('Error getting contract: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create a new contract
     * @param contractData Map of contract fields
     * @return Created contract map
     */
    @AuraEnabled
    public static Map<String, Object> createContract(Map<String, Object> contractData) {
        try {
            // Check create permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_CONTRACT, RMSPermissionService.PERMISSION_CREATE);
            
            // Ensure tenant_id is included (RLS enforcement)
            contractData = RMSApiUtil.addTenantToPayload(contractData);
            String body = JSON.serialize(contractData);
            HttpResponse res = RMSApiUtil.makePostRequest('/api/contracts', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> createdContract = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(createdContract, RMSPermissionService.ENTITY_CONTRACT);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating contract: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update an existing contract
     * @param contractId Contract ID
     * @param updates Map of fields to update
     * @return Updated contract map
     */
    @AuraEnabled
    public static Map<String, Object> updateContract(Decimal contractId, Map<String, Object> updates) {
        try {
            // Check edit permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_CONTRACT, RMSPermissionService.PERMISSION_EDIT);
            
            // Prevent tenant_id modification (RLS enforcement)
            updates.remove('tenant_id');
            
            // Verify tenant access first
            Map<String, Object> existingContract = getContract(contractId);
            String contractTenantId = (String) existingContract.get('tenant_id');
            String userTenantId = RMSApiUtil.getTenantId();
            
            if (String.isNotBlank(contractTenantId) && !contractTenantId.equals(userTenantId)) {
                throw new AuraHandledException('Access denied: This contract belongs to a different tenant.');
            }
            
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makePutRequest('/api/contracts/' + contractId, body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> updatedContract = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(updatedContract, RMSPermissionService.ENTITY_CONTRACT);
        } catch (Exception e) {
            throw new AuraHandledException('Error updating contract: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a contract
     * @param contractId Contract ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteContract(Decimal contractId) {
        try {
            // Check delete permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_CONTRACT, RMSPermissionService.PERMISSION_DELETE);
            
            // Verify tenant access first
            Map<String, Object> contract = getContract(contractId);
            String contractTenantId = (String) contract.get('tenant_id');
            String userTenantId = RMSApiUtil.getTenantId();
            
            if (String.isNotBlank(contractTenantId) && !contractTenantId.equals(userTenantId)) {
                throw new AuraHandledException('Access denied: This contract belongs to a different tenant.');
            }
            
            HttpResponse res = RMSApiUtil.makeDeleteRequest('/api/contracts/' + contractId);
            Integer statusCode = res.getStatusCode();
            
            if (statusCode >= 200 && statusCode < 300) {
                return true;
            } else {
                // Parse error response
                String responseBody = res.getBody();
                throw new AuraHandledException('API returned status ' + statusCode + ': ' + responseBody);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting contract: ' + e.getMessage());
        }
    }
    
    /**
     * @description Bulk create contracts from CSV data
     * @param contractsList List of contract maps
     * @return List of created contract maps
     */
    @AuraEnabled
    public static List<Map<String, Object>> bulkCreateContracts(List<Map<String, Object>> contractsList) {
        try {
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            
            for (Map<String, Object> contractData : contractsList) {
                try {
                    Map<String, Object> created = createContract(contractData);
                    results.add(created);
                } catch (Exception e) {
                    Map<String, Object> errorResult = new Map<String, Object>();
                    errorResult.put('error', e.getMessage());
                    errorResult.put('data', contractData);
                    results.add(errorResult);
                }
            }
            
            return results;
        } catch (Exception e) {
            throw new AuraHandledException('Error in bulk create contracts: ' + e.getMessage());
        }
    }
}

