# Pet Health Companion

An owner-first hub for pet health records, care reminders, medications, and cautious AI-assisted guidance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- AI env is provisioned through Replit AI Integrations for OpenAI access

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/pet-health-companion/` — owner web app
- `artifacts/api-server/src/routes/care.ts` — pet-care and AI API behavior
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/care.ts` — persistent pet-care data model

## Architecture decisions

- Owner workflows come first, but pet-scoped records allow later clinic sharing and permission layers.
- AI guidance is educational, record-aware, and explicitly not a veterinary diagnosis.
- Urgent symptom language is escalated toward emergency veterinary care rather than answered casually.
- Clinic names are currently record metadata; verified clinic accounts and write access are intentionally deferred.

## Product

- Dashboard with upcoming care, active medications, recent records, and health context
- Pet profile creation and editing
- Health timeline with searchable records
- Medication and reminder tracking
- AI question flow grounded in the selected pet's profile and recent records

## User preferences

- Keep the first product owner-focused while making future vet and clinic additions straightforward.

## Gotchas

- Re-run API codegen after every OpenAPI change before editing server or client callers.
- AI responses must keep the educational disclaimer and urgent-care escalation behavior.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
