/**
 * @description Test class to verify RMS API connection from Salesforce
 * @author RMS Development Team
 * @date 2025-01-28
 */
public class RMSAPIConnectionTest {
    
    /**
     * @description Test the Named Credential connection
     * @return String Test result message
     */
    public static String testConnection() {
        String result = '=== RMS API Connection Test ===\n\n';
        
        try {
            // Test 1: Check Named Credential
            result += '1. Testing Named Credential...\n';
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:RMS_API/health');
            req.setMethod('GET');
            req.setTimeout(10000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            result += '   Status Code: ' + res.getStatusCode() + '\n';
            result += '   Response: ' + res.getBody() + '\n\n';
            
            if (res.getStatusCode() == 200) {
                result += '✅ Named Credential connection working!\n\n';
            } else {
                result += '❌ Named Credential connection failed!\n\n';
            }
            
            // Test 2: Test Authentication
            result += '2. Testing Authentication...\n';
            try {
                String token = RMSApiUtil.getAuthToken();
                result += '   ✅ Auth token retrieved: ' + (String.isNotBlank(token) ? 'Yes (' + token.substring(0, 20) + '...)' : 'No') + '\n\n';
            } catch (Exception e) {
                result += '   ❌ Auth failed: ' + e.getMessage() + '\n\n';
            }
            
            // Test 3: Test API Call
            result += '3. Testing API Call (Get Rates)...\n';
            try {
                String endpoint = RMSApiUtil.buildEndpoint('/api/ocean-freight-rates', new Map<String, String>{
                    'pol_code' => 'INNSA',
                    'pod_code' => 'NLRTM',
                    'container_type' => '20GP'
                });
                
                HttpResponse apiRes = RMSApiUtil.makeGetRequest(endpoint);
                result += '   Status Code: ' + apiRes.getStatusCode() + '\n';
                result += '   Response: ' + apiRes.getBody().substring(0, Math.min(500, apiRes.getBody().length())) + '\n';
                
                if (apiRes.getStatusCode() == 200) {
                    result += '   ✅ API call successful!\n';
                } else {
                    result += '   ❌ API call failed!\n';
                }
            } catch (Exception e) {
                result += '   ❌ API call error: ' + e.getMessage() + '\n';
            }
            
        } catch (Exception e) {
            result += '\n❌ Overall Test Failed: ' + e.getMessage() + '\n';
            result += 'Stack Trace: ' + e.getStackTraceString();
        }
        
        return result;
    }
}
