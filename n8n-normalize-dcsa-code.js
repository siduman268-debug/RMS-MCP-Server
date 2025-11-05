// Transform Maersk vessel schedules to DCSA format
// This normalizes the payload for our API
// Input: Each item from "Fetch Vessel Schedules" contains the Maersk API response

const inputData = $input.item.json;
const normalizedSchedules = [];

// The Maersk vessel schedules API returns an array of schedule responses
// Each response contains: carrierServiceCode, carrierServiceName, vesselSchedules[]
let vesselSchedulesData = inputData;

// Handle case where response is wrapped in an array
if (Array.isArray(inputData) && inputData.length > 0) {
  vesselSchedulesData = inputData[0];
}

// Ensure we have vesselSchedules array
if (!vesselSchedulesData.vesselSchedules || !Array.isArray(vesselSchedulesData.vesselSchedules)) {
  // If structure is different, try to extract from response
  if (Array.isArray(inputData)) {
    vesselSchedulesData = inputData;
  } else {
    console.log('Unexpected response structure:', JSON.stringify(inputData, null, 2));
    return [{ json: { error: 'Unexpected response structure', received: Object.keys(inputData) } }];
  }
}

const serviceCode = vesselSchedulesData.carrierServiceCode || inputData.carrierServiceCode || 'UNKNOWN';
const serviceName = vesselSchedulesData.carrierServiceName || inputData.carrierServiceName || 'Unknown Service';

// Process vessel schedules
const schedulesArray = Array.isArray(vesselSchedulesData.vesselSchedules) 
  ? vesselSchedulesData.vesselSchedules 
  : (Array.isArray(vesselSchedulesData) ? vesselSchedulesData : []);

for (const vesselSchedule of schedulesArray) {
  const vessel = vesselSchedule.vessel || {};
  const transportCalls = vesselSchedule.transportCalls || [];
  
  // Group by voyage number (export voyage)
  const voyageGroups = new Map();
  
  for (const tc of transportCalls) {
    const voyageKey = tc.carrierExportVoyageNumber || 'UNKNOWN';
    if (!voyageGroups.has(voyageKey)) {
      voyageGroups.set(voyageKey, []);
    }
    voyageGroups.get(voyageKey).push(tc);
  }
  
  // Create a DCSA schedule for each voyage
  for (const [voyageNumber, calls] of voyageGroups.entries()) {
    // Sort transport calls by time
    const sortedCalls = [...calls].sort((a, b) => {
      const aTime = a.timestamps?.[0]?.eventDateTime || '';
      const bTime = b.timestamps?.[0]?.eventDateTime || '';
      return aTime.localeCompare(bTime);
    });
    
    // Transform to DCSA port calls
    const portCalls = sortedCalls.map((tc, index) => {
      const times = {};
      
      // Extract times from timestamps
      for (const ts of (tc.timestamps || [])) {
        const isArrival = ts.eventTypeCode === 'ARRI';
        const isDeparture = ts.eventTypeCode === 'DEPA';
        
        if (isArrival && ts.eventClassifierCode === 'PLN') {
          times.plannedArrival = ts.eventDateTime;
        } else if (isArrival && ts.eventClassifierCode === 'EST') {
          times.estimatedArrival = ts.eventDateTime;
        } else if (isArrival && ts.eventClassifierCode === 'ACT') {
          times.actualArrival = ts.eventDateTime;
        } else if (isDeparture && ts.eventClassifierCode === 'PLN') {
          times.plannedDeparture = ts.eventDateTime;
        } else if (isDeparture && ts.eventClassifierCode === 'EST') {
          times.estimatedDeparture = ts.eventDateTime;
        } else if (isDeparture && ts.eventClassifierCode === 'ACT') {
          times.actualDeparture = ts.eventDateTime;
        }
      }
      
      return {
        unlocode: tc.location?.UNLocationCode || '',
        sequence: index + 1,
        facilitySMDG: tc.location?.facilitySMDGCode || null,
        facilityName: tc.location?.locationName || '',
        carrierImportVoyageNumber: tc.carrierImportVoyageNumber || null,
        carrierExportVoyageNumber: tc.carrierExportVoyageNumber || voyageNumber,
        transportCallReference: tc.transportCallReference || null,
        times: Object.keys(times).length > 0 ? times : undefined
      };
    });
    
    // Create DCSA schedule message
    normalizedSchedules.push({
      carrierName: 'MAERSK',
      carrierServiceCode: serviceCode,
      serviceName: serviceName,
      carrierVoyageNumber: voyageNumber,
      vesselIMO: vessel.vesselIMONumber || null,
      vesselName: vessel.name || 'Unknown',
      source: 'MAERSK',
      portCalls: portCalls
    });
  }
}

// Return each normalized schedule as a separate item
// This ensures n8n processes each schedule separately
if (normalizedSchedules.length === 0) {
  // Return empty array with error info for debugging
  return [{ 
    json: { 
      warning: 'No schedules found in response',
      serviceCode: serviceCode,
      serviceName: serviceName,
      inputKeys: Object.keys(inputData)
    } 
  }];
}

return normalizedSchedules.map(schedule => ({
  json: schedule
}));

