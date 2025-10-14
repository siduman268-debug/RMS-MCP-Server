# RMS (Rate Management System) - Product Requirements Document

## 📋 Executive Summary

### Product Vision
A comprehensive, multi-tenant Rate Management System (RMS) that enables freight forwarders and logistics providers to automate quote generation, manage complex multi-leg transportation routes, and integrate seamlessly with existing business systems.

### Target Markets
- **Primary**: India (Freight forwarding market: $15B+)
- **Secondary**: UAE (Logistics hub for Middle East: $8B+)

### Key Value Propositions
- 🚀 **Automated Quote Generation**: Email-to-quote in under 5 minutes
- 🌍 **Multi-Currency Support**: Real-time FX conversion with fallback rates
- 🏢 **Multi-Tenant Architecture**: Secure tenant isolation with database-level RLS
- 🛤️ **Advanced Routing**: Multi-leg road+rail+ocean transportation
- ⚖️ **Weight-Based Pricing**: Dynamic pricing based on container weight slabs
- 🔗 **System Integration**: Salesforce, n8n, and API-first architecture

---

## 🎯 Product Goals & Objectives

### Primary Goals
1. **Reduce Quote Generation Time**: From 2-4 hours to under 5 minutes
2. **Improve Quote Accuracy**: Eliminate manual errors in rate calculations
3. **Enable Multi-Tenant SaaS**: Support multiple freight forwarders on single platform
4. **Integrate with Existing Systems**: Seamless Salesforce and workflow automation

### Success Metrics
- **Technical KPIs**:
  - API Uptime: 99.9%
  - Response Time: < 2 seconds
  - Error Rate: < 0.1%
  - Security: Zero data breaches

- **Business KPIs**:
  - Quote Generation Time: < 5 minutes (email to quote)
  - User Adoption: 80% of target users active
  - Customer Satisfaction: 4.5+ rating
  - Revenue Impact: 20% increase in quote conversion

---

## 👥 User Personas & Use Cases

### Primary Users

#### 1. **Freight Forwarder Operations Manager** (India/UAE)
- **Profile**: 5-15 years experience, manages 10-50 staff
- **Pain Points**: Manual quote generation, currency conversion errors, rate management complexity
- **Goals**: Fast, accurate quotes, easy rate updates, multi-currency support
- **Use Cases**:
  - Generate quotes for customer inquiries
  - Update ocean freight rates and local charges
  - Manage multi-leg transportation routes
  - Track quote conversion rates

#### 2. **Sales Executive** (India/UAE)
- **Profile**: 2-8 years experience, customer-facing role
- **Pain Points**: Slow quote turnaround, complex rate calculations, customer follow-up
- **Goals**: Quick quotes for prospects, professional quote presentation, automated follow-up
- **Use Cases**:
  - Receive customer quote requests via email
  - Generate professional quotes automatically
  - Track quote status and customer responses
  - Follow up on pending quotes

#### 3. **Finance Manager** (India/UAE)
- **Profile**: 8-20 years experience, manages margins and pricing
- **Pain Points**: Margin tracking, currency exposure, pricing consistency
- **Goals**: Real-time margin tracking, currency risk management, pricing standardization
- **Use Cases**:
  - Monitor quote margins and profitability
  - Set currency conversion rates
  - Analyze pricing trends and market rates
  - Generate financial reports

### Secondary Users

#### 4. **Customers** (Importers/Exporters)
- **Profile**: Small to medium businesses in India/UAE
- **Pain Points**: Slow quote responses, unclear pricing breakdown
- **Goals**: Fast, transparent quotes, easy comparison
- **Use Cases**:
  - Submit quote requests via email
  - Receive detailed, professional quotes
  - Compare rates from multiple forwarders
  - Track shipment costs

---

## 🏗️ Technical Architecture

### System Components

#### 1. **API Server** (Fastify + TypeScript)
- **Multi-tenant JWT Authentication**
- **RESTful API endpoints**
- **Real-time currency conversion**
- **Docker containerization**

#### 2. **Database Layer** (Supabase PostgreSQL)
- **Row Level Security (RLS)**
- **Materialized views for performance**
- **Multi-tenant data isolation**
- **Real-time FX rate updates**

#### 3. **Integration Layer**
- **Salesforce Connector**
- **n8n Workflow Automation**
- **Gmail/Email Integration**
- **Webhook Support**

