/**
 * @description Service class for Vendor operations via RMS API
 * @author RMS Team
 * @date 2025-01-28
 */
public class RMSVendorService {
    
    /**
     * @description List all vendors with optional filtering
     * @param vendorType Filter by type (e.g., 'ocean_carrier', 'forwarder')
     * @param isActive Filter by active status
     * @return List of vendor maps
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> listVendors(String vendorType, Boolean isActive) {
        try {
            // Check view permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_VENDOR, RMSPermissionService.PERMISSION_VIEW);
            
            String endpoint = '/api/vendors';
            Map<String, String> queryParams = new Map<String, String>();
            
            if (String.isNotBlank(vendorType)) {
                queryParams.put('vendor_type', vendorType);
            }
            if (isActive != null) {
                queryParams.put('is_active', String.valueOf(isActive));
            }
            
            String fullEndpoint = RMSApiUtil.buildEndpoint(endpoint, queryParams);
            HttpResponse res = RMSApiUtil.makeGetRequest(fullEndpoint);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            
            List<Map<String, Object>> vendors = new List<Map<String, Object>>();
            List<Object> dataList = (List<Object>) response.get('data');
            
            if (dataList != null) {
                for (Object item : dataList) {
                    vendors.add((Map<String, Object>) item);
                }
            }
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterRecordsByPermission(vendors, RMSPermissionService.ENTITY_VENDOR);
        } catch (Exception e) {
            throw new AuraHandledException('Error listing vendors: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get vendor by ID
     * @param vendorId Vendor ID
     * @return Vendor map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getVendor(Decimal vendorId) {
        try {
            // Check view permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_VENDOR, RMSPermissionService.PERMISSION_VIEW);
            
            HttpResponse res = RMSApiUtil.makeGetRequest('/api/vendors/' + vendorId);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> vendor = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(vendor, RMSPermissionService.ENTITY_VENDOR);
        } catch (Exception e) {
            throw new AuraHandledException('Error getting vendor: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create a new vendor
     * @param vendorData Map of vendor fields
     * @return Created vendor map
     */
    @AuraEnabled
    public static Map<String, Object> createVendor(Map<String, Object> vendorData) {
        try {
            // Check create permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_VENDOR, RMSPermissionService.PERMISSION_CREATE);
            
            // Ensure tenant_id is included (RLS enforcement)
            vendorData = RMSApiUtil.addTenantToPayload(vendorData);
            String body = JSON.serialize(vendorData);
            HttpResponse res = RMSApiUtil.makePostRequest('/api/vendors', body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> createdVendor = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(createdVendor, RMSPermissionService.ENTITY_VENDOR);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating vendor: ' + e.getMessage());
        }
    }
    
    /**
     * @description Update an existing vendor
     * @param vendorId Vendor ID
     * @param updates Map of fields to update
     * @return Updated vendor map
     */
    @AuraEnabled
    public static Map<String, Object> updateVendor(Decimal vendorId, Map<String, Object> updates) {
        try {
            // Check edit permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_VENDOR, RMSPermissionService.PERMISSION_EDIT);
            
            // Prevent tenant_id modification (RLS enforcement)
            updates.remove('tenant_id');
            
            // Verify tenant access first
            Map<String, Object> existingVendor = getVendor(vendorId);
            String vendorTenantId = (String) existingVendor.get('tenant_id');
            String userTenantId = RMSApiUtil.getTenantId();
            
            if (String.isNotBlank(vendorTenantId) && !vendorTenantId.equals(userTenantId)) {
                throw new AuraHandledException('Access denied: This vendor belongs to a different tenant.');
            }
            
            String body = JSON.serialize(updates);
            HttpResponse res = RMSApiUtil.makePutRequest('/api/vendors/' + vendorId, body);
            Map<String, Object> response = RMSApiUtil.parseResponse(res);
            Map<String, Object> updatedVendor = (Map<String, Object>) response.get('data');
            
            // Filter fields based on field-level permissions
            return RMSPermissionService.filterFieldsByPermission(updatedVendor, RMSPermissionService.ENTITY_VENDOR);
        } catch (Exception e) {
            throw new AuraHandledException('Error updating vendor: ' + e.getMessage());
        }
    }
    
    /**
     * @description Delete a vendor
     * @param vendorId Vendor ID
     * @return Boolean Success status
     */
    @AuraEnabled
    public static Boolean deleteVendor(Decimal vendorId) {
        try {
            // Check delete permission
            RMSPermissionService.validatePermission(RMSPermissionService.ENTITY_VENDOR, RMSPermissionService.PERMISSION_DELETE);
            
            // First verify tenant access by fetching the vendor
            Map<String, Object> vendor = getVendor(vendorId);
            String vendorTenantId = (String) vendor.get('tenant_id');
            String userTenantId = RMSApiUtil.getTenantId();
            
            if (String.isNotBlank(vendorTenantId) && !vendorTenantId.equals(userTenantId)) {
                throw new AuraHandledException('Access denied: This vendor belongs to a different tenant.');
            }
            
            HttpResponse res = RMSApiUtil.makeDeleteRequest('/api/vendors/' + vendorId);
            return res.getStatusCode() >= 200 && res.getStatusCode() < 300;
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting vendor: ' + e.getMessage());
        }
    }
    
    /**
     * @description Bulk create vendors from CSV data
     * @param vendorsList List of vendor maps
     * @return List of created vendor maps
     */
    @AuraEnabled
    public static List<Map<String, Object>> bulkCreateVendors(List<Map<String, Object>> vendorsList) {
        try {
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            
            for (Map<String, Object> vendorData : vendorsList) {
                try {
                    Map<String, Object> created = createVendor(vendorData);
                    results.add(created);
                } catch (Exception e) {
                    Map<String, Object> errorResult = new Map<String, Object>();
                    errorResult.put('error', e.getMessage());
                    errorResult.put('data', vendorData);
                    results.add(errorResult);
                }
            }
            
            return results;
        } catch (Exception e) {
            throw new AuraHandledException('Error in bulk create vendors: ' + e.getMessage());
        }
    }
}

