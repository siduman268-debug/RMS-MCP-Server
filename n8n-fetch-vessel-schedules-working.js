// Fetch Vessel Schedules for Each Service Code
// FIXED: Uses n8n's proper request method

const items = $input.all();
const results = [];
const apiBaseUrl = 'https://api.maersk.com/ocean/commercial-schedules/dcsa/v1/vessel-schedules';
const consumerKey = 'u8JRFDFIc701AN1QAyzBmZOjR35Y7oF9'; // Your Consumer Key

console.log(`Processing ${items.length} service codes...`);

for (let i = 0; i < items.length; i++) {
  const item = items[i].json;
  const serviceCode = item.carrierServiceCode;
  const serviceName = item.carrierServiceName;
  const fromDate = item.fromDate;
  const toDate = item.toDate;
  
  console.log(`[${i + 1}/${items.length}] Fetching: ${serviceCode} - ${serviceName}`);
  
  try {
    // Build URL with query parameters manually
    let url = apiBaseUrl;
    url += '?carrierServiceCode=' + encodeURIComponent(serviceCode);
    url += '&fromDate=' + encodeURIComponent(fromDate);
    url += '&toDate=' + encodeURIComponent(toDate);
    
    console.log(`Making request to: ${url}`);
    
    // Make HTTP request using n8n's helper method
    const response = await this.helpers.request({
      method: 'GET',
      url: url,
      headers: {
        'Consumer-Key': consumerKey
      },
      json: true // Automatically parse JSON response
    });
    
    // Handle response - could be array or single object
    let schedules = [];
    if (Array.isArray(response)) {
      schedules = response;
    } else if (response.data && Array.isArray(response.data)) {
      schedules = response.data;
    } else if (response.data) {
      schedules = [response.data];
    } else {
      schedules = [response];
    }
    
    // Add service metadata to each schedule
    for (const schedule of schedules) {
      if (!schedule.carrierServiceCode) {
        schedule.carrierServiceCode = serviceCode;
      }
      if (!schedule.carrierServiceName) {
        schedule.carrierServiceName = serviceName;
      }
      
      // Add as output item
      results.push({
        json: schedule
      });
    }
    
    console.log(`✅ Got ${schedules.length} schedule(s) for ${serviceCode}`);
    
    // 1 second delay between requests to avoid rate limiting
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error(`❌ Error for ${serviceCode}:`, error.message);
    
    // Add error item so workflow continues
    results.push({
      json: {
        carrierServiceCode: serviceCode,
        carrierServiceName: serviceName,
        error: error.message || 'Unknown error',
        fromDate: fromDate,
        toDate: toDate
      }
    });
  }
}

console.log(`\n=== Complete: ${results.length} results from ${items.length} services ===`);

return results;






