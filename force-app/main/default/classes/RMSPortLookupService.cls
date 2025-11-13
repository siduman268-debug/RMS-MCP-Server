/**
 * @description Service class for Port Lookup operations
 * @author RMS Team
 * @date 2025-01-27
 */
public class RMSPortLookupService {
    
    /**
     * @description Search ports by name or UN/LOCODE
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
            resultLimit = 20;
        }
        
        List<Map<String, Object>> ports = new List<Map<String, Object>>();
        
        try {
            // For now, return common ports based on search term
            // TODO: Implement actual API call when port search API is available
            String searchUpper = searchTerm.toUpperCase();
            
            // Filter common ports based on search term
            List<Map<String, Object>> commonPorts = getCommonPorts();
            for (Map<String, Object> port : commonPorts) {
                String portName = (String) port.get('name');
                String unlocode = (String) port.get('unlocode');
                
                if (portName != null && portName.toUpperCase().contains(searchUpper)) {
                    ports.add(port);
                } else if (unlocode != null && unlocode.contains(searchUpper)) {
                    ports.add(port);
                }
            }
            
            // Limit results
            if (ports.size() > resultLimit) {
                List<Map<String, Object>> limitedPorts = new List<Map<String, Object>>();
                for (Integer i = 0; i < resultLimit; i++) {
                    limitedPorts.add(ports[i]);
                }
                ports = limitedPorts;
            }
        } catch (Exception e) {
            System.debug('Error searching ports: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            // Return empty list on error
        }
        
        return ports;
    }
    
    /**
     * @description Get common ports for quick selection
     * @return List<Map<String, Object>> List of common ports
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getCommonPorts() {
        List<Map<String, Object>> commonPorts = new List<Map<String, Object>>();
        
        // Common Indian Ports
        commonPorts.add(createPortOption('Nhava Sheva', 'INNSA'));
        commonPorts.add(createPortOption('Mundra', 'INMUN'));
        commonPorts.add(createPortOption('Chennai', 'INMAA'));
        commonPorts.add(createPortOption('Kolkata', 'INCCU'));
        commonPorts.add(createPortOption('Cochin', 'INCOK'));
        
        // Common European Ports
        commonPorts.add(createPortOption('Rotterdam', 'NLRTM'));
        commonPorts.add(createPortOption('Hamburg', 'DEHAM'));
        commonPorts.add(createPortOption('London Gateway', 'GBLGP'));
        commonPorts.add(createPortOption('Antwerp', 'BEANR'));
        
        // Common US Ports
        commonPorts.add(createPortOption('New York', 'USNYC'));
        commonPorts.add(createPortOption('Long Beach', 'USLGB'));
        commonPorts.add(createPortOption('Savannah', 'USSAV'));
        commonPorts.add(createPortOption('Houston', 'USHOU'));
        
        // Middle East
        commonPorts.add(createPortOption('Jebel Ali', 'AEJEA'));
        commonPorts.add(createPortOption('Salalah', 'OMSLL'));
        
        return commonPorts;
    }
    
    /**
     * @description Create a port option map
     * @param name Port name
     * @param unlocode UN/LOCODE
     * @return Map<String, Object> Port option
     */
    private static Map<String, Object> createPortOption(String name, String unlocode) {
        Map<String, Object> option = new Map<String, Object>();
        option.put('label', name + ' (' + unlocode + ')');
        option.put('value', unlocode);
        option.put('name', name);
        option.put('unlocode', unlocode);
        return option;
    }
}

