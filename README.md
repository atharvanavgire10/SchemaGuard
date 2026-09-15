# SchemaGuard

**A production API compatibility and schema-evolution platform that detects when backend API changes can break real clients before deployment.**

[![Tests](https://img.shields.io/badge/tests-47%20passing-brightgreen)](#testing)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#building)
[![License](https://img.shields.io/badge/license-ISC-blue)](#)

---

## Table of Contents

1. [What SchemaGuard Is](#what-schemaguard-is)
2. [The Problem](#the-problem)
3. [Why Existing Tools Are Insufficient](#why-existing-tools-are-insufficient)
4. [Architecture](#architecture)
5. [How Schema Inference Works](#how-schema-inference-works)
6. [How Compatibility Analysis Works](#how-compatibility-analysis-works)
7. [How Production Observation Works](#how-production-observation-works)
8. [How Impact Analysis Works](#how-impact-analysis-works)
9. [GitHub Integration](#github-integration)
10. [Interactive Demo](#interactive-demo)
11. [Technology Stack](#technology-stack)
12. [Local Installation](#local-installation)
13. [Environment Variables](#environment-variables)
14. [Database Setup](#database-setup)
15. [Docker Setup](#docker-setup)
16. [Testing](#testing)
17. [API Reference](#api-reference)
18. [Security](#security)
19. [Architecture Decisions](#architecture-decisions)
20. [Limitations](#limitations)
21. [Future Roadmap](#future-roadmap)

---

## What SchemaGuard Is

SchemaGuard is an API compatibility platform that answers a deceptively simple question:

> **"Will this API change break any of our current clients in production?"**

It does this by:

1. Observing real production API traffic and inferring the actual schema clients depend on
2. Comparing any proposed schema change against the observed production contract
3. Classifying every detected change as **SAFE**, **RISKY**, or **BREAKING**
4. Calculating which percentage of production traffic and which specific client types are affected
5. Integrating with GitHub to block broken PRs automatically

---

## The Problem

Modern backend teams ship API changes constantly. Even with OpenAPI specs and contract tests, production breaks happen because:

- **Documentation drifts from reality.** The spec says one thing; the API returns another.
- **Clients use fields not in the spec.** Mobile clients often depend on undocumented fields.
- **Type coercions hide incompatibilities.** `id: 123` silently works until the day a client stores it as an integer and you change it to a string.
- **Enum exhaustion is invisible.** A Swift `switch` with no `default` case crashes the app when a new status value appears.
- **Nested field removal is undetected.** Removing `customer.address.zipCode` looks minor in a diff but breaks address display for every client that reads it.

By the time you notice, users are already affected.

---

## Why Existing Tools Are Insufficient

| Tool | What it does | What it misses |
|---|---|---|
| OpenAPI / Swagger | Documents the spec | Doesn't validate real traffic against the spec |
| Contract tests (Pact) | Tests consumer-defined contracts | Consumers must opt in and maintain contracts |
| API linters | Checks spec quality | Doesn't detect runtime breaking changes |
| Integration tests | Tests happy paths | Doesn't model all client consumption patterns |
| Changelogs | Documents intent | Doesn't enforce compatibility |

SchemaGuard observes **what clients actually consume** from real production traffic, not what you think they consume.

---

## Architecture

```
                  GitHub PR / GitHub Actions
                           |
                           v
                  ┌─────────────────┐
                  │  SchemaGuard API │
                  │  (Express/Node)  │
                  └────────┬────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           v               v               v
      PostgreSQL    Compatibility      GitHub API
      (optional)       Engine         (PR comments)
           ^
           │
  Production Observations
  POST /api/observe
           │
           v
  Schema Inference Engine
  (schemaInferenceService)
           │
           v
  Compatibility Analysis
  (compatibilityService)
           │
           v
  Impact Analysis
  (observationService)
           │
           v
  React Dashboard
  (Vite / React 19)
```

**Backend structure:**

```
server/src/
  config/              # Configuration helpers
  controllers/         # Request handlers (thin layer)
    compatibilityController.js
    githubController.js
    observationController.js
    schemaController.js
  data/
    demoData.js        # Seeded demo scenarios (8 scenarios with real schemas)
  db/
    index.js           # PostgreSQL pool with graceful degradation
    schema.sql         # Database schema definition
  routes/              # Express routers
  services/            # Core business logic (no HTTP concerns)
    schemaInferenceService.js
    compatibilityService.js
    observationService.js
    githubService.js
  __tests__/           # Integration tests
  index.js             # Application entry point
```

---

## How Schema Inference Works

The schema inference engine (`schemaInferenceService.js`) accepts arbitrary JSON and produces a normalized schema representation.

**Type mapping:**

| JavaScript value | Inferred type |
|---|---|
| `123` (integer) | `"integer"` |
| `3.14` (float) | `"number"` |
| `"hello"` | `"string"` |
| `true` / `false` | `"boolean"` |
| `null` | `"null"` |
| `{}` (object) | `"object"` with `properties` |
| `[]` (array) | `"array"` with `items` |

**Special behaviors:**

- **Nullable fields:** When a field is `null` in some observations and a concrete type in others, the type becomes `["string", "null"]`.
- **Enum tracking:** All observed string values are collected: `status` seen as `"active"` and `"inactive"` becomes `{ type: "string", enum: ["active", "inactive"] }`.
- **Missing fields:** When a field is present in some observations but not others, it is marked optional in the merged schema. An absent field is not treated as an observed `null`.
- **Multiple observations:** `inferFromMultiple(observations[])` merges all observations into a single schema using `mergeSchemas()`.
- **Recursive:** Nested objects and arrays of objects are fully supported.

**Example:**

```js
// Input: two production observations
inferFromMultiple([
  { id: 1, status: "active" },
  { id: 2, status: "inactive" }
])

// Output:
{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "status": { "type": "string", "enum": ["active", "inactive"] }
  }
}
```

---

## How Compatibility Analysis Works

The compatibility engine (`compatibilityService.js`) compares an **old schema** (observed production contract) against a **new schema** (proposed change) and classifies every detected difference.

### Classification Rules

**BREAKING** — existing clients will fail:

| Change | Example |
|---|---|
| Field removed | `email` deleted from response |
| Type changed | `id: integer` → `id: string` |
| Nullable → non-nullable | `avatar: string\|null` → `avatar: string` |
| Enum value removed | `status` loses `"inactive"` |
| Object → primitive | `name: object` → `name: string` |

**RISKY** — may break clients that make strict assumptions:

| Change | Example |
|---|---|
| New enum value added | `status` gains `"suspended"` |
| Format changed | `name: string` → `name: object{first, last}` |
| Non-nullable → nullable | `avatar: string` → `avatar: string\|null` |

**SAFE** — fully backwards compatible:

| Change | Example |
|---|---|
| Optional field added | New `avatarUrl` field |
| Nullable field added | New `metadata: object\|null` |

### Scoring Algorithm

```
score = max(0, 100 - (breaking × 25) - (risky × 5))
```

- Each **BREAKING** change deducts **25 points** (high severity)
- Each **RISKY** change deducts **5 points** (low severity)
- **SAFE** changes do not deduct
- Score is clamped at `[0, 100]`

A score of `100` means fully safe. A score of `0` means four or more breaking changes.

### Structured Output

Each detected change produces:

```json
{
  "classification": "BREAKING",
  "severity": "HIGH",
  "path": ".email",
  "change": "FIELD_REMOVED",
  "before": "string",
  "after": null,
  "reason": "Field \"email\" was removed. Existing clients that read this field will fail or receive undefined."
}
```

---

## How Production Observation Works

Send real API responses to SchemaGuard:

```bash
POST /api/observe
{
  "service": "e-commerce-api",
  "endpoint": "/users/:id",
  "method": "GET",
  "statusCode": 200,
  "requestId": "req_abc123",
  "client": "android",
  "response": { "id": 123, "name": "Alice", "email": "alice@example.com" },
  "timestamp": "2026-09-15T00:00:00Z"
}
```

**Privacy-first design:** SchemaGuard infers and stores only the **schema** of each response — not the raw payload. No PII, no customer data is ever stored.

**Storage strategy:**
- In-memory ring buffer (last 1,000 observations) — always available, no setup required
- PostgreSQL persistence — when `DATABASE_URL` is configured (optional)
- Graceful degradation — the application is fully functional without a database

**Retention policy:** Raw responses are never persisted. Inferred schemas are stored in PostgreSQL with no automatic purge in MVP; production deployments should add a scheduled cleanup job.

**Tracked metrics per endpoint:**
- Total request count
- Status code distribution (200, 404, 500…)
- Client distribution (web, android, iOS…)
- Observed fields and their presence percentage
- Observed enum values per field

---

## How Impact Analysis Works

When SchemaGuard detects a breaking change, it cross-references the production observation data:

**Example:** `email` field removed

```
Observed presence of "email" in production: 87.3%
Clients that access "email":               android, ios
Affected requests:                         ~160,839 of 184,291
```

Impact is calculated from the seeded demo data (or live observations when available):

```json
{
  "field": "email",
  "affectedTrafficPct": 87.3,
  "affectedClients": ["android", "ios"],
  "affectedRequests": 160839
}
```

---

## GitHub Integration

SchemaGuard integrates with GitHub to automatically analyze pull requests and post compatibility comments.

### Setup

1. Create a GitHub Personal Access Token with `repo` scope (or `public_repo` for public repos):
   https://github.com/settings/tokens

2. Add to `server/.env`:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```

3. Use the API:
   ```bash
   POST /api/github/analyze-pr
   {
     "owner": "myorg",
     "repo": "my-api",
     "prNumber": 42,
     "before": { ...oldSchema },
     "after": { ...newSchema },
     "postComment": true
   }
   ```

### GitHub Actions Workflow

The `.github/workflows/schemaguard.yml` workflow triggers on pull requests that change API schema files and:

1. Runs the SchemaGuard compatibility analysis
2. Fails the CI build for breaking changes (configurable)
3. Posts a PR comment with the compatibility report

**Example PR comment for a breaking change:**

```markdown
## SchemaGuard 🚨 Breaking Changes Detected

**Endpoint:** `GET /users/:id`
**Compatibility Score:** 50/100
**Classification:** BREAKING

### Breaking Changes
- `.email`: FIELD_REMOVED — Field "email" was removed. Existing clients that read
  this field will fail or receive undefined.

**Affected Traffic:** 18.7%
**Affected Consumers:** android, ios

> ⚠️ Recommendation: Review and address breaking changes before merging.
```

**Example PR comment for a safe change:**

```markdown
## SchemaGuard ✅ No Breaking Changes Detected

**Compatibility Score:** 100/100
**Endpoints analyzed:** 1

All API changes are backwards compatible. Safe to merge.
```

### GitHub Integration Status

Check if GitHub integration is configured:

```bash
GET /api/github/status
```

> **Note:** The public recruiter demo works without a GitHub token. GitHub integration is a developer feature.

---

## Interactive Demo

The demo is available immediately with no setup — no database, no GitHub, no API keys required.

**Demo API:** E-Commerce API  
**Monitored endpoints:** 24  
**Observed requests:** 184,291  
**Consumer clients:** Web (42.1%), Android (34.8%), iOS (23.1%)

### Available Scenarios (8 total)

| # | Scenario | Classification |
|---|---|---|
| 1 | Add optional `avatarUrl` field | ✅ SAFE |
| 2 | Add optional `metadata` object | ✅ SAFE |
| 3 | Add new `status` enum value `"suspended"` | ⚠️ RISKY |
| 4 | Change `name` from string to `{first, last}` object | 🚨 BREAKING |
| 5 | Remove `email` field | 🚨 BREAKING |
| 6 | Change `id` from integer to string | 🚨 BREAKING |
| 7 | Remove nested `customer.address.zipCode` | 🚨 BREAKING |
| 8 | Make nullable `avatar` field non-nullable | 🚨 BREAKING |

Every scenario is analyzed by the **real compatibility engine** — nothing is hardcoded in the frontend.

**Recruiter flow (< 90 seconds):**
```
Homepage → Try Interactive Demo → Choose Scenario → Run Compatibility Check
→ View Result (SAFE/RISKY/BREAKING) → View Affected Traffic → View Consumer Impact
→ View Detection Explanation (observed contract → proposed change → diff → classification)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Axios |
| Backend | Node.js, Express 5 |
| Schema inference | Custom engine (no external dependencies) |
| Compatibility analysis | Custom deterministic engine (no LLM) |
| Database | PostgreSQL 15 (optional, graceful degradation) |
| Testing | Jest, Supertest |
| CI | GitHub Actions |
| Containerization | Docker, Docker Compose |

---

## Local Installation

### Prerequisites

- Node.js 18+
- npm 9+
- (Optional) PostgreSQL 14+
- (Optional) Docker

### Without Docker

**Terminal 1 — Backend:**
```bash
cd server
npm install
cp .env.example .env      # Edit as needed (all defaults work out-of-the-box)
npm run dev               # Starts on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm install
npm run dev               # Starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

Verify the backend:
```bash
curl http://localhost:5000/health
# { "status": "ok", "service": "schemaguard-api", "version": "1.0.0" }
```

---

## Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

```env
# Server port (default: 5000)
PORT=5000

# Client origin for CORS (default: http://localhost:5173)
CLIENT_ORIGIN=http://localhost:5173

# PostgreSQL connection string (optional — app runs in memory without it)
# DATABASE_URL=postgresql://postgres:password@localhost:5432/schemaguard

# PostgreSQL SSL for cloud databases
# DATABASE_SSL=false

# GitHub Personal Access Token (optional — enables PR comments)
# GITHUB_TOKEN=ghp_your_token_here

NODE_ENV=development
```

> **Security:** Never commit `.env` to version control. It is in `.gitignore`.

### Vercel + Neon

Deploy this repository as one Vercel project from the repository root. The included
`vercel.json` builds `client/` and forwards `/health` plus all `/api/*` requests to
the exported Express application in `api/index.js`; no separate backend deployment
or frontend API URL is required.

Set these Vercel environment variables for the Production, Preview, and Development
environments as appropriate:

```env
# Neon pooled PostgreSQL connection string (never commit this value)
DATABASE_URL=postgresql://...

# Required for Neon TLS with the existing pg Pool configuration
DATABASE_SSL=true

# The public Vercel origin allowed to call the API, for example:
CLIENT_ORIGIN=https://your-project.vercel.app

# Optional; enables GitHub PR comments
GITHUB_TOKEN=...
```

Leave `VITE_API_URL` unset for this single-project deployment: the frontend defaults
to same-origin `/api` requests. Set it only when deliberately hosting the API at a
different origin. Local Vite development continues to proxy `/api` to port 5000.

---

## Database Setup

PostgreSQL is **optional**. The application runs fully in memory without it.

### Manual Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE schemaguard;"

# Run the schema
psql -U postgres -d schemaguard -f server/src/db/schema.sql
```

### Tables

| Table | Purpose |
|---|---|
| `projects` | API projects being monitored |
| `endpoints` | Individual API endpoints per project |
| `observations` | Inferred schemas from production traffic (not raw payloads) |
| `contracts` | Merged observed contracts per endpoint |
| `analyses` | Historical compatibility analysis results |

### Indexes

```sql
-- Observations: fast lookup by endpoint, time, request ID, and client
CREATE INDEX idx_observations_endpoint_id ON observations(endpoint_id);
CREATE INDEX idx_observations_timestamp ON observations(timestamp);
CREATE INDEX idx_observations_request_id ON observations(request_id);
CREATE INDEX idx_observations_client ON observations(client);

-- Analyses: fast lookup by project
CREATE INDEX idx_analyses_project_id ON analyses(project_id);
```

---

## Docker Setup

```bash
# Create Docker Compose credentials; choose a real local password.
cp .env.example .env

# Start everything (PostgreSQL + Backend + Frontend)
docker-compose up --build

# Backend: http://localhost:5000
# Frontend: http://localhost:5173
# PostgreSQL: localhost:5432
```

The PostgreSQL schema is automatically initialized from `server/src/db/schema.sql` on first startup.

To stop:
```bash
docker-compose down
```

To reset the database:
```bash
docker-compose down -v    # removes the postgres_data volume
```

---

## Testing

### Backend Tests

```bash
cd server
npm test
```

**Test suite (40 tests, 3 suites):**

```
PASS src/services/__tests__/schemaInferenceService.test.js
  ✓ infers integer
  ✓ infers number (float)
  ✓ infers string with enum tracking
  ✓ infers boolean
  ✓ infers null
  ✓ infers flat object
  ✓ infers nested objects
  ✓ infers empty array
  ✓ infers array of integers
  ✓ infers array of objects
  ✓ infers full user object with nullable field

PASS src/services/__tests__/compatibilityService.test.js
  ✓ BREAKING: field removed (email)
  ✓ BREAKING: type changed (id integer to string)
  ✓ BREAKING: enum value removed
  ✓ BREAKING: nullable field made non-nullable
  ✓ BREAKING: nested field removed
  ✓ RISKY: enum value added
  ✓ SAFE: optional field added
  ✓ SAFE: no changes → score 100
  ✓ SAFE: nullable field added
  ✓ score decreases 25 per breaking change
  ✓ score never goes below 0
  ✓ (multiple observations and edge cases)

PASS src/__tests__/api.integration.test.js
  ✓ GET /health returns ok
  ✓ GET /api/demo returns demo data
  ✓ POST /api/demo/analyze → remove-email → BREAKING
  ✓ POST /api/demo/analyze → add-avatar → SAFE
  ✓ POST /api/demo/analyze → add-status-enum → RISKY
  ✓ POST /api/demo/analyze → 400 for missing scenarioId
  ✓ POST /api/demo/analyze → 404 for unknown scenario
  ✓ POST /api/schema/infer → infers from data
  ✓ POST /api/schema/infer → infers from multiple observations
  ✓ POST /api/schema/infer → 400 for missing data
  ✓ POST /api/compatibility/analyze → detects breaking change
  ✓ POST /api/compatibility/analyze → 400 for missing schemas

Test Suites: 3 passed, 3 total
Tests:       40 passed, 40 total
```

### Frontend Build

```bash
cd client
npm run build
# ✓ built in ~560ms
# dist/assets/index.js   283.84 kB │ gzip: 90.57 kB
```

---

## API Reference

### Health

```
GET /health
→ { status: "ok", service: "schemaguard-api", version: "1.0.0", timestamp: "..." }
```

### Demo

```
GET  /api/demo                    — Get demo data and all scenarios
GET  /api/demo/scenarios          — Get scenarios list only
POST /api/demo/analyze            — Run real compatibility analysis on a scenario
  Body: { "scenarioId": "remove-email" }
  Returns: { classification, score, summary, changes, scenario, impact }
```

### Schema Inference

```
POST /api/schema/infer
  Body: { "data": { ...anyJSON } }
  — OR —
  Body: { "observations": [ {...}, {...} ] }
  Returns: { "schema": { type, properties, ... } }
```

### Compatibility Analysis

```
POST /api/compatibility/analyze
  Body: { "before": { ...schema }, "after": { ...schema } }
  Returns: { classification, score, summary: { breaking, risky, safe }, changes: [...] }
```

### Production Observation

```
POST /api/observe                 — Ingest a production API observation
  Body: { service, endpoint, method, statusCode, requestId, client, response, timestamp }
  Returns: { stored: true, inferredSchema }

GET  /api/observe/traffic         — Get traffic statistics
GET  /api/observe/project         — Get demo project overview
POST /api/observe/analyze         — Analyze with traffic impact
  Body: { "before": {...}, "after": {...} }
  Returns: { ...compatibilityResult, impact: { affectedTrafficPct, affectedClients, fieldImpacts } }
```

### GitHub Integration

```
GET  /api/github/status           — Check if GITHUB_TOKEN is configured
POST /api/github/analyze-pr       — Analyze a GitHub PR and optionally post a comment
  Body: { owner, repo, prNumber, before, after, postComment: true }
  Returns: { ...compatibilityResult, pr: { title, number, url }, comment: { id, url } }
```

---

## Security

| Control | Implementation |
|---|---|
| CORS | Restricted to `CLIENT_ORIGIN` env variable |
| Payload size limit | 1 MB max (`express.json({ limit: '1mb' })`) |
| Input validation | All endpoints validate required fields and return 400 |
| Safe error messages | Stack traces are never sent to clients |
| No secrets in repo | `.env` is in `.gitignore`; `.env.example` has no real values |
| No raw payload storage | Only inferred schemas are persisted (privacy-first) |
| GitHub token | Stored only in env variable, never logged or returned |
| SSRF protection | No URL-fetching endpoints exposed publicly |

---

## Architecture Decisions

**Why not use an LLM for compatibility analysis?**  
Compatibility is a deterministic engineering question. `id: integer` changing to `id: string` is always breaking — no AI judgment is needed. A deterministic engine is faster, free, auditable, and testable.

**Why store inferred schemas instead of raw payloads?**  
Privacy. Raw API responses may contain PII (emails, names, addresses). SchemaGuard only needs the *shape* of the data, not the content.

**Why graceful PostgreSQL degradation?**  
The recruiter demo must work with zero setup. The schema inference and compatibility engines are pure functions that need no database. PostgreSQL becomes valuable for long-term traffic observation at scale.

**Why not Redis?**  
In MVP, the in-memory observation store covers the demo use case. Redis would add operational complexity without commensurate value at this scale. Adding it as an optional caching layer is straightforward when observation volumes grow.

**Why Express 5?**  
Async error propagation without manual try/catch wrappers. Actively maintained.

---

## Limitations

- **No authentication.** The API is open. Production deployments should add API key or JWT middleware.
- **In-memory retention.** Without PostgreSQL, observations are capped at 1,000 records and lost on restart.
- **CI schema convention.** GitHub Actions compares changed `*.schema.json` files to their pull-request base revision. Other contract formats require an adapter that emits this JSON schema subset.
- **Demo traffic is seeded.** The impact percentages in the demo (18.7%, 87.3%) are from seeded data, not live traffic — this is clearly documented in code.
- **No multi-tenancy.** Single project scope for MVP.
- **No frontend tests.** Unit tests for the React components are not included in MVP.

---

## Future Roadmap

- [ ] OpenAPI / JSON Schema import support
- [ ] Multi-project / team support with authentication
- [ ] Frontend component tests (Vitest + Testing Library)
- [ ] Redis caching for inferred contracts
- [ ] Automatic schema extraction from PR diff (GitHub integration adapter)
- [ ] Slack / Teams notifications for breaking changes
- [ ] Historical analysis trend dashboard
- [ ] SDK / middleware library for automatic observation injection
- [ ] Time-windowed retention policies for observations
- [ ] CLI tool for local pre-commit checks

---

## Repository Structure

```
SchemaGuard/
├── .github/
│   └── workflows/
│       └── schemaguard.yml          # GitHub Actions CI workflow
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                  # Main application component
│   │   ├── App.css                  # Dark UI styles
│   │   ├── index.css                # Base styles
│   │   └── main.jsx                 # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                          # Express API server
│   ├── src/
│   │   ├── controllers/             # Request handlers
│   │   ├── data/
│   │   │   └── demoData.js          # 8 demo scenarios with real schemas
│   │   ├── db/
│   │   │   ├── index.js             # PostgreSQL pool (graceful degradation)
│   │   │   └── schema.sql           # Database schema
│   │   ├── routes/                  # Express routers
│   │   ├── services/                # Core business logic
│   │   │   ├── schemaInferenceService.js
│   │   │   ├── compatibilityService.js
│   │   │   ├── observationService.js
│   │   │   └── githubService.js
│   │   ├── __tests__/               # Integration tests
│   │   └── index.js                 # Application entry point
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

*SchemaGuard — Built as a demonstration of production-quality API tooling.*
