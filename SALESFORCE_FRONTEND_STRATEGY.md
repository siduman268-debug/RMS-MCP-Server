# RMS Salesforce Frontend - React Implementation

## Overview
This is a React-based frontend that integrates with Salesforce and your RMS APIs, providing maximum reusability and configurability.

## Architecture
```
React App (Hosted externally)
├── Salesforce OAuth Integration
├── RMS API Integration  
├── Configurable Settings
└── Multi-tenant Support
```

## Key Benefits
- ✅ **Highly Reusable** - Deploy to any environment
- ✅ **Configurable** - Environment-based configuration
- ✅ **Familiar** - Uses your existing React knowledge
- ✅ **Scalable** - Independent hosting and scaling
- ✅ **Maintainable** - Modern React patterns

## Setup Instructions

### 1. Create Salesforce Connected App
```xml
<!-- sfdx-project.json -->
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true,
      "package": "RMS-Integration",
      "versionName": "ver 1.0",
      "versionNumber": "1.0.0.NEXT"
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "60.0",
  "packageAliases": {
    "RMS-Integration": "0Ho..."
  }
}
```

### 2. Environment Configuration
```typescript
// config/environment.ts
export const config = {
  salesforce: {
    clientId: process.env.REACT_APP_SF_CLIENT_ID,
    loginUrl: process.env.REACT_APP_SF_LOGIN_URL || 'https://login.salesforce.com',
    redirectUri: process.env.REACT_APP_SF_REDIRECT_URI
  },
  rms: {
    apiUrl: process.env.REACT_APP_RMS_API_URL || 'http://localhost:3000',
    tenantId: process.env.REACT_APP_TENANT_ID || '00000000-0000-0000-0000-000000000001'
  }
};
```

### 3. Salesforce Authentication Service
```typescript
// services/salesforceAuth.ts
import { config } from '../config/environment';

export class SalesforceAuth {
  private accessToken: string | null = null;
  
  async authenticate(): Promise<string> {
    // Implement Salesforce OAuth flow
    const authUrl = `${config.salesforce.loginUrl}/services/oauth2/authorize?` +
      `response_type=token&client_id=${config.salesforce.clientId}&` +
      `redirect_uri=${config.salesforce.redirectUri}&scope=api`;
    
    // Handle OAuth flow
    return this.accessToken;
  }
  
  async getCurrentUser(): Promise<any> {
    // Get current Salesforce user info
  }
}
```

