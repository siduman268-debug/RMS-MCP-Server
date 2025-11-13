/**
 * @description Invocable action for searching vessel schedules in Flows
 * @author RMS Team
 * @date 2025-01-27
 */
public class RMSScheduleAction {
    
    /**
     * @description Input parameters for schedule search
     */
    public class ScheduleSearchInput {
        @InvocableVariable(label='Origin Port UN/LOCODE' required=true)
        public String origin;
        
        @InvocableVariable(label='Destination Port UN/LOCODE' required=false)
        public String destination;
        
        @InvocableVariable(label='Departure From Date' required=false)
        public Date departureFrom;
        
        @InvocableVariable(label='Departure To Date' required=false)
        public Date departureTo;
        
        @InvocableVariable(label='Number of Weeks' required=false description='2, 4, or 6 weeks from departureFrom')
        public Integer weeks;
        
        @InvocableVariable(label='Result Limit' required=false description='Max results (default: 100, max: 500)')
        public Integer resultLimit;
    }
    
    /**
     * @description Output result for schedule search
     */
    public class ScheduleSearchOutput {
        @InvocableVariable(label='Success')
        public Boolean success;
        
        @InvocableVariable(label='Schedules Data')
        public String schedulesData;
        
        @InvocableVariable(label='Total Results')
        public Integer totalResults;
        
        @InvocableVariable(label='Error Message')
        public String errorMessage;
    }
    
    /**
     * @description Search vessel schedules (invocable from Flow)
     * @param inputs List of ScheduleSearchInput
     * @return List<ScheduleSearchOutput> List of search results
     */
    @InvocableMethod(label='Search Vessel Schedules' category='RMS' description='Search for vessel schedules by origin, destination, and date range')
    public static List<ScheduleSearchOutput> searchSchedules(List<ScheduleSearchInput> inputs) {
        List<ScheduleSearchOutput> outputs = new List<ScheduleSearchOutput>();
        
        for (ScheduleSearchInput input : inputs) {
            ScheduleSearchOutput output = new ScheduleSearchOutput();
            
            try {
                Map<String, Object> response = RMSScheduleService.searchSchedules(
                    input.origin,
                    input.destination,
                    input.departureFrom,
                    input.departureTo,
                    input.weeks,
                    input.resultLimit
                );
                
                output.success = (Boolean) response.get('success');
                output.schedulesData = JSON.serialize(response.get('data'));
                
                Map<String, Object> metadata = (Map<String, Object>) response.get('metadata');
                if (metadata != null && metadata.containsKey('total_results')) {
                    output.totalResults = (Integer) metadata.get('total_results');
                }
                
            } catch (Exception e) {
                output.success = false;
                output.errorMessage = e.getMessage();
                output.totalResults = 0;
            }
            
            outputs.add(output);
        }
        
        return outputs;
    }
}

