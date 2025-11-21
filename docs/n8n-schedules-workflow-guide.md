# n8n Salesforce V4 Schedules Workflow Guide

## Overview

This n8n workflow provides a Salesforce webhook integration for the RMS V4 Schedules API. It allows Salesforce to search for vessel schedules independently of rates.

## Workflow File

`n8n-salesforce-v4-schedules-workflow.json`

## Workflow Structure

1. **Salesforce Webhook** - Receives POST requests from Salesforce
2. **Get Tenant ID from Supabase** - Looks up tenant_id based on salesforce_org_id
3. **Get JWT Token** - Authenticates with RMS API
4. **Call RMS Schedules API** - Calls `/api/v4/schedules/search`
5. **Respond to Webhook** - Returns schedule data to Salesforce

## Setup Instructions

### 1. Import Workflow to n8n

1. Open n8n
2. Click **Workflows** → **Import from File**
3. Select `n8n-salesforce-v4-schedules-workflow.json`
4. The workflow will be imported

### 2. Configure Supabase Credentials

Update the **Get Tenant ID from Supabase** node:
- Replace `YOUR_SUPABASE_ANON_KEY` with your actual Supabase anon key

### 3. Activate Webhook

1. Click on the **Salesforce Webhook** node
2. Click **Listen for Test Event** to activate the webhook
3. Copy the webhook URL (e.g., `http://your-n8n-instance.com/webhook/salesforce-rms-v4-schedules`)

### 4. Configure Salesforce

In Salesforce, create a webhook callout that sends POST requests to the n8n webhook URL.

## Request Format from Salesforce

Salesforce should send a POST request with the following JSON body:

```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "origin": "INNSA",
  "destination": "NLRTM",
  "departure_from": "2025-11-18",
  "departure_to": "2025-12-18",
  "weeks": 4,
  "limit": 100
}
```

### Field Descriptions

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `salesforce_org_id` | ✅ Yes | Salesforce Organization ID | `"00DBE000002eBzh"` |
| `origin` | ✅ Yes | Origin port UN/LOCODE | `"INNSA"` |
| `destination` | ❌ No | Destination port UN/LOCODE | `"NLRTM"` |
| `departure_from` | ❌ No | Start date (YYYY-MM-DD). Defaults to today | `"2025-11-18"` |
| `departure_to` | ❌ No | End date (YYYY-MM-DD) | `"2025-12-18"` |
| `weeks` | ❌ No | Number of weeks from `departure_from` (2, 4, or 6). Calculates `departure_to` automatically | `4` |
| `limit` | ❌ No | Max number of results (default: 100, max: 500) | `100` |

**Note**: If `weeks` is provided, `departure_to` will be calculated automatically. If both `weeks` and `departure_to` are provided, `departure_to` takes precedence.

## Response Format

The workflow returns the full API response:

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
    "total_results": 25,
    "note": "All filtering (carrier, service, vessel, voyage, is_direct, arrival dates) should be done client-side in the LWC"
  }
}
```

## Client-Side Filtering

**Important**: The API returns all schedules in the date range. Your Salesforce LWC should filter by:
- Carrier name
- Service code/name
- Vessel name
- Voyage number
- Direct-only routes (`is_direct: true`)
- Arrival dates (`eta`)

## Example Salesforce Apex Callout

```apex
public class RMS_Schedules_Service {
    private static final String WEBHOOK_URL = 'http://your-n8n-instance.com/webhook/salesforce-rms-v4-schedules';
    
    public static Map<String, Object> searchSchedules(
        String origin,
        String destination,
        Date departureFrom,
        Integer weeks
    ) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(WEBHOOK_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        
        Map<String, Object> body = new Map<String, Object>{
            'salesforce_org_id' => UserInfo.getOrganizationId(),
            'origin' => origin,
            'destination' => destination,
            'departure_from' => departureFrom != null ? 
                String.valueOf(departureFrom) : null,
            'weeks' => weeks
        };
        
        req.setBody(JSON.serialize(body));
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        return (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
    }
}
```

## Error Handling

The workflow will return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common errors:
- **400 Bad Request**: Missing required fields (e.g., `origin`)
- **401 Unauthorized**: Invalid or missing JWT token
- **500 Server Error**: Internal server error

## Testing

### Test in n8n

1. Click **Execute Workflow** button
2. In the **Salesforce Webhook** node, click **Listen for Test Event**
3. Use a tool like Postman or curl to send a test request:

```bash
curl -X POST http://your-n8n-instance.com/webhook/salesforce-rms-v4-schedules \
  -H "Content-Type: application/json" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "origin": "INNSA",
    "destination": "NLRTM",
    "departure_from": "2025-11-18",
    "weeks": 4
  }'
```

### Test from Salesforce

Create a test Apex class or use Anonymous Apex:

```apex
Map<String, Object> result = RMS_Schedules_Service.searchSchedules(
    'INNSA',
    'NLRTM',
    Date.today(),
    4
);
System.debug('Schedules: ' + JSON.serialize(result));
```

## Troubleshooting

### Webhook Not Receiving Requests

1. Ensure the webhook is activated (green indicator)
2. Check n8n logs for incoming requests
3. Verify the webhook URL is correct in Salesforce

### Authentication Errors

1. Verify Supabase anon key is correct
2. Check that `tenant_mapping` table has the correct `salesforce_org_id`
3. Verify RMS API server is running and accessible

### Empty Results

1. Check that schedules exist in the database for the date range
2. Verify port codes (origin/destination) are correct UN/LOCODEs
3. Check RMS API logs for any filtering issues

## Related Workflows

- `n8n-salesforce-v2-simplified-workflow.json` - Search rates and prepare quote
- `n8n-orchestrated-v1-v3-workflow.json` - V1/V3 orchestrated workflow

## Support

For issues:
1. Check n8n execution logs
2. Check RMS API server logs
3. Verify all credentials are correct
4. Test API directly with curl/Postman