#### 4. **Business Logic Engine**
- **Quote Generation Algorithm**
- **Multi-leg Route Calculation**
- **Weight Slab Pricing**
- **Margin Management**

### Security Architecture

#### Multi-Tenant Security
- **Database-Level RLS**: All tables, views, and materialized views include tenant_id filtering
- **JWT Authentication**: 1-hour token expiration with tenant validation
- **Session Context**: Automatic tenant context setting for all database queries
- **API Rate Limiting**: Per-tenant rate limits and quotas

#### Data Protection
- **Encryption**: At rest and in transit
- **Audit Logging**: All API calls and data changes tracked
- **Backup & Recovery**: Automated daily backups with point-in-time recovery
- **Compliance**: GDPR-ready with data residency options

---

## 📊 Feature Specifications

### Phase 1: Core Features ✅ (Completed)

#### 1. **Authentication & Security**
- **JWT Token Generation**: `POST /api/auth/token`
- **Multi-Tenant Isolation**: Database-level RLS enforcement
- **Session Management**: Automatic tenant context setting
- **API Security**: Header validation and token verification

#### 2. **Rate Management**
- **Ocean Freight Search**: `POST /api/search-rates`
- **Local Charges Retrieval**: `POST /api/get-local-charges`
- **Quote Generation**: `POST /api/prepare-quote`
- **Multi-Currency Support**: Real-time FX conversion with fallback rates

#### 3. **API Infrastructure**
- **RESTful Endpoints**: Standard HTTP methods and responses
- **Error Handling**: Comprehensive error codes and messages
- **CORS Support**: Cross-origin requests for web integration
- **Health Monitoring**: `GET /health` endpoint

### Phase 2: Advanced Features 🚧 (In Development)

#### 4. **IHE (Inland Haulage Extension)**
- **Trigger Conditions**: Inland/ICD ports + carrier haulage
- **Dynamic Charge Addition**: Automatic IHE charges in quotes
- **Port Type Detection**: Database lookup for port classification
- **Charge Management**: CRUD operations for IHE charges

#### 5. **Multi-Leg Transportation**
- **Route Planning**: Road + Rail + Ocean combinations
- **Leg Management**: Individual leg pricing and charges
- **Route Optimization**: Best route selection algorithm
- **Transit Time Calculation**: End-to-end delivery estimates

#### 6. **Weight Slab Pricing**
- **Weight Categories**: Container weight-based pricing tiers
- **Dynamic Pricing**: Real-time weight-based rate calculation
- **Slab Management**: CRUD operations for weight slabs
- **Pricing Algorithms**: Complex pricing rule engine

### Phase 3: Integration Features 📋 (Planned)

#### 7. **Salesforce Integration**
- **Org ID Mapping**: Salesforce Org ID to tenant mapping
- **Data Synchronization**: Bidirectional data sync
- **Custom Objects**: RMS-specific Salesforce objects
- **Workflow Triggers**: Salesforce-to-RMS automation

#### 8. **n8n Workflow Automation**
- **Email-to-Quote**: Gmail trigger → AI parsing → Quote generation → Email response
- **Quote Follow-up**: Automated follow-up sequences
- **Rate Updates**: Automated rate synchronization
- **Customer Notifications**: Multi-channel notifications

#### 9. **Analytics & Reporting**
- **Quote Analytics**: Conversion rates, response times, margins
- **Usage Statistics**: API usage, tenant activity, performance metrics
- **Financial Reports**: Revenue, margins, currency exposure
- **Custom Dashboards**: Tenant-specific reporting

---

## 🔧 API Specifications

### Core Endpoints

#### Authentication
```http
POST /api/auth/token
Content-Type: application/json

{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "user_id": "sf_00D8Y000000ABC123"
}
```

#### Rate Management
```http
POST /api/search-rates
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json

{
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "vendor_name": "MSC"
}
```

#### Quote Generation
```http
POST /api/prepare-quote
Authorization: Bearer <jwt_token>
x-tenant-id: <tenant_uuid>
Content-Type: application/json

{
  "customer_name": "Acme Corp",
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "container_type": "40HC",
  "container_count": 2,
  "haulage_type": "carrier_haulage"
}
```

### Advanced Endpoints (Planned)

