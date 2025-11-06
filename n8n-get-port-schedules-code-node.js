// Get Port Schedules for Each Date from Loop Over Service
// Replace HTTP Request node with this Code node
// This processes each item from Loop Over Service individually

const items = $input.all();
const results = [];
const apiBaseUrl = 'https://api.maersk.com/ocean/commercial-schedules/dcsa/v1/port-schedules';
const consumerKey = 'u8JRFDFIc701AN1QAyzBmZOjR35Y7oF9';

console.log(`Processing ${items.length} items from Loop Over Service...`);

// Process each item individually
for (let i = 0; i < items.length; i++) {
  const item = items[i].json;
  const location = item.location || 'INMUN';
  const date = item.date;
  
  console.log(`[${i + 1}/${items.length}] Fetching port schedules for ${location} on ${date}`);
  
  try {
    // Build URL with query parameters
    let url = apiBaseUrl;
    url += '?UNLocationCode=' + encodeURIComponent(location);
    url += '&date=' + encodeURIComponent(date);
    
    // Make HTTP request using n8n's helper
    const response = await this.helpers.request({
      method: 'GET',
      url: url,
      headers: {
        'Consumer-Key': consumerKey
      },
      json: true // Automatically parse JSON response
    });
    
    // Handle different response formats
    let portSchedules = [];
    
    if (Array.isArray(response)) {
      // If response is directly an array
      portSchedules = response;
    } else if (response.data && Array.isArray(response.data)) {
      // If response has a data property
      portSchedules = response.data;
    } else if (response.portSchedules && Array.isArray(response.portSchedules)) {
      // If response has portSchedules property
      portSchedules = response.portSchedules;
    } else {
      // Single object - wrap in array
      portSchedules = [response];
    }
    
    // Add each port schedule as a separate output item
    // Also include the original date/fromDate/toDate for reference
    for (const portSchedule of portSchedules) {
      results.push({
        json: {
          ...portSchedule,
          // Keep original metadata
          _originalDate: date,
          _originalLocation: location,
          fromDate: item.fromDate,
          toDate: item.toDate
        }
      });
    }
    
    console.log(`  ✓ Got ${portSchedules.length} port schedule(s) for ${date}`);
    
  } catch (error) {
    console.error(`  ✗ Error fetching ${date}:`, error.message);
    // Return error as output item so workflow can continue
    results.push({
      json: {
        error: error.message,
        location: location,
        date: date,
        fromDate: item.fromDate,
        toDate: item.toDate
      }
    });
  }
}

console.log(`\nTotal results: ${results.length} items`);
return results;



