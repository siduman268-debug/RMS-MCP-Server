// Set Parameters for Maersk - Multiple Indian Ports
// Use this in the "Set Parameters" node for the Maersk workflow

// Maersk-served Indian ports
const maerskIndianPorts = [
  { code: 'INMUN', name: 'Mundra' },
  { code: 'INNSA', name: 'Nhava Sheva (JNPT)' },
  { code: 'INCCU', name: 'Kolkata' },
  { code: 'INMAA', name: 'Chennai' },
  { code: 'INCOK', name: 'Cochin' },
  { code: 'INHZA', name: 'Hazira' },
  { code: 'INKRI', name: 'Krishnapatnam' },
  { code: 'INVIZ', name: 'Vizag' }
];

// Carrier-specific configuration
const carrier = 'MAERSK';
const apiBaseUrl = 'https://api.maersk.com/ocean/commercial-schedules/dcsa/v1';
const consumerKey = 'u8JRFDFIc701AN1QAyzBmZOjR35Y7oF9'; // Maersk Consumer Key

// Date range configuration
const today = new Date();
const fromDate = new Date(today);
fromDate.setDate(today.getDate()); // Start from today

const toDate = new Date(today);
toDate.setDate(today.getDate() + 210); // 210 days ahead (30 weeks)

// Generate dates (weekly intervals)
const dates = [];
const currentDate = new Date(fromDate);

while (currentDate <= toDate) {
  dates.push(new Date(currentDate).toISOString().split('T')[0]);
  currentDate.setDate(currentDate.getDate() + 7); // Weekly intervals
}

// Generate items: one for each port-date combination
const items = [];

for (const port of maerskIndianPorts) {
  for (const date of dates) {
    items.push({
      json: {
        carrier: carrier,
        location: port.code,
        locationName: port.name,
        date: date,
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
        apiBaseUrl: apiBaseUrl,
        consumerKey: consumerKey
      }
    });
  }
}

console.log(`[${carrier}] Generated ${items.length} items for ${maerskIndianPorts.length} ports and ${dates.length} dates`);
console.log(`Ports: ${maerskIndianPorts.map(p => p.code).join(', ')}`);

return items;