#### Rate Management CRUD
```http
POST /api/rates/ocean-freight     # Create rate
PUT /api/rates/ocean-freight/{id} # Update rate
DELETE /api/rates/ocean-freight/{id} # Delete rate
GET /api/rates/ocean-freight      # List rates
```

#### Multi-Leg Routes
```http
POST /api/routes/multi-leg        # Create multi-leg route
GET /api/routes/multi-leg/{id}    # Get route details
PUT /api/routes/multi-leg/{id}    # Update route
```

#### Weight Slab Management
```http
POST /api/weight-slabs            # Create weight slab
GET /api/weight-slabs             # List weight slabs
PUT /api/weight-slabs/{id}        # Update weight slab
```

---

## 🎨 User Experience Design

### API-First Approach
- **Consistent Responses**: Standard JSON format with success/error indicators
- **Clear Error Messages**: Descriptive error codes and messages
- **Comprehensive Documentation**: Interactive API documentation
- **SDK Support**: JavaScript/TypeScript SDK for easy integration

### Workflow Integration
- **Email Triggers**: Gmail integration for quote requests
- **AI Parsing**: Natural language processing for email content
- **Automated Responses**: Professional quote delivery via email
- **Status Tracking**: Real-time quote status updates

### Dashboard Interface (Future)
- **Quote Management**: View, edit, and track quotes
- **Rate Management**: Manage ocean freight and local charges
- **Analytics**: Performance metrics and reporting
- **User Management**: Tenant and user administration

---

## 📈 Market Analysis

### India Market
- **Market Size**: $15B+ freight forwarding market
- **Key Players**: 2000+ freight forwarders
- **Growth Rate**: 8-10% annually
- **Opportunities**: Digital transformation, automation adoption
- **Challenges**: Currency volatility, complex regulations

### UAE Market
- **Market Size**: $8B+ logistics hub
- **Key Players**: 500+ freight forwarders
- **Growth Rate**: 6-8% annually
- **Opportunities**: Regional hub, multi-modal transport
- **Challenges**: Competition, pricing pressure

### Competitive Landscape
- **Direct Competitors**: FreightOS, ShipBob, Flexport
- **Indirect Competitors**: Traditional freight forwarders with manual processes
- **Competitive Advantages**: Multi-tenant architecture, advanced routing, weight-based pricing

---

## 🚀 Go-to-Market Strategy

### Target Customer Segments

#### Tier 1: Large Freight Forwarders (India/UAE)
- **Size**: 100-1000 employees
- **Revenue**: $10M-$100M annually
- **Pain Points**: Manual processes, scaling challenges, system integration
- **Value Prop**: Automation, efficiency, competitive advantage
- **Sales Strategy**: Direct sales, enterprise contracts

#### Tier 2: Mid-Market Freight Forwarders (India/UAE)
- **Size**: 20-100 employees
- **Revenue**: $2M-$10M annually
- **Pain Points**: Limited resources, technology gaps, growth constraints
- **Value Prop**: Cost-effective automation, professional quotes, scalability
- **Sales Strategy**: Inside sales, partner channels

#### Tier 3: Small Freight Forwarders (India/UAE)
- **Size**: 5-20 employees
- **Revenue**: $500K-$2M annually
- **Pain Points**: Manual processes, limited technology, customer acquisition
- **Value Prop**: Professional appearance, time savings, growth enablement
- **Sales Strategy**: Self-service, online onboarding

### Pricing Strategy

#### Subscription Tiers
- **Starter**: $99/month - 1,000 API calls, basic features
- **Professional**: $299/month - 10,000 API calls, advanced features
- **Enterprise**: $999/month - Unlimited API calls, custom integrations

#### Additional Services
- **Implementation**: $2,000-$10,000 one-time setup
- **Training**: $500-$2,000 per session
- **Custom Development**: $150/hour
- **Support**: Included with all tiers

### Marketing Channels

#### Digital Marketing
- **Content Marketing**: Industry blogs, case studies, whitepapers
- **SEO/SEM**: Freight forwarding, logistics automation keywords
- **Social Media**: LinkedIn, Twitter for B2B engagement
- **Webinars**: Product demos, industry insights

#### Partnership Strategy
- **Technology Partners**: Salesforce, n8n, logistics software vendors
- **Industry Partners**: Freight forwarder associations, trade organizations
- **Channel Partners**: System integrators, consultants

