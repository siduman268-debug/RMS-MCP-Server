/**
 * @description Service class for Port Lookup operations
 * @author RMS Team
 * @date 2025-01-27
 */
public class RMSPortLookupService {
    
    /**
     * @description Search ports by name or UN/LOCODE from Salesforce Location master
     * @param searchTerm Search term (port name or UN/LOCODE)
     * @param resultLimit Maximum number of results (default: 20)
     * @return List<Map<String, Object>> List of ports with label and value
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> searchPorts(String searchTerm, Integer resultLimit) {
        if (String.isBlank(searchTerm)) {
            return new List<Map<String, Object>>();
        }
        
        if (resultLimit == null || resultLimit <= 0) {
            resultLimit = 50;
        }
        
        List<Map<String, Object>> ports = new List<Map<String, Object>>();
        
        try {
            String searchPattern = '%' + String.escapeSingleQuotes(searchTerm) + '%';
            
            // Query Location master object from managed package namespace
            // Using Catupult__Location_Master__c with namespaced fields
            List<SObject> locationRecords = [
                SELECT Id, Name, Catupult__Unlocode__c, Catupult__Country__c, Catupult__State_Province__c, Catupult__location_type__c, Catupult__Trade_Zone__c
                FROM Catupult__Location_Master__c
                WHERE (
                    Name LIKE :searchPattern 
                    OR Catupult__Unlocode__c LIKE :searchPattern
                )
                AND (Catupult__location_type__c = 'SEAPORT' OR Catupult__location_type__c = 'ICD' OR Catupult__location_type__c = 'CFS')
                ORDER BY Name
                LIMIT :resultLimit
            ];
            
            for (SObject loc : locationRecords) {
                String name = (String) loc.get('Name');
                String unlocode = (String) loc.get('Catupult__Unlocode__c');
                String country = (String) loc.get('Catupult__Country__c');
                String state = (String) loc.get('Catupult__State_Province__c');
                String tradeZone = (String) loc.get('Catupult__Trade_Zone__c');
                
                if (String.isNotBlank(name) && String.isNotBlank(unlocode)) {
                    Map<String, Object> port = new Map<String, Object>();
                    port.put('label', name + ' (' + unlocode + ')');
                    port.put('value', unlocode);
                    port.put('name', name);
                    port.put('unlocode', unlocode);
                    port.put('country', country);
                    port.put('state', state);
                    port.put('tradeZone', tradeZone);
                    port.put('id', loc.Id);
                    ports.add(port);
                }
            }
        } catch (Exception e) {
            System.debug('Error searching ports from Location master: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            // Return empty list on error
            // Could also fallback to common ports if query fails
        }
        
        return ports;
    }
    
    /**
     * @description Get common ports for quick selection (fallback or initial load)
     * @return List<Map<String, Object>> List of common ports
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getCommonPorts() {
        List<Map<String, Object>> commonPorts = new List<Map<String, Object>>();
        
        try {
            // Try to get common ports from Location master (gateway ports or most used)
            // If no records found, return static list as fallback
            List<SObject> commonLocations = [
                SELECT Id, Name, Catupult__Unlocode__c, Catupult__Country__c, Catupult__State_Province__c, Catupult__Trade_Zone__c
                FROM Catupult__Location_Master__c
                WHERE (Catupult__location_type__c = 'SEAPORT' OR Catupult__location_type__c = 'ICD')
                ORDER BY Name
                LIMIT 20
            ];
            
            if (!commonLocations.isEmpty()) {
                for (SObject loc : commonLocations) {
                    String name = (String) loc.get('Name');
                    String unlocode = (String) loc.get('Catupult__Unlocode__c');
                    String country = (String) loc.get('Catupult__Country__c');
                    String state = (String) loc.get('Catupult__State_Province__c');
                    String tradeZone = (String) loc.get('Catupult__Trade_Zone__c');
                    if (String.isNotBlank(name) && String.isNotBlank(unlocode)) {
                        Map<String, Object> port = createPortOption(name, unlocode, country, state, loc.Id);
                        port.put('tradeZone', tradeZone);
                        commonPorts.add(port);
                    }
                }
            }
        } catch (Exception e) {
            System.debug('Error getting common ports from Location master: ' + e.getMessage());
            // Fallback to static list if query fails
        }
        
        // If no results from database, return static common ports
        if (commonPorts.isEmpty()) {
            // Common Indian Ports
            commonPorts.add(createPortOption('Nhava Sheva', 'INNSA', 'India', 'Maharashtra', null));
            commonPorts.add(createPortOption('Mundra', 'INMUN', 'India', 'Gujarat', null));
            commonPorts.add(createPortOption('Chennai', 'INMAA', 'India', 'Tamil Nadu', null));
            commonPorts.add(createPortOption('Kolkata', 'INCCU', 'India', 'West Bengal', null));
            commonPorts.add(createPortOption('Cochin', 'INCOK', 'India', 'Kerala', null));
            
            // Common European Ports
            commonPorts.add(createPortOption('Rotterdam', 'NLRTM', 'Netherlands', null, null));
            commonPorts.add(createPortOption('Hamburg', 'DEHAM', 'Germany', null, null));
            commonPorts.add(createPortOption('London Gateway', 'GBLGP', 'United Kingdom', null, null));
            commonPorts.add(createPortOption('Antwerp', 'BEANR', 'Belgium', null, null));
            
            // Common US Ports
            commonPorts.add(createPortOption('New York', 'USNYC', 'United States', 'New York', null));
            commonPorts.add(createPortOption('Long Beach', 'USLGB', 'United States', 'California', null));
            commonPorts.add(createPortOption('Savannah', 'USSAV', 'United States', 'Georgia', null));
            commonPorts.add(createPortOption('Houston', 'USHOU', 'United States', 'Texas', null));
            
            // Middle East
            commonPorts.add(createPortOption('Jebel Ali', 'AEJEA', 'United Arab Emirates', 'Dubai', null));
            commonPorts.add(createPortOption('Salalah', 'OMSLL', 'Oman', null, null));
        }
        
        return commonPorts;
    }
    
    /**
     * @description Create a port option map
     * @param name Port name
     * @param unlocode UN/LOCODE
     * @param country Country name (optional)
     * @param state State/Province name (optional)
     * @param recordId Salesforce record ID (optional)
     * @return Map<String, Object> Port option
     */
    private static Map<String, Object> createPortOption(String name, String unlocode, String country, String state, String recordId) {
        Map<String, Object> option = new Map<String, Object>();
        option.put('label', name + ' (' + unlocode + ')');
        option.put('value', unlocode);
        option.put('name', name);
        option.put('unlocode', unlocode);
        if (String.isNotBlank(country)) {
            option.put('country', country);
        }
        if (String.isNotBlank(state)) {
            option.put('state', state);
        }
        if (String.isNotBlank(recordId)) {
            option.put('id', recordId);
        }
        return option;
    }
    
