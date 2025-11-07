# Maersk API Fallback Implementation

## ✅ Implementation Complete

The Maersk Point-to-Point API fallback has been successfully implemented and tested.

## How It Works

### Two-Tier System

1. **PRIMARY: Database View** (`v_port_to_port_routes`)
   - Queries Supabase view first
   - Fast and reliable
   - Uses rate's `transit_days` for accurate transit time

2. **FALLBACK: Maersk Point-to-Point API**
   - Only used if database doesn't have the route
   - Only for Maersk carrier
   - Calls `/ocean/commercial-schedules/dcsa/v1/point-to-point-routes`
   - Converts transit time from hours to days

## Implementation Details

### Code Location
- `src/services/schedule-integration.service.ts`
- Method: `getEarliestDepartureFromMaerskAPI()`

### Key Features

1. **Destination Required**: The Maersk API requires both origin and destination for point-to-point lookup
2. **Earliest Route Selection**: Finds the earliest departure from multiple routes returned
3. **Vessel Information Extraction**: Extracts vessel name, IMO, voyage number from ocean leg
4. **Transit Time Conversion**: Converts Maersk's transit time (hours) to days
5. **Rate Transit Days Override**: Uses rate's `transit_days` if provided (more accurate)

## Test Results

✅ **Test Successful**: INNSA → NLRTM (Nhava Sheva → Rotterdam)

```
Found: True
ETD: 2025-11-06T21:12:00+05:30
Carrier: MAERSK
Vessel: ALULA EXPRESS
Voyage: 544W
Transit Time: 20 days ✅ (Correct! Previously showed 3.4 days)
```

## Data Flow

```
1. V4 API calls getEarliestDeparture(origin, carrier, destination, rateTransitDays)
   ↓
2. Try Database View (v_port_to_port_routes)
   ↓
   ✅ Found? → Return with rate's transit_days
   ↓
   ❌ Not Found?
   ↓
3. Try Maersk API (if carrier = MAERSK and destination provided)
   ↓
   ✅ Found? → Return with converted transit time
   ↓
   ❌ Not Found? → Return { found: false }
```

## API Response Structure

The Maersk API returns:
- `placeOfReceipt.dateTime` - Earliest departure
- `placeOfDelivery.dateTime` - Arrival
- `transitTime` - Transit time in hours
- `legs[]` - Route legs with vessel information
- `servicePartners[]` - Carrier service details

## Benefits

1. **Accurate Transit Times**: Uses rate's transit_days instead of schedule segment times
2. **Fallback Support**: Works even if database doesn't have schedule data
3. **Real-time Data**: Maersk API provides up-to-date schedule information
4. **Correct Route Matching**: Filters by destination to get the right route

## Notes

- The fallback only activates if:
  - Database view doesn't have the route
  - Carrier is "MAERSK"
  - Destination is provided
  - DCSA client is configured

- Transit time from rate (`rateTransitDays`) always takes precedence over schedule transit time for accuracy.

