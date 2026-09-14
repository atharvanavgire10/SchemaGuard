# SchemaGuard

Catch breaking API changes before your users do.

SchemaGuard analyzes API contracts against observed production traffic to determine whether a proposed change is SAFE, RISKY, or BREAKING — before deployment.

## Components
- `client`: React + Vite frontend UI
- `server`: Node + Express API & schema inference/compatibility engine

## Getting Started

1. Install backend dependencies: `cd server && npm install`
2. Run backend: `npm run dev`
3. Install frontend dependencies: `cd client && npm install`
4. Run frontend: `npm run dev`

## GitHub Integration
Set `GITHUB_TOKEN` in `server/.env` to enable automated PR comments.