### 4. RMS API Service
```typescript
// services/rmsApi.ts
import { config } from '../config/environment';

export class RMSApiService {
  private baseUrl = config.rms.apiUrl;
  private tenantId = config.rms.tenantId;
  
  async getAuthToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: this.tenantId })
    });
    
    const data = await response.json();
    return data.token;
  }
  
  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': this.tenantId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    return response.json();
  }
  
  // Ocean Freight Rate methods
  async getOceanFreightRates(filters?: any): Promise<any[]> {
    const params = new URLSearchParams(filters).toString();
    const endpoint = `/api/ocean-freight-rates${params ? `?${params}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }
  
  async createOceanFreightRate(rate: any): Promise<any> {
    const response = await this.makeRequest('/api/ocean-freight-rates', {
      method: 'POST',
      body: JSON.stringify(rate)
    });
    return response.data;
  }
  
  // Margin Rule methods
  async getMarginRules(filters?: any): Promise<any[]> {
    const params = new URLSearchParams(filters).toString();
    const endpoint = `/api/margin-rules${params ? `?${params}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }
  
  // Surcharge methods
  async getSurcharges(filters?: any): Promise<any[]> {
    const params = new URLSearchParams(filters).toString();
    const endpoint = `/api/surcharges${params ? `?${params}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.data;
  }
}
```

### 5. React Components
```typescript
// components/OceanFreightRateList.tsx
import React, { useState, useEffect } from 'react';
import { RMSApiService } from '../services/rmsApi';

const OceanFreightRateList: React.FC = () => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    pol_code: '',
    pod_code: '',
    container_type: ''
  });
  
  const rmsApi = new RMSApiService();
  
  useEffect(() => {
    loadRates();
  }, [filters]);
  
  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await rmsApi.getOceanFreightRates(filters);
      setRates(data);
    } catch (error) {
      console.error('Failed to load rates:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="ocean-freight-rates">
      <h2>Ocean Freight Rates</h2>
      
      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="POL Code"
          value={filters.pol_code}
          onChange={(e) => setFilters({...filters, pol_code: e.target.value})}
        />
        <input
          type="text"
          placeholder="POD Code"
          value={filters.pod_code}
          onChange={(e) => setFilters({...filters, pod_code: e.target.value})}
        />
        <input
          type="text"
          placeholder="Container Type"
          value={filters.container_type}
          onChange={(e) => setFilters({...filters, container_type: e.target.value})}
        />
      </div>
      
      {/* Rates Table */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>POL Code</th>
              <th>POD Code</th>
              <th>Container Type</th>
              <th>Buy Amount</th>
              <th>Currency</th>
              <th>Transit Days</th>
              <th>Valid From</th>
              <th>Valid To</th>
              <th>Preferred</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate: any) => (
              <tr key={rate.id}>
                <td>{rate.pol_code}</td>
                <td>{rate.pod_code}</td>
                <td>{rate.container_type}</td>
                <td>{rate.buy_amount}</td>
                <td>{rate.currency}</td>
                <td>{rate.tt_days}</td>
                <td>{rate.valid_from}</td>
                <td>{rate.valid_to}</td>
                <td>{rate.is_preferred ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OceanFreightRateList;
```

### 6. Main App Component
```typescript
// App.tsx
import React from 'react';
import { SalesforceAuth } from './services/salesforceAuth';
import OceanFreightRateList from './components/OceanFreightRateList';
import MarginRuleList from './components/MarginRuleList';
import SurchargeList from './components/SurchargeList';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [user, setUser] = React.useState(null);
  
  React.useEffect(() => {
    const auth = new SalesforceAuth();
    auth.authenticate().then(() => {
      setIsAuthenticated(true);
      auth.getCurrentUser().then(setUser);
    });
  }, []);
  
  if (!isAuthenticated) {
    return <div>Authenticating with Salesforce...</div>;
  }
  
  return (
    <div className="rms-app">
      <header>
        <h1>RMS Management System</h1>
        <p>Welcome, {user?.name}</p>
      </header>
      
      <main>
        <OceanFreightRateList />
        <MarginRuleList />
        <SurchargeList />
      </main>
    </div>
  );
};

export default App;
```

## Deployment Options

### Option 1: Static Hosting (Recommended)
- **Vercel/Netlify** - Easy deployment, environment variables
- **AWS S3 + CloudFront** - Scalable, cost-effective
- **GitHub Pages** - Free hosting

### Option 2: Salesforce Experience Cloud
- Host React app in Experience Cloud
- Use Salesforce authentication
- Leverage Salesforce infrastructure

### Option 3: Heroku/Railway
- Full-stack deployment
- Environment management
- Easy scaling

## Configuration Management
```typescript
// config/settings.ts
export const getSettings = () => ({
  salesforce: {
    clientId: process.env.REACT_APP_SF_CLIENT_ID,
    loginUrl: process.env.REACT_APP_SF_LOGIN_URL,
    redirectUri: process.env.REACT_APP_SF_REDIRECT_URI
  },
  rms: {
    apiUrl: process.env.REACT_APP_RMS_API_URL,
    tenantId: process.env.REACT_APP_TENANT_ID
  },
  features: {
    enableMarginRules: process.env.REACT_APP_ENABLE_MARGIN_RULES === 'true',
    enableSurcharges: process.env.REACT_APP_ENABLE_SURCHARGES === 'true',
    maxRecordsPerPage: parseInt(process.env.REACT_APP_MAX_RECORDS || '50')
  }
});
```

## Benefits Over LWC

1. **Reusability** ✅
   - Deploy to any Salesforce org
   - Environment-specific configuration
   - Version control and updates

2. **Configurability** ✅
   - Environment variables
   - Feature flags
   - Customizable UI themes

3. **Maintainability** ✅
   - Modern React patterns
   - TypeScript support
   - Comprehensive testing

4. **Scalability** ✅
   - Independent hosting
   - CDN distribution
   - Performance optimization

5. **Flexibility** ✅
   - Custom integrations
   - Third-party libraries
   - Advanced UI components

Would you like me to create the complete React implementation with Salesforce integration?

