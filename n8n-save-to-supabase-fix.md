# Fix for "Save to Supabase" Node

The error "JSON parameter needs to be valid JSON" is because the JSON body syntax is incorrect.

## Current (Incorrect) Configuration:
```json
"jsonBody": "={\n  \"schedule\": {{ $json }}\n}"
```

## Fixed Configuration:

In the "Save to Supabase" node, update the JSON Body field to use one of these options:

### Option 1: Using Expression (Recommended)
Set the JSON Body to:
```
={{ { schedule: $json } }}
```

### Option 2: Using JSON.stringify
Set the JSON Body to:
```
={{ JSON.stringify({ schedule: $json }) }}
```

### Option 3: Using Body Parameters (Alternative approach)
Instead of using "jsonBody", you can use "Body Parameters":
1. Set "Specify Body" to "Using Fields Below"
2. Add a parameter:
   - Name: `schedule`
   - Value: `={{ $json }}`

## Steps to Fix:

1. Open the "Save to Supabase" node in n8n
2. Go to "Body" section
3. Make sure "Specify Body" is set to "JSON"
4. In the "JSON Body" field, replace the content with:
   ```
   ={{ { schedule: $json } }}
   ```
5. Save the node
6. Test the workflow again

This will properly construct the JSON body as:
```json
{
  "schedule": { ... normalized schedule data ... }
}
```

