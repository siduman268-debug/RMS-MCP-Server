# RMS Demo Quick Reference
## October 17th, 2025

---

## 🚀 Quick Start Commands

### Start RMS Server
```bash
cd rms-mcp-server
npm run dev
# Server runs on http://localhost:3000
```

### Test API Health
```bash
curl http://localhost:3000/health
```

### Get JWT Token
```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "00000000-0000-0000-0000-000000000001", "user_id": "demo_user"}'
```

---

## 🎯 Demo Scenarios

### Scenario 1: Email Auto Quote (V1 API)
```bash
curl -X POST http://localhost:3000/api/prepare-quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 2
  }'
```

### Scenario 2: Search Rates
```bash
curl -X POST http://localhost:3000/api/v2/search-rates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "salesforce_org_id": "00DBE000002eBzh"
  }'
```

### Scenario 3: Generate Quote
```bash
curl -X POST http://localhost:3000/api/v2/prepare-quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{
    "salesforce_org_id": "00DBE000002eBzh",
    "rate_id": 71,
    "container_count": 2
  }'
```

### Scenario 4: MCP Claude Demo
**Claude Desktop Commands**:
```
User: "Find me the best rate for 2 containers from Mumbai to Rotterdam"
Claude: [Uses price_enquiry tool automatically]

User: "Compare rates across different carriers for Mumbai to Rotterdam"
Claude: [Uses search_rates tool, analyzes results]

User: "What's the margin on the Mumbai to Rotterdam route?"
Claude: [Analyzes pricing data, provides insights]

User: "Create a new freight rate for Mumbai to Rotterdam"
Claude: [Uses create_freight_rate tool]
```

---

## 📊 Expected Results

### Rate Search Response
```json
{
  "success": true,
  "data": [
    {
      "vendor": "MSC",
      "route": "Nhava Sheva (JNPT) (INNSA) → Rotterdam (NLRTM)",
      "container_type": "40HC",
      "transit_days": 18,
      "pricing": {
        "ocean_freight_buy": 1950,
        "all_in_freight_sell": 2463.84,
        "currency": "USD"
      },
      "is_preferred": true,
      "rate_id": 71
    }
  ]
}
```

### Quote Response
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "route": {
      "pol": "INNSA",
      "pod": "NLRTM",
      "container_type": "40HC",
      "container_count": 2
    },
    "totals": {
      "grand_total_usd": 6089.54,
      "currency": "USD"
    },
    "quote_parts": {
      "ocean_freight": {
        "carrier": "MSC",
        "transit_days": 18
      }
    }
  }
}
```

---

## 🔧 Troubleshooting

### Common Issues
1. **401 Unauthorized**: Check JWT token and tenant ID
2. **No rates found**: Verify port codes exist in database
3. **500 Server Error**: Check Supabase connection
4. **Slow response**: Check database indexes

### Quick Fixes
```bash
# Restart server
npm run dev

# Check logs
tail -f server-debug.log

# Test database connection
curl http://localhost:3000/health
```

---

## 📱 Demo URLs
- **API Health**: http://localhost:3000/health
- **API Docs**: See API_DOCUMENTATION.md
- **n8n Workflows**: 
  - Import `n8n-auto-quote-workflow.json` (V2 intelligent selection)
  - Import `n8n-email-auto-quote-workflow.json` (V1 email-to-email)
- **Supabase**: Check dashboard for data

---

## 🎤 Key Talking Points
1. **"From hours to minutes"** - Time savings
2. **"Intelligent automation"** - Smart rate selection
3. **"Seamless integration"** - Salesforce compatibility
4. **"Enterprise security"** - Multi-tenant architecture
5. **"Real-time processing"** - Live rate updates
6. **"AI-powered future"** - MCP integration with Claude and future agents

---

## 📋 Demo Checklist
- [ ] Server running on port 3000
- [ ] Database has sample data
- [ ] JWT token generated
- [ ] n8n workflows imported
- [ ] Test scenarios prepared
- [ ] Backup plans ready
- [ ] Stakeholders briefed

---

*Ready to showcase the complete RMS solution! 🚢*
