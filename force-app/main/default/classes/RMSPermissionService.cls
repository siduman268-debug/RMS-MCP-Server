/**
 * @description Service class for RMS Permission management and RBAC
 * @author RMS Team
 * @date 2025-01-28
 * 
 * Supports:
 * - Entity-level permissions (view/edit/delete for Vendors, Rates, Surcharges, Margin Rules)
 * - Field-level permissions (e.g., rates are secret, only pricing users can view)
 * - Role-based access control (RBAC)
 * - Integration with Salesforce Profiles and Permission Sets
 */
public with sharing class RMSPermissionService {
    
    // Permission constants
    public static final String PERMISSION_VIEW = 'VIEW';
    public static final String PERMISSION_CREATE = 'CREATE';
    public static final String PERMISSION_EDIT = 'EDIT';
    public static final String PERMISSION_DELETE = 'DELETE';
    public static final String PERMISSION_MARK_PREFERRED = 'MARK_PREFERRED';
    
    // Entity constants
    public static final String ENTITY_VENDOR = 'VENDOR';
    public static final String ENTITY_CONTRACT = 'CONTRACT';
    public static final String ENTITY_RATE = 'RATE';
    public static final String ENTITY_SURCHARGE = 'SURCHARGE';
    public static final String ENTITY_MARGIN_RULE = 'MARGIN_RULE';
    
    // Field constants
    public static final String FIELD_BUY_AMOUNT = 'buy_amount';
    public static final String FIELD_SELL_AMOUNT = 'sell_amount';
    public static final String FIELD_MARGIN = 'margin';
    public static final String FIELD_TENANT_ID = 'tenant_id';
    
    // Cache for role permission matrix (loaded from Custom Metadata)
    private static Map<String, Map<String, Set<String>>> cachedRolePermissions = null;
    private static Map<String, Map<String, Set<String>>> cachedFieldPermissions = null;
    private static Map<String, String> cachedProfileToRole = null;
    private static Map<String, String> cachedPermissionSetToRole = null;
    // Cache user role per transaction (avoids SOQL limit issues)
    private static String cachedUserRole = null;
    
    /**
     * @description Get current user's role identifier
     * @return String Role identifier (e.g., 'PRICING_USER', 'SALES_USER', 'ADMIN')
     * 
     * Resolves role in this order:
     * 1. Custom Metadata Type role mappings (org-configurable)
     * 2. Custom User field (RMS_Role__c) if exists
     * 3. Default hardcoded mappings (backward compatible)
     * 
     * IMPORTANT: Cached per transaction to avoid SOQL limit issues
     */
    public static String getUserRole() {
        // Return cached role if already determined (avoids SOQL limit)
        if (cachedUserRole != null) {
            return cachedUserRole;
        }
        
        String profileName = UserInfo.getProfileId() != null ? 
            [SELECT Name FROM Profile WHERE Id = :UserInfo.getProfileId()].Name : '';
        
        // Load role mappings from Custom Metadata Type (org-configurable)
        Map<String, String> profileToRoleMap = getProfileToRoleMapping();
        Map<String, String> permissionSetToRoleMap = getPermissionSetToRoleMapping();
        
        // 1. Check Custom Metadata Type profile mappings
        if (profileToRoleMap.containsKey(profileName)) {
            cachedUserRole = profileToRoleMap.get(profileName);
            return cachedUserRole;
        }
        
        // 2. Check Custom Metadata Type permission set mappings
        List<PermissionSetAssignment> permissionSets = [
            SELECT PermissionSet.Name 
            FROM PermissionSetAssignment 
            WHERE AssigneeId = :UserInfo.getUserId() 
            AND PermissionSet.Name LIKE 'RMS_%'
        ];
        
        for (PermissionSetAssignment psa : permissionSets) {
            String psName = psa.PermissionSet.Name;
            if (permissionSetToRoleMap.containsKey(psName)) {
                cachedUserRole = permissionSetToRoleMap.get(psName);
                return cachedUserRole;
            }
        }
        
        // 3. Check Custom User Field (if exists)
        try {
            String userFieldApiName = 'RMS_Role__c';
            // Dynamic SOQL to check if field exists (handled gracefully if not)
            List<SObject> userRecords = Database.query(
                'SELECT ' + userFieldApiName + ' FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1'
            );
            if (!userRecords.isEmpty()) {
                String userRole = (String) userRecords[0].get(userFieldApiName);
                if (String.isNotBlank(userRole)) {
                    cachedUserRole = userRole;
                    return cachedUserRole;
                }
            }
        } catch (Exception e) {
            // Field doesn't exist or query failed - continue to default
        }
        
        // 4. Fall back to default hardcoded mappings (backward compatible)
        Map<String, String> defaultProfileMap = new Map<String, String>{
            'System Administrator' => 'ADMIN',
            'RMS Pricing Manager' => 'PRICING_USER',
            'RMS Pricing User' => 'PRICING_USER',
            'RMS Sales Manager' => 'SALES_USER',
            'RMS Sales User' => 'SALES_USER',
            'RMS Sales Read Only' => 'SALES_READONLY',
            'RMS Operations' => 'OPERATIONS_USER'
        };
        
        if (defaultProfileMap.containsKey(profileName)) {
            cachedUserRole = defaultProfileMap.get(profileName);
            return cachedUserRole;
        }
        
        // Default: Return ADMIN role for testing (allows full access without configuration)
        // TODO: Change to 'SALES_READONLY' for production after RBAC is configured
        cachedUserRole = 'ADMIN';
        return cachedUserRole;
    }
    
    /**
     * @description Load profile to role mappings from Custom Metadata Type
     * @return Map<String, String> Profile Name -> Role mapping
     */
    private static Map<String, String> getProfileToRoleMapping() {
        if (cachedProfileToRole != null) {
            return cachedProfileToRole;
        }
        
        cachedProfileToRole = new Map<String, String>();
        
        try {
            // Note: Long Text Area fields cannot be filtered in WHERE clause
            // Query all records and filter in Apex (single query, no duplication)
            List<RMS_Role_Permission__mdt> rolePerms = new List<RMS_Role_Permission__mdt>();
            for (RMS_Role_Permission__mdt rp : [
                SELECT Role__c, Profile_Mapping__c 
                FROM RMS_Role_Permission__mdt
            ]) {
                if (String.isNotBlank(rp.Profile_Mapping__c)) {
                    rolePerms.add(rp);
                }
            }
            
            for (RMS_Role_Permission__mdt rp : rolePerms) {
                String role = rp.Role__c;
                String profileMappings = rp.Profile_Mapping__c;
                
                if (String.isNotBlank(profileMappings)) {
                    List<String> profiles = profileMappings.split(',');
                    for (String profile : profiles) {
                        String trimmedProfile = profile.trim();
                        if (String.isNotBlank(trimmedProfile)) {
                            cachedProfileToRole.put(trimmedProfile, role);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Custom Metadata Type doesn't exist yet - return empty map
            System.debug('RMS Permission: Custom Metadata Type not configured yet. Using defaults.');
        }
        
        return cachedProfileToRole;
    }
    
    /**
     * @description Load permission set to role mappings from Custom Metadata Type
     * @return Map<String, String> Permission Set Name -> Role mapping
     */
    private static Map<String, String> getPermissionSetToRoleMapping() {
        if (cachedPermissionSetToRole != null) {
            return cachedPermissionSetToRole;
        }
        
        cachedPermissionSetToRole = new Map<String, String>();
        
        try {
            // Note: Long Text Area fields cannot be filtered in WHERE clause
            // Query all records and filter in Apex
            List<RMS_Role_Permission__mdt> rolePerms = new List<RMS_Role_Permission__mdt>();
            for (RMS_Role_Permission__mdt rp : [
                SELECT Role__c, Permission_Set_Mapping__c 
                FROM RMS_Role_Permission__mdt
            ]) {
                if (String.isNotBlank(rp.Permission_Set_Mapping__c)) {
                    rolePerms.add(rp);
                }
            }
            
            for (RMS_Role_Permission__mdt rp : rolePerms) {
                String role = rp.Role__c;
                String psMappings = rp.Permission_Set_Mapping__c;
                
                if (String.isNotBlank(psMappings)) {
                    List<String> permissionSets = psMappings.split(',');
                    for (String ps : permissionSets) {
                        String trimmedPS = ps.trim();
                        if (String.isNotBlank(trimmedPS)) {
                            cachedPermissionSetToRole.put(trimmedPS, role);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Custom Metadata Type doesn't exist yet - return empty map
            System.debug('RMS Permission: Custom Metadata Type not configured yet. Using defaults.');
        }
        
        return cachedPermissionSetToRole;
    }
    
    /**
     * @description Check if user has permission for entity action
     * @param entity Entity name (VENDOR, CONTRACT, RATE, SURCHARGE, MARGIN_RULE)
     * @param permission Permission (VIEW, CREATE, EDIT, DELETE, MARK_PREFERRED)
     * @return Boolean True if user has permission
     */
    public static Boolean hasPermission(String entity, String permission) {
        String userRole = getUserRole();
        
        // Admin has all permissions
        if (userRole == 'ADMIN') {
            return true;
        }
        
        // Define permission matrix based on role
        Map<String, Map<String, Set<String>>> rolePermissions = getRolePermissionMatrix();
        
        if (rolePermissions.containsKey(userRole) && 
            rolePermissions.get(userRole).containsKey(entity)) {
            return rolePermissions.get(userRole).get(entity).contains(permission);
        }
        
        return false; // Fail secure - default to no permission
    }
    
    /**
     * @description Get permission matrix for all roles (from Custom Metadata or defaults)
     * @return Map<Role, Map<Entity, Set<Permissions>>>
     * 
     * Loads from Custom Metadata Type first, falls back to defaults if not configured
     */
    private static Map<String, Map<String, Set<String>>> getRolePermissionMatrix() {
        // Return cached matrix if available
        if (cachedRolePermissions != null) {
            return cachedRolePermissions;
        }
        
        cachedRolePermissions = new Map<String, Map<String, Set<String>>>();
        
        try {
            // Note: Long Text Area fields cannot be filtered in WHERE clause
            // Query all records and filter in Apex
            List<RMS_Role_Permission__mdt> rolePerms = new List<RMS_Role_Permission__mdt>();
            for (RMS_Role_Permission__mdt rp : [
                SELECT Role__c, Entity__c, Permissions__c 
                FROM RMS_Role_Permission__mdt
                ORDER BY Role__c, Entity__c
            ]) {
                if (String.isNotBlank(rp.Permissions__c)) {
                    rolePerms.add(rp);
                }
            }
            
            if (!rolePerms.isEmpty()) {
                // Build matrix from Custom Metadata
                for (RMS_Role_Permission__mdt rp : rolePerms) {
                    String role = rp.Role__c;
                    String entity = rp.Entity__c;
                    String permsStr = rp.Permissions__c;
                    
                    if (String.isBlank(role) || String.isBlank(entity) || String.isBlank(permsStr)) {
                        continue;
                    }
                    
                    // Parse permissions (comma-separated)
                    Set<String> perms = new Set<String>();
                    List<String> permList = permsStr.split(',');
                    for (String p : permList) {
                        String trimmedPerm = p.trim().toUpperCase();
                        if (String.isNotBlank(trimmedPerm)) {
                            perms.add(trimmedPerm);
                        }
                    }
                    
                    // Add to matrix
                    if (!cachedRolePermissions.containsKey(role)) {
                        cachedRolePermissions.put(role, new Map<String, Set<String>>());
                    }
                    cachedRolePermissions.get(role).put(entity.toUpperCase(), perms);
                }
                
                // If we loaded from Custom Metadata, return it
                if (!cachedRolePermissions.isEmpty()) {
                    return cachedRolePermissions;
                }
            }
        } catch (Exception e) {
            // Custom Metadata Type doesn't exist yet - use defaults
            System.debug('RMS Permission: Custom Metadata Type not configured. Using default permissions. ' + e.getMessage());
        }
        
        // Fall back to default hardcoded permissions (backward compatible)
        return getDefaultRolePermissionMatrix();
    }
    
    /**
     * @description Get default hardcoded permission matrix (backward compatibility)
     * @return Map<Role, Map<Entity, Set<Permissions>>>
     */
    private static Map<String, Map<String, Set<String>>> getDefaultRolePermissionMatrix() {
        Map<String, Map<String, Set<String>>> matrix = new Map<String, Map<String, Set<String>>>();
        
        // ADMIN - Full access to everything (for testing without configuration)
        Map<String, Set<String>> adminPermissions = new Map<String, Set<String>>();
        adminPermissions.put(ENTITY_VENDOR, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        adminPermissions.put(ENTITY_CONTRACT, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        adminPermissions.put(ENTITY_RATE, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE, PERMISSION_MARK_PREFERRED});
        adminPermissions.put(ENTITY_SURCHARGE, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        adminPermissions.put(ENTITY_MARGIN_RULE, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        matrix.put('ADMIN', adminPermissions);
        
        // PRICING_USER - Full access to all pricing entities
        Map<String, Set<String>> pricingPermissions = new Map<String, Set<String>>();
        pricingPermissions.put(ENTITY_VENDOR, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        pricingPermissions.put(ENTITY_CONTRACT, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        pricingPermissions.put(ENTITY_RATE, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE, PERMISSION_MARK_PREFERRED});
        pricingPermissions.put(ENTITY_SURCHARGE, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        pricingPermissions.put(ENTITY_MARGIN_RULE, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        matrix.put('PRICING_USER', pricingPermissions);
        
        // SALES_USER - Can view rates (read-only), can edit surcharges, cannot see/edit margin rules
        Map<String, Set<String>> salesPermissions = new Map<String, Set<String>>();
        salesPermissions.put(ENTITY_VENDOR, new Set<String>{PERMISSION_VIEW});
        salesPermissions.put(ENTITY_CONTRACT, new Set<String>{PERMISSION_VIEW});
        salesPermissions.put(ENTITY_RATE, new Set<String>{PERMISSION_VIEW}); // Read-only, cannot see buy_amount
        salesPermissions.put(ENTITY_SURCHARGE, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        salesPermissions.put(ENTITY_MARGIN_RULE, new Set<String>{}); // No access to margin rules
        matrix.put('SALES_USER', salesPermissions);
        
        // SALES_READONLY - Can only view non-sensitive entities
        Map<String, Set<String>> salesReadonlyPermissions = new Map<String, Set<String>>();
        salesReadonlyPermissions.put(ENTITY_VENDOR, new Set<String>{PERMISSION_VIEW});
        salesReadonlyPermissions.put(ENTITY_CONTRACT, new Set<String>{PERMISSION_VIEW});
        salesReadonlyPermissions.put(ENTITY_RATE, new Set<String>{}); // No access to rates (secret)
        salesReadonlyPermissions.put(ENTITY_SURCHARGE, new Set<String>{PERMISSION_VIEW});
        salesReadonlyPermissions.put(ENTITY_MARGIN_RULE, new Set<String>{}); // No access to margin rules
        matrix.put('SALES_READONLY', salesReadonlyPermissions);
        
        // OPERATIONS_USER - Can edit vendors/contracts, cannot see pricing data
        Map<String, Set<String>> operationsPermissions = new Map<String, Set<String>>();
        operationsPermissions.put(ENTITY_VENDOR, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        operationsPermissions.put(ENTITY_CONTRACT, new Set<String>{PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE});
        operationsPermissions.put(ENTITY_RATE, new Set<String>{}); // No access to rates (secret)
        operationsPermissions.put(ENTITY_SURCHARGE, new Set<String>{PERMISSION_VIEW}); // Read-only
        operationsPermissions.put(ENTITY_MARGIN_RULE, new Set<String>{}); // No access to margin rules
        matrix.put('OPERATIONS_USER', operationsPermissions);
        
        // Cache for future use
        cachedRolePermissions = matrix;
        
        return matrix;
    }
    
    /**
     * @description Check if user can view a specific field (field-level security)
     * @param entity Entity name
     * @param fieldName Field name (e.g., 'buy_amount', 'sell_amount', 'margin')
     * @return Boolean True if user can view the field
     * 
     * Logic:
     * - If Custom Metadata defines viewable fields for role+entity: use that list (whitelist)
     * - If no Custom Metadata: default to deny sensitive fields (blacklist)
     * 
     * NOTE: This method is now optimized to use cached permissions (no SOQL per call)
     */
    public static Boolean canViewField(String entity, String fieldName) {
        String userRole = getUserRole(); // Cached per transaction
        
        // Admin can view all fields
        if (userRole == 'ADMIN') {
            return true;
        }
        
        // Get field-level security rules (from Custom Metadata or defaults) - cached
        Map<String, Map<String, Set<String>>> fieldPermissions = getFieldPermissionMatrix();
        
        // Check if role+entity has explicit viewable fields defined
        if (fieldPermissions.containsKey(userRole) && 
            fieldPermissions.get(userRole).containsKey(entity)) {
            Set<String> viewableFields = fieldPermissions.get(userRole).get(entity);
            
            // If viewable fields list is empty, allow all fields (unless sensitive)
            if (viewableFields.isEmpty()) {
                // Default: deny sensitive fields
                Set<String> sensitiveFields = new Set<String>{
                    FIELD_BUY_AMOUNT, FIELD_SELL_AMOUNT, FIELD_MARGIN
                };
                return !sensitiveFields.contains(fieldName.toLowerCase());
            }
            
            // Check if field is in viewable fields list (whitelist approach)
            return viewableFields.contains(fieldName.toLowerCase());
        }
        
        // Default: Allow viewing standard fields, deny sensitive fields
        Set<String> sensitiveFields = new Set<String>{
            FIELD_BUY_AMOUNT, FIELD_SELL_AMOUNT, FIELD_MARGIN
        };
        
        return !sensitiveFields.contains(fieldName.toLowerCase());
    }
    
    /**
     * @description Get field-level permission matrix (from Custom Metadata or defaults)
     * @return Map<Role, Map<Entity, Set<ViewableFields>>>
     */
    private static Map<String, Map<String, Set<String>>> getFieldPermissionMatrix() {
        // Return cached matrix if available
        if (cachedFieldPermissions != null) {
            return cachedFieldPermissions;
        }
        
        cachedFieldPermissions = new Map<String, Map<String, Set<String>>>();
        
        try {
            // Note: Long Text Area fields cannot be filtered in WHERE clause
            // Query all records and filter in Apex
            List<RMS_Role_Permission__mdt> rolePerms = new List<RMS_Role_Permission__mdt>();
            for (RMS_Role_Permission__mdt rp : [
                SELECT Role__c, Entity__c, Viewable_Fields__c 
                FROM RMS_Role_Permission__mdt
                ORDER BY Role__c, Entity__c
            ]) {
                if (String.isNotBlank(rp.Viewable_Fields__c)) {
                    rolePerms.add(rp);
                }
            }
            
            if (!rolePerms.isEmpty()) {
                // Build matrix from Custom Metadata
                for (RMS_Role_Permission__mdt rp : rolePerms) {
                    String role = rp.Role__c;
                    String entity = rp.Entity__c;
                    String fieldsStr = rp.Viewable_Fields__c;
                    
                    if (String.isBlank(role) || String.isBlank(entity) || String.isBlank(fieldsStr)) {
                        continue;
                    }
                    
                    // Parse viewable fields (comma-separated)
                    Set<String> fields = new Set<String>();
                    List<String> fieldList = fieldsStr.split(',');
                    for (String f : fieldList) {
                        String trimmedField = f.trim().toLowerCase();
                        if (String.isNotBlank(trimmedField)) {
                            fields.add(trimmedField);
                        }
                    }
                    
                    // Add to matrix
                    if (!cachedFieldPermissions.containsKey(role)) {
                        cachedFieldPermissions.put(role, new Map<String, Set<String>>());
                    }
                    cachedFieldPermissions.get(role).put(entity.toUpperCase(), fields);
                }
                
                // If we loaded from Custom Metadata, return it
                if (!cachedFieldPermissions.isEmpty()) {
                    return cachedFieldPermissions;
                }
            }
        } catch (Exception e) {
            // Custom Metadata Type doesn't exist yet - use defaults
            System.debug('RMS Permission: Custom Metadata Type not configured. Using default field permissions. ' + e.getMessage());
        }
        
        // Fall back to default hardcoded field permissions (backward compatible)
        return getDefaultFieldPermissionMatrix();
    }
    
    /**
     * @description Get default hardcoded field permission matrix (backward compatibility)
     * @return Map<Role, Map<Entity, Set<ViewableFields>>>
     */
    private static Map<String, Map<String, Set<String>>> getDefaultFieldPermissionMatrix() {
        Map<String, Map<String, Set<String>>> matrix = new Map<String, Map<String, Set<String>>>();
        
        // ADMIN - Can view all fields (for testing without configuration)
        Map<String, Set<String>> adminFields = new Map<String, Set<String>>();
        adminFields.put(ENTITY_VENDOR, new Set<String>()); // Empty = all fields allowed
        adminFields.put(ENTITY_CONTRACT, new Set<String>()); // Empty = all fields allowed
        adminFields.put(ENTITY_RATE, new Set<String>()); // Empty = all fields allowed (including buy_amount)
        adminFields.put(ENTITY_SURCHARGE, new Set<String>()); // Empty = all fields allowed
        adminFields.put(ENTITY_MARGIN_RULE, new Set<String>()); // Empty = all fields allowed
        matrix.put('ADMIN', adminFields);
        
        // PRICING_USER - Can view all fields including buy_amount, margin
        Map<String, Set<String>> pricingFields = new Map<String, Set<String>>();
        pricingFields.put(ENTITY_RATE, new Set<String>{
            'id', 'pol_code', 'pod_code', 'container_type', 
            FIELD_BUY_AMOUNT, 'currency', 'tt_days', 'valid_from', 'valid_to', 'is_preferred'
        });
        matrix.put('PRICING_USER', pricingFields);
        
        // SALES_USER - Can view rates but NOT buy_amount (secret field)
        Map<String, Set<String>> salesFields = new Map<String, Set<String>>();
        salesFields.put(ENTITY_RATE, new Set<String>{
            'id', 'pol_code', 'pod_code', 'container_type', 
            // NO buy_amount - this is secret
            'currency', 'tt_days', 'valid_from', 'valid_to', 'is_preferred'
        });
        matrix.put('SALES_USER', salesFields);
        
        // SALES_READONLY - Cannot view rates at all (handled by entity permission)
        matrix.put('SALES_READONLY', new Map<String, Set<String>>());
        
        // OPERATIONS_USER - Cannot view rates at all
        matrix.put('OPERATIONS_USER', new Map<String, Set<String>>());
        
        // Cache for future use
        cachedFieldPermissions = matrix;
        
        return matrix;
    }
    
    /**
     * @description Filter record data to remove fields user cannot view (field-level security)
     * @param recordData Map of record data
     * @param entity Entity name
     * @return Map<String, Object> Filtered record data
     * 
     * IMPORTANT: Loads permission matrix ONCE per transaction to avoid SOQL limit
     */
    public static Map<String, Object> filterFieldsByPermission(Map<String, Object> recordData, String entity) {
        // Get field permission matrix ONCE (cached per transaction)
        Map<String, Map<String, Set<String>>> fieldPermissions = getFieldPermissionMatrix();
        String userRole = getUserRole(); // Cached per transaction
        
        // Admin can view all fields
        Boolean isAdmin = (userRole == 'ADMIN');
        
        // Determine which fields to remove
        Set<String> sensitiveFields = new Set<String>{
            FIELD_BUY_AMOUNT, FIELD_SELL_AMOUNT, FIELD_MARGIN
        };
        
        Map<String, Object> filteredData = new Map<String, Object>(recordData);
        
        // Remove fields user cannot view
        for (String fieldName : recordData.keySet()) {
            if (isAdmin) {
                // Admin can view all fields - skip
                continue;
            }
            
            // Check if role+entity has explicit viewable fields defined
            Boolean canView = true;
            if (fieldPermissions.containsKey(userRole) && 
                fieldPermissions.get(userRole).containsKey(entity)) {
                Set<String> viewableFields = fieldPermissions.get(userRole).get(entity);
                
                // If viewable fields list is empty, use sensitive fields blacklist
                if (viewableFields.isEmpty()) {
                    canView = !sensitiveFields.contains(fieldName.toLowerCase());
                } else {
                    // Check if field is in viewable fields list (whitelist approach)
                    canView = viewableFields.contains(fieldName.toLowerCase());
                }
            } else {
                // Default: deny sensitive fields
                canView = !sensitiveFields.contains(fieldName.toLowerCase());
            }
            
            if (!canView) {
                filteredData.remove(fieldName);
            }
        }
        
        return filteredData;
    }
    
    /**
     * @description Filter list of records to remove fields user cannot view
     * @param records List of record maps
     * @param entity Entity name
     * @return List<Map<String, Object>> Filtered records
     */
    public static List<Map<String, Object>> filterRecordsByPermission(List<Map<String, Object>> records, String entity) {
        List<Map<String, Object>> filteredRecords = new List<Map<String, Object>>();
        
        for (Map<String, Object> record : records) {
            filteredRecords.add(filterFieldsByPermission(record, entity));
        }
        
        return filteredRecords;
    }
    
    /**
     * @description Validate user has permission before operation (throws exception if not)
     * @param entity Entity name
     * @param permission Permission required
     * @throws AuraHandledException if user doesn't have permission
     */
    public static void validatePermission(String entity, String permission) {
        if (!hasPermission(entity, permission)) {
            throw new AuraHandledException(
                'Access denied: You do not have permission to ' + permission.toLowerCase() + ' ' + entity.toLowerCase() + '.'
            );
        }
    }
    
    /**
     * @description Get user's permission summary for LWC (all entities and permissions)
     * @return Map<String, Map<String, Boolean>> Permission summary map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Map<String, Boolean>> getUserPermissions() {
        Map<String, Map<String, Boolean>> permissions = new Map<String, Map<String, Boolean>>();
        
        List<String> entities = new List<String>{
            ENTITY_VENDOR, ENTITY_CONTRACT, ENTITY_RATE, ENTITY_SURCHARGE, ENTITY_MARGIN_RULE
        };
        
        List<String> actions = new List<String>{
            PERMISSION_VIEW, PERMISSION_CREATE, PERMISSION_EDIT, PERMISSION_DELETE, PERMISSION_MARK_PREFERRED
        };
        
        for (String entity : entities) {
            Map<String, Boolean> entityPermissions = new Map<String, Boolean>();
            for (String action : actions) {
                entityPermissions.put(action, hasPermission(entity, action));
            }
            permissions.put(entity, entityPermissions);
        }
        
        return permissions;
    }
    
    /**
     * @description Get user's role for LWC
     * @return String User role identifier
     */
    @AuraEnabled(cacheable=true)
    public static String getUserRoleForLWC() {
        return getUserRole();
    }
}

