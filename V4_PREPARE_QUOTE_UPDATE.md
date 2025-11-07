# V4 Prepare Quote - Updated to Use rate_id

## Changes Made

V4 prepare-quote has been updated to work like V2 - it now uses `rate_id` as input instead of automatically picking the preferred rate.

## New Request Format

**Before (old - preferred rate):**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "origin": "INNSA",
  "destination": "NLRTM",
  "container_type": "40HC",
  "container_count": 1
}
```

**After (new - rate_id):**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "rate_id": 74,
  "container_count": 1,
  "cargo_weight_mt": 10,        // Optional - required if inland port
  "haulage_type": "carrier"     // Optional - required if inland port
}
```

## Required Fields

- `salesforce_org_id` - Required
- `rate_id` - Required (get from search-rates results)

## Optional Fields

- `container_count` - Default: 1
- `cargo_weight_mt` - Required if origin/destination is inland
- `haulage_type` - Required if origin/destination is inland
- `include_earliest_departure` - Default: true

## Workflow

1. **Call V4 search-rates** to get available rates:
   ```json
   POST /api/v4/search-rates
   {
     "origin": "INNSA",
     "destination": "NLRTM",
     "container_type": "40HC"
   }
   ```

2. **Get rate_id** from the search results:
   ```json
   {
     "data": [
       {
         "rate_id": 74,
         "vendor": "Maersk",
         ...
       }
     ]
   }
   ```

3. **Call V4 prepare-quote** with the rate_id:
   ```json
   POST /api/v4/prepare-quote
   {
     "salesforce_org_id": "00DBE000002eBzh",
     "rate_id": 74,
     "container_count": 1
   }
   ```

## Features Still Included

✅ Automatic inland detection (from rate data)  
✅ Automatic inland haulage calculation  
✅ Earliest departure integration  
✅ origin/destination in response (from rate data)  
✅ All local charges calculation  

## Response Format

The response still includes `origin`/`destination` fields (extracted from the rate data):

```json
{
  "success": true,
  "data": {
    "route": {
      "origin": "INNSA",      // From rate data
      "destination": "NLRTM",  // From rate data
      "container_type": "40HC",
      "container_count": 1
    },
    "quote_parts": {...},
    "totals": {...},
    "metadata": {
      "rate_id": 74,           // Included in metadata
      ...
    }
  }
}
```

## Testing

After server restart, test with:
```powershell
# Get rate_id from search
$rateId = (Invoke-RestMethod ... -Body '{"origin":"INNSA","destination":"NLRTM","container_type":"40HC"}').data[0].rate_id

# Use rate_id in prepare-quote
Invoke-RestMethod ... -Body (@{salesforce_org_id="..."; rate_id=$rateId; container_count=1} | ConvertTo-Json)
```