#### Sales Strategy
- **Inside Sales**: SDR team for lead qualification
- **Field Sales**: Enterprise account managers for large deals
- **Partner Channel**: Referral programs, reseller partnerships

---

## 📅 Development Roadmap

### Q1 2025: Foundation & Testing
- ✅ **Core API Development**: Authentication, rate management, quote generation
- ✅ **Multi-Tenant Architecture**: Database RLS, JWT security
- 🚧 **Salesforce Integration**: Org ID mapping, data testing
- 🚧 **n8n Workflow**: Email-to-quote automation

### Q2 2025: Advanced Features
- 📋 **IHE Implementation**: Inland haulage extension logic
- 📋 **Multi-Leg Routes**: Road+rail+ocean transportation
- 📋 **Weight Slab Pricing**: Dynamic weight-based pricing
- 📋 **Rate Management CRUD**: Full rate management capabilities

### Q3 2025: Integration & Automation
- 📋 **Advanced n8n Workflows**: Complex automation scenarios
- 📋 **Analytics Dashboard**: Reporting and analytics interface
- 📋 **API Rate Limiting**: Performance and security enhancements
- 📋 **Webhook Support**: Real-time event notifications

### Q4 2025: Scale & Optimize
- 📋 **Performance Optimization**: Caching, database optimization
- 📋 **Advanced Analytics**: AI-powered insights and recommendations
- 📋 **Mobile API**: Mobile app support and optimization
- 📋 **International Expansion**: Additional market support

---

## 💰 Business Case

### Revenue Projections (Year 1)
- **Q1**: $0 (Development phase)
- **Q2**: $10K (Pilot customers)
- **Q3**: $50K (Market launch)
- **Q4**: $150K (Growth phase)
- **Total Year 1**: $210K

### Customer Acquisition Targets
- **Q2**: 5 pilot customers
- **Q3**: 25 paying customers
- **Q4**: 75 paying customers
- **Growth Rate**: 200% quarter-over-quarter

### Cost Structure
- **Development**: $120K (team of 2-3 developers)
- **Infrastructure**: $24K (AWS, Supabase, third-party services)
- **Sales & Marketing**: $60K (marketing, sales tools, events)
- **Operations**: $36K (support, administration)
- **Total Year 1**: $240K

### Break-Even Analysis
- **Break-Even Point**: Q4 2025
- **Customer Lifetime Value**: $15,000
- **Customer Acquisition Cost**: $3,000
- **Gross Margin**: 85%

---

## 🎯 Success Criteria

### Technical Success
- ✅ **API Performance**: < 2 second response times
- ✅ **System Reliability**: 99.9% uptime
- ✅ **Security**: Zero data breaches
- ✅ **Scalability**: Support 100+ concurrent users

### Business Success
- 📊 **Customer Adoption**: 80% of target users active
- 📊 **Revenue Growth**: 200% quarter-over-quarter growth
- 📊 **Customer Satisfaction**: 4.5+ rating
- 📊 **Market Penetration**: 5% of target market in Year 1

### Product Success
- 🚀 **Feature Adoption**: 90% of customers using core features
- 🚀 **Integration Success**: 95% successful Salesforce/n8n integrations
- 🚀 **Quote Conversion**: 20% improvement in quote-to-booking conversion
- 🚀 **Time Savings**: 80% reduction in quote generation time

---

## 📞 Next Steps

### Immediate Actions (Next 30 Days)
1. **Complete Salesforce Testing**: Validate API with real Salesforce data
2. **n8n Workflow Development**: Build email-to-quote automation
3. **Customer Pilot Program**: Identify and onboard 5 pilot customers
4. **Market Research**: Deep dive into India/UAE freight forwarding market

### Short-term Goals (Next 90 Days)
1. **Advanced Features**: Implement IHE and multi-leg routing
2. **Customer Feedback**: Gather feedback from pilot customers
3. **Sales Strategy**: Develop sales materials and pricing
4. **Partnership Development**: Establish key technology partnerships

### Long-term Vision (Next 12 Months)
1. **Market Leadership**: Become the go-to RMS solution in India/UAE
2. **Product Excellence**: Industry-leading features and performance
3. **Customer Success**: 100+ satisfied customers with high retention
4. **International Expansion**: Prepare for expansion to other markets

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: February 2025  
**Owner**: RMS Product Team