    /**
     * @description Search trade zones from Location Master table
     * @param searchTerm Search term (trade zone name)
     * @param resultLimit Maximum number of results (default: 50)
     * @return List<Map<String, Object>> List of unique trade zones
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> searchTradeZones(String searchTerm, Integer resultLimit) {
        if (resultLimit == null || resultLimit <= 0) {
            resultLimit = 50;
        }
        
        Set<String> uniqueTradeZones = new Set<String>();
        List<Map<String, Object>> tradeZones = new List<Map<String, Object>>();
        
        try {
            String searchPattern = '%' + String.escapeSingleQuotes(searchTerm) + '%';
            
            // Query Location master to get unique trade zones
            // Try with namespace first, fallback to non-namespaced if needed
            List<SObject> locationRecords = new List<SObject>();
            try {
                locationRecords = [
                    SELECT Catupult__Trade_Zone__c
                    FROM Catupult__Location_Master__c
                    WHERE Catupult__Trade_Zone__c LIKE :searchPattern
                    AND Catupult__Trade_Zone__c != null
                    ORDER BY Catupult__Trade_Zone__c
                    LIMIT :resultLimit
                ];
            } catch (Exception e) {
                // Fallback: try without namespace if managed package field doesn't exist
                System.debug('Error querying with namespace, trying without: ' + e.getMessage());
                locationRecords = [
                    SELECT Trade_Zone__c
                    FROM Location_Master__c
                    WHERE Trade_Zone__c LIKE :searchPattern
                    AND Trade_Zone__c != null
                    ORDER BY Trade_Zone__c
                    LIMIT :resultLimit
                ];
            }
            
            for (SObject loc : locationRecords) {
                String tradeZone;
                try {
                    tradeZone = (String) loc.get('Catupult__Trade_Zone__c');
                } catch (Exception e) {
                    tradeZone = (String) loc.get('Trade_Zone__c');
                }
                
                if (String.isNotBlank(tradeZone) && !uniqueTradeZones.contains(tradeZone)) {
                    uniqueTradeZones.add(tradeZone);
                    Map<String, Object> tz = new Map<String, Object>();
                    tz.put('label', tradeZone);
                    tz.put('value', tradeZone);
                    tradeZones.add(tz);
                }
            }
        } catch (Exception e) {
            System.debug('Error searching trade zones: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
        }
        
        return tradeZones;
    }
}

