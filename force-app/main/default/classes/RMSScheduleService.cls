/**
 * @description Service class for Vessel Schedule operations
 * @author RMS Team
 * @date 2025-01-27
 */
public class RMSScheduleService {
    
    /**
     * @description Search vessel schedules
     * @param origin Origin port UN/LOCODE (required)
     * @param destination Destination port UN/LOCODE (optional)
     * @param departureFrom Start date (optional, defaults to today)
     * @param departureTo End date (optional)
     * @param weeks Number of weeks from departureFrom (2, 4, or 6) - optional
     * @param resultLimit Max number of results (default: 100, max: 500)
     * @return Map<String, Object> API response with schedules data
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> searchSchedules(
        String origin,
        String destination,
        Date departureFrom,
        Date departureTo,
        Integer weeks,
        Integer resultLimit
    ) {
        if (String.isBlank(origin)) {
            throw new AuraHandledException('Origin port is required');
        }
        
        // Build request body
        Map<String, Object> requestBody = new Map<String, Object>();
        requestBody.put('origin', origin);
        
        if (String.isNotBlank(destination)) {
            requestBody.put('destination', destination);
        }
        
        if (departureFrom != null) {
            requestBody.put('departure_from', String.valueOf(departureFrom));
        }
        
        if (departureTo != null) {
            requestBody.put('departure_to', String.valueOf(departureTo));
        }
        
        if (weeks != null && (weeks == 2 || weeks == 4 || weeks == 6)) {
            requestBody.put('weeks', weeks);
        }
        
        if (resultLimit != null && resultLimit > 0 && resultLimit <= 500) {
            requestBody.put('limit', resultLimit);
        }
        
        try {
            String body = JSON.serialize(requestBody);
            System.debug('RMS Schedule Request: ' + body);
            HttpResponse res = RMSApiUtil.makeApiCall('/api/v4/schedules/search', 'POST', body);
            System.debug('RMS Schedule Response Status: ' + res.getStatusCode());
            System.debug('RMS Schedule Response Body: ' + res.getBody());
            
            if (res.getStatusCode() >= 200 && res.getStatusCode() < 300) {
                Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                return response;
            } else {
                String errorMsg = 'API call failed with status ' + res.getStatusCode() + ': ' + res.getBody();
                System.debug('RMS Schedule Error: ' + errorMsg);
                throw new AuraHandledException(errorMsg);
            }
        } catch (RMSApiUtil.RMSApiException e) {
            System.debug('RMS API Exception: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            throw new AuraHandledException('RMS API Error: ' + e.getMessage());
        } catch (Exception e) {
            System.debug('Exception: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error searching schedules: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get schedules with filters (for LWC)
     * @param searchParams Map containing search parameters
     * @return Map<String, Object> API response with schedules data
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getSchedules(Map<String, Object> searchParams) {
        String origin = (String) searchParams.get('origin');
        String destination = (String) searchParams.get('destination');
        
        Date departureFrom = null;
        if (searchParams.get('departureFrom') != null) {
            Object depFrom = searchParams.get('departureFrom');
            if (depFrom instanceof String) {
                departureFrom = Date.valueOf((String) depFrom);
            }
        }
        
        Date departureTo = null;
        if (searchParams.get('departureTo') != null) {
            Object depTo = searchParams.get('departureTo');
            if (depTo instanceof String) {
                departureTo = Date.valueOf((String) depTo);
            }
        }
        
        Integer weeks = null;
        if (searchParams.get('weeks') != null) {
            Object weeksObj = searchParams.get('weeks');
            if (weeksObj instanceof Integer) {
                weeks = (Integer) weeksObj;
            } else if (weeksObj instanceof Decimal) {
                weeks = ((Decimal) weeksObj).intValue();
            } else if (weeksObj instanceof String) {
                weeks = Integer.valueOf((String) weeksObj);
            }
        }
        
        Integer resultLimit = 100;
        if (searchParams.get('limit') != null) {
            Object limitObj = searchParams.get('limit');
            if (limitObj instanceof Integer) {
                resultLimit = (Integer) limitObj;
            } else if (limitObj instanceof Decimal) {
                resultLimit = ((Decimal) limitObj).intValue();
            } else if (limitObj instanceof String) {
                resultLimit = Integer.valueOf((String) limitObj);
            }
        }
        
        try {
            return searchSchedules(origin, destination, departureFrom, departureTo, weeks, resultLimit);
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            System.debug('Error in getSchedules: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error getting schedules: ' + e.getMessage());
        }
    }
}

