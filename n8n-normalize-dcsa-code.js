// Transform Maersk vessel schedules to DCSA format
// This normalizes the payload for our API
// Input: Each item from "Fetch Vessel Schedules" contains the Maersk API response
// FIXED: Process ALL items, not just the first one

const allItems = $input.all();
const normalizedSchedules = [];

console.log(`Processing ${allItems.length} service responses from Fetch Vessel Schedules...`);

// Process each item from Fetch Vessel Schedules (one per service code)
for (let i = 0; i < allItems.length; i++) {
  const inputData = allItems[i].json;
  console.log(`[${i + 1}/${allItems.length}] Processing service: ${inputData.carrierServiceCode || 'UNKNOWN'}`);

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
      console.log(`  ⚠️ Unexpected response structure for item ${i + 1}:`, Object.keys(inputData));
      continue; // Skip this item and continue with next
    }
  }

  const serviceCode = vesselSchedulesData.carrierServiceCode || inputData.carrierServiceCode || 'UNKNOWN';
  const serviceName = vesselSchedulesData.carrierServiceName || inputData.carrierServiceName || 'Unknown Service';

  // Process vessel schedules
  const schedulesArray = Array.isArray(vesselSchedulesData.vesselSchedules) 
    ? vesselSchedulesData.vesselSchedules 
    : (Array.isArray(vesselSchedulesData) ? vesselSchedulesData : []);

  if (schedulesArray.length === 0) {
    console.log(`  ⚠️ No vessel schedules found for ${serviceCode}`);
    continue; // Skip this service and continue with next
  }

  console.log(`  ✓ Found ${schedulesArray.length} vessel schedule(s) for ${serviceCode}`);

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
        const timestamps = tc.timestamps || [];
        
        if (timestamps.length === 0) {
          // Log missing timestamps for first port call to help debug
          if (index === 0) {
            console.log(`  ⚠️  No timestamps found for transport call ${index + 1} (${tc.location?.UNLocationCode || 'UNKNOWN'})`);
            console.log(`     Available keys: ${Object.keys(tc).join(', ')}`);
            
            // Check for alternative timestamp formats
            if (tc.arrival) {
              console.log(`     Found 'arrival' field:`, tc.arrival);
              if (tc.arrival.planned) times.plannedArrival = tc.arrival.planned;
              if (tc.arrival.estimated) times.estimatedArrival = tc.arrival.estimated;
              if (tc.arrival.actual) times.actualArrival = tc.arrival.actual;
            }
            if (tc.departure) {
              console.log(`     Found 'departure' field:`, tc.departure);
              if (tc.departure.planned) times.plannedDeparture = tc.departure.planned;
              if (tc.departure.estimated) times.estimatedDeparture = tc.departure.estimated;
              if (tc.departure.actual) times.actualDeparture = tc.departure.actual;
            }
            if (tc.plannedArrival) times.plannedArrival = tc.plannedArrival;
            if (tc.plannedDeparture) times.plannedDeparture = tc.plannedDeparture;
            if (tc.estimatedArrival) times.estimatedArrival = tc.estimatedArrival;
            if (tc.estimatedDeparture) times.estimatedDeparture = tc.estimatedDeparture;
            if (tc.actualArrival) times.actualArrival = tc.actualArrival;
            if (tc.actualDeparture) times.actualDeparture = tc.actualDeparture;
          }
        } else {
          // Process timestamps array (DCSA format)
          for (const ts of timestamps) {
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
        }
        
        const hasTimes = Object.keys(times).length > 0;
        if (hasTimes && index === 0) {
          console.log(`  ✅ Times extracted for first port call: ${Object.keys(times).join(', ')}`);
        } else if (!hasTimes && index === 0) {
          console.log(`  ⚠️  No times extracted for first port call`);
        }
        
        return {
          unlocode: tc.location?.UNLocationCode || '',
          sequence: index + 1,
          facilitySMDG: tc.location?.facilitySMDGCode || null,
          facilityName: tc.location?.locationName || '',
          carrierImportVoyageNumber: tc.carrierImportVoyageNumber || null,
          carrierExportVoyageNumber: tc.carrierExportVoyageNumber || voyageNumber,
          transportCallReference: tc.transportCallReference || null,
          times: hasTimes ? times : undefined
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
} // End of loop for each item from Fetch Vessel Schedules

// Return each normalized schedule as a separate item
// This ensures n8n processes each schedule separately
if (normalizedSchedules.length === 0) {
  // Return empty array with error info for debugging
  console.log('⚠️ WARNING: No normalized schedules created from any service');
  return [{ 
    json: { 
      warning: 'No schedules found in any response',
      totalInputItems: allItems.length
    } 
  }];
}

console.log(`\n✅ Total normalized schedules created: ${normalizedSchedules.length}`);
console.log(`Services processed: ${new Set(normalizedSchedules.map(s => s.carrierServiceCode)).size}`);

return normalizedSchedules.map(schedule => ({
  json: schedule
}));

