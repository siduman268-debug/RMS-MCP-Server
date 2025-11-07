# Maersk API transitTime Unit - CONFIRMED

## ✅ Confirmed: transitTime is in DAYS

### Evidence from API Response

From the actual Maersk API response:
```json
{
  "transitTime": 34,
  "placeOfReceipt": {
    "dateTime": "2025-11-06T21:12:00+05:30"
  },
  "placeOfDelivery": {
    "dateTime": "2025-12-11T02:02:00+01:00"
  }
}
```

### Analysis

1. **Raw transitTime value**: `34`
2. **Calculated from dates**: `34.4 days` (from 2025-11-06 to 2025-12-11)
3. **If transitTime were hours**: `34 / 24 = 1.4 days` ❌ (way too low)
4. **If transitTime were days**: `34 days` ✅ (matches calculated 34.4 days)

### Conclusion

**transitTime is in DAYS**, not hours.

The code now:
- ✅ Uses transitTime directly as days (no division by 24)
- ✅ Calculates from dates when available (more accurate, accounts for timezones)
- ✅ Falls back to transitTime field if date calculation unavailable

### Code Update

Changed from:
```typescript
// OLD (incorrect - assumed hours)
transitTimeDays = earliestRoute.transitTime / 24;
```

To:
```typescript
// NEW (correct - confirmed to be days)
transitTimeDays = earliestRoute.transitTime;
```

