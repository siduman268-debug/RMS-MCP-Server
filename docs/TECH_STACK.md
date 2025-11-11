## RMS MCP Server Tech Stack

### Application Runtime
- **Node.js 20.x**  
  Primary runtime for the backend service. Provides the execution environment for all server-side logic and tooling.
- **TypeScript**  
  Strongly typed superset of JavaScript used across the codebase (`tsconfig` targets `ES2020`). Enables safer refactoring, IDE support, and better API contracts.

### Web Framework & HTTP Layer
- **Fastify**  
  Chosen for its high performance, schema-driven validation, and plugin ecosystem. All API versions (`/api/v1`, `/api/v2`, `/api/v3`, `/api/v4`) are exposed via Fastify routes.
- **Fastify Plugins**  
  - `@fastify/cors`: Frontend/partner integrations.
  - `@fastify/jwt`: JWT signing/verification for `/api/auth/token`.
  - `@fastify/rate-limit` (optional in production): Protect against abusive traffic.

### Data Layer
- **Supabase (PostgreSQL 15)**  
  Managed Postgres instance used for relational data, views, and RPC functions.
  - Tables: `ocean_freight_rate`, `surcharge`, `haulage_route`, `haulage_rate`, etc.
  - Materialized views: `mv_freight_sell_prices`, `v_freight_surcharge_details`, `v_local_charges_details`.
  - Stored procedures: `simplified_inland_function` (carrier-aware), plus reporting RPCs.
- **@supabase/supabase-js**  
  Official client used server-side for data access. We use the service key for privileged operations (RPC calls, administrative queries).

### External Integrations
- **Supabase Edge Functions / RPC**  
  All inland haulage calculations call the `simplified_inland_function` RPC for weight- and carrier-specific logic.
- **Maersk DCSA Schedule API**  
  Used for earliest departure and upcoming sailings when the internal schedule view is incomplete. Configured via `MaerskDCSAAdapter` with `MAERSK_API_KEY` and `MAERSK_API_SECRET`.
- **Port Schedules (internal views)**  
  Database materialized views (e.g. `v_port_to_port_routes`) provide schedule data. Maersk API acts as fallback.
- **Environment Management**  
  `.env` (local) and Docker Compose on the VM inject secrets such as Supabase keys, JWT secret, and Maersk credentials.

### Build & Tooling
- **npm Scripts**
  - `npm run build`: Compiles TypeScript into `dist/`.
  - `npm start`: Runs Node in production mode using compiled output.
  - `npm run lint` (optional): eslint checks.
- **TypeScript Compiler (`tsc`)**  
  Produces the deployable JS bundle in `dist/`.
- **ESLint + Prettier**  
  Configured for consistent code style (TypeScript-focused rules).

### Deployment
- **Docker / Docker Compose**  
  Primary deployment vehicle for VM. `Dockerfile` builds the Node image; `docker-compose.yml` mounts `.env`, exposes port `3000`, and manages health checks.
- **AWS EC2 (VM)**  
  Run-time environment for the production container. CI/CD currently manual: git pull + docker-compose rebuild.
- **Logging & Monitoring**  
  - `pino` logger for structured JSON logs (Fastify default).
  - Container logs routed via Docker (json-file).
  - Health endpoint `GET /health` for uptime checks.

### Authentication & Security
- **JWT Auth**  
  `/api/auth/token` issues tokens, signed with `JWT_SECRET`, used across `/api/v*`.
- **Tenant Isolation**  
  Routes expect `x-tenant-id` header; Supabase queries filter by `tenant_id`.
- **Input Validation**  
  Fastify schemas validate payloads (including new `cargo_ready_date` logic in v4).

### Testing & QA
- **Manual API Testing**  
  `test/QUICK_TEST_GUIDE.md` provides PowerShell/cURL commands for V2/V4.
- **Developer Workflow**  
  - Local supabase not required; we point to the managed instance using service key.
  - Feature verification through local `npm start` and Postman/PowerShell scripts.

### Notable Services
- **ScheduleIntegrationService**  
  Orchestrates schedules from Supabase views and Maersk API. Supports filtering by cargo-ready date and returning multiple upcoming sailings.
- **Inland haulage pipeline**  
  Automatically triggered when origin/destination are inland; ensures carrier-specific rates using the `vendor_id` passed to Supabase RPC.

### Future Integrations
- **Portcast Schedule API**  
  Planned as a secondary fallback when carrier DCSA adapters are unavailable. Will share similar infrastructure via the existing schedule integration layer.


