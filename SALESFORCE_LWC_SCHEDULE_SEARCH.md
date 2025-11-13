# Salesforce LWC - Vessel Schedule Search

## Overview

This document describes the Salesforce Lightning Web Component (LWC) for searching vessel schedules, integrated with the RMS V4 Schedules API.

## Components Created

### 1. Apex Service Class
- **File**: `force-app/main/default/classes/RMSScheduleService.cls`
- **Purpose**: Service class for vessel schedule operations
- **Methods**:
  - `searchSchedules()` - Search schedules with parameters
  - `getSchedules()` - Get schedules with filters (for LWC)

### 2. Apex Action Class
- **File**: `force-app/main/default/classes/RMSScheduleAction.cls`
- **Purpose**: Invocable action for Flow integration
- **Methods**:
  - `searchSchedules()` - Invocable method for Flows

### 3. Lightning Web Component
- **Component Name**: `scheduleSearch`
- **Files**:
  - `scheduleSearch.js` - Component logic
  - `scheduleSearch.html` - Component template
  - `scheduleSearch.css` - Component styling
  - `scheduleSearch.js-meta.xml` - Component metadata

## Features

### Search Functionality
- **Origin Port** (Required): UN/LOCODE (e.g., INNSA)
- **Destination Port** (Optional): UN/LOCODE (e.g., NLRTM)
- **Departure From** (Optional): Start date (defaults to today)
- **Departure To** (Optional): End date
- **Weeks** (Optional): 2, 4, or 6 weeks from departure from
- **Limit** (Optional): Max results (default: 100, max: 500)

### Client-Side Filtering
- **Carrier**: Filter by carrier name
- **Service**: Filter by service name or code
- **Vessel**: Filter by vessel name
- **Voyage**: Filter by voyage number
- **Direct Only**: Show only direct routes
- **ETA From**: Filter by arrival date from
- **ETA To**: Filter by arrival date to

### Sorting
- Sort by ETD (Estimated Time of Departure)
- Sort by ETA (Estimated Time of Arrival)
- Sort by Transit Time Days
- Ascending/Descending order

### Display
- **Schedule Table**: Shows all schedule information
- **Pagination**: 20 schedules per page
- **Route Type Badges**: Direct or Transshipment
- **Vessel Information**: Name, IMO number
- **Port Information**: Port names and UN/LOCODEs
- **Service Information**: Service name and code

## API Integration

### Endpoint
- **URL**: `/api/v4/schedules/search`
- **Method**: POST
- **Authentication**: JWT Token + Tenant ID (via Named Credential)

### Request Format
```json
{
  "origin": "INNSA",
  "destination": "NLRTM",
  "departure_from": "2025-11-18",
  "departure_to": "2025-12-18",
  "weeks": 4,
  "limit": 100
}
```

### Response Format
```json
{
  "success": true,
  "data": [
    {
      "carrier": "MAERSK",
      "etd": "2025-11-18T00:00:00.000Z",
      "eta": "2025-12-13T00:00:00.000Z",
      "transit_time_days": 25,
      "service_code": "471",
      "service_name": "AE7 Service",
      "voyage": "545W",
      "vessel_name": "AL RIFFA",
      "vessel_imo": "9525912",
      "origin_port_code": "INNSA",
      "origin_port_name": "Nhava Sheva",
      "destination_port_code": "NLRTM",
      "destination_port_name": "Rotterdam",
      "route_name": "AE7 Service",
      "is_direct": true,
      "legs": [...],
      "source": "maersk"
    }
  ],
  "metadata": {
    "api_version": "v4",
    "generated_at": "2025-11-12T14:46:15.000Z",
    "origin": "INNSA",
    "destination": "NLRTM",
    "departure_from": "2025-11-18",
    "departure_to": "2025-12-18",
    "total_results": 25
  }
}
```

## Deployment

### Prerequisites
1. Salesforce org with proper permissions
2. RMS API server running and accessible
3. Named Credential configured (`RMS_API`)
4. Apex classes deployed

### Deployment Steps
1. Deploy Apex classes:
   ```bash
   sfdx force:source:deploy -p force-app/main/default/classes/RMSScheduleService.cls
   sfdx force:source:deploy -p force-app/main/default/classes/RMSScheduleAction.cls
   ```

2. Deploy LWC component:
   ```bash
   sfdx force:source:deploy -p force-app/main/default/lwc/scheduleSearch
   ```

3. Add component to App Page:
   - Go to Setup → App Builder
   - Create or edit an App Page
   - Add `scheduleSearch` component
   - Activate the page

## Usage

### In Salesforce
1. Navigate to the App Page with the `scheduleSearch` component
2. Enter origin port (required)
3. Optionally enter destination port, dates, weeks, or limit
4. Click "Search Schedules"
5. Use filters to refine results
6. Sort by clicking column headers
7. Navigate pages using pagination

### In Flow
1. Create a Flow
2. Add "Search Vessel Schedules" action (RMSScheduleAction)
3. Configure input parameters
4. Use output variables in flow logic

## Error Handling

### Apex Level
- `AuraHandledException` for user-friendly error messages
- Exception handling for API errors
- Validation for required fields

### LWC Level
- Toast notifications for errors
- Error message display
- Loading states
- Empty state messages

## Testing

### Test Search
1. Search with origin only: `INNSA`
2. Search with origin and destination: `INNSA` → `NLRTM`
3. Search with date range
4. Search with weeks parameter
5. Test filters (carrier, service, vessel, voyage)
6. Test sorting (ETD, ETA, transit time)
7. Test pagination
8. Test error handling (invalid port codes, network errors)

### Test Cases
- ✅ Required field validation (origin)
- ✅ Date validation
- ✅ Weeks validation (2, 4, or 6)
- ✅ Limit validation (1-500)
- ✅ Client-side filtering
- ✅ Sorting functionality
- ✅ Pagination
- ✅ Error handling
- ✅ Loading states
- ✅ Empty states

## Common Port UN/LOCODEs

### Indian Ports
- `INMUN` - Mundra
- `INNSA` - Nhava Sheva
- `INCCU` - Kolkata
- `INCOK` - Cochin
- `INMAA` - Chennai

### European Ports
- `NLRTM` - Rotterdam
- `DEHAM` - Hamburg
- `GBLGP` - London Gateway
- `BEANR` - Antwerp

### US Ports
- `USNYC` - New York
- `USLGB` - Long Beach
- `USSAV` - Savannah
- `USHOU` - Houston

### Middle East
- `AEJEA` - Jebel Ali
- `OMSLL` - Salalah

## Troubleshooting

### No Schedules Found
1. Verify port codes are correct UN/LOCODEs
2. Check date range (schedules must be in the future)
3. Verify RMS API server is running
4. Check Named Credential configuration
5. Verify tenant ID is correct

### API Errors
1. Check RMS API server logs
2. Verify authentication token is valid
3. Check Named Credential endpoint
4. Verify tenant ID in RMSApiUtil

### Component Not Loading
1. Check component is deployed
2. Verify component is added to App Page
3. Check browser console for errors
4. Verify Apex classes are deployed
5. Check user permissions

## Future Enhancements

### Potential Additions
- Export to CSV/Excel
- Schedule comparison
- Favorite routes
- Schedule alerts
- Route visualization
- Vessel tracking
- Port information
- Service information
- Carrier information

## Related Documentation

- [API Documentation V4](./API_DOCUMENTATION_V4.md)
- [Schedule API Reference](./SCHEDULE_API_REFERENCE.md)
- [n8n Schedules Workflow Guide](./docs/n8n-schedules-workflow-guide.md)
- [Salesforce Flow Guide](./SALESFORCE_FLOW_GUIDE.md)

## Support

For issues or questions:
1. Check Salesforce debug logs
2. Check RMS API server logs
3. Verify all configurations are correct
4. Review error messages in component
5. Test API directly with curl/Postman

---

**Last Updated**: 2025-01-27  
**Component Version**: 1.0.0  
**API Version**: V4

