# Pet Health Companion — Project Reference

An owner-first hub for pet health records, care reminders, medications, and cautious AI-assisted guidance.

This file replaces the old `replit.md` (Replit Agent's own memory file — no longer relevant now that development happens with Claude Code instead of Replit). See `CLAUDE.md` for the team's git/PR workflow; this file is the technical project reference: stack, run commands, where things live, and gotchas.

## Local secrets

- Copy `.env.example` to `.env` at the repo root and fill in real values — `.env` is gitignored, never commit it.
- `lib/db/drizzle.config.ts` loads it explicitly (via `dotenv`) so `pnpm --filter @workspace/db run push` picks it up regardless of cwd.
- `artifacts/api-server`'s `start`/`dev` scripts load it via Node's native `--env-file-if-exists` — no-op if the file doesn't exist. In production, these get set through whatever hosting provider's secret/env management is chosen (not yet decided — Replit is no longer the target).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server. Reads `PORT` from `.env` (pick any free port — 5000 collides with macOS's AirPlay Receiver, so local dev commonly uses 5050).
- `pnpm --filter @workspace/pet-health-companion run dev` — run the frontend (defaults to port 5173; its dev proxy forwards `/api` to `http://localhost:5050` by default — override with `API_PROXY_TARGET` if the API runs elsewhere).
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `BETTER_AUTH_SECRET` — session/token signing secret (any long random string)
- Required env: `BETTER_AUTH_URL` — the api-server's own public base URL (used by better-auth for cookies/CSRF)
- Optional env: `WEB_ORIGIN` — comma-separated frontend origin(s), for CORS + better-auth trusted origins when the web app isn't served same-origin
- Required env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — for health-record document uploads (Supabase Storage, server-side only)
- Required env: `ANTHROPIC_API_KEY` — powers symptom chat and Smart Document Upload extraction (Claude Haiku 4.5, `lib/integrations-anthropic-ai-server`)
- `scripts/post-merge.sh` (`pnpm install --frozen-lockfile && pnpm --filter db push`) is no longer auto-run on merge (that was wired through Replit's `.replit` config, now removed) — run it manually after pulling a branch with schema changes.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Auth: better-auth (email/password), Drizzle adapter — `lib/auth`
- File storage: Supabase Storage (private bucket, signed URLs) — `artifacts/api-server/src/lib/storage.ts`
- DB: PostgreSQL + Drizzle ORM
- AI: Anthropic Claude (Haiku 4.5) — `lib/integrations-anthropic-ai-server`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Production hosting: not yet decided (previously Replit's autoscale deployment) — Supabase (DB + storage) is independent of this and stays either way.

## Where things live

- `artifacts/pet-health-companion/` — owner web app
- `artifacts/pet-health-companion/src/pages/login.tsx`, `signup.tsx` — auth pages; `src/lib/auth-client.ts` — better-auth React client
- `artifacts/api-server/src/routes/care.ts` — pet-care and AI API behavior
- `lib/auth/src/auth.ts` — better-auth server config (email/password, Drizzle adapter, plural table names, serial ids)
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/care.ts` — persistent pet-care data model
- `lib/db/src/schema/auth.ts` — `users`/`sessions`/`accounts`/`verifications` tables required by better-auth
- `lib/db/src/schema/pet-owners.ts` — owner↔pet join table, multi-owner shaped and enforced in every route via `getOwnedPetIds`/`isPetOwnedByUser` (`care.ts`); there's just no invite flow yet to add a second owner (PRD Bolt 13)
- `lib/db/src/schema/document-imports.ts` — Smart Document Upload's review-queue tables (`documentImports`, `documentImportItems`)
- `lib/db/src/schema/ai-usage.ts` — per-account monthly AI usage tracking (`aiUsageMonthly`)

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
- AI question flow grounded in the selected pet's profile and recent records, quota-governed (50 questions/account/month — see the chat-quota gotcha below)
- Smart Document Upload: upload a vet report, AI proposes records/medications/reminders, owner reviews and confirms before anything is saved — backend and frontend review UI both built

## User preferences

- Keep the first product owner-focused while making future vet and clinic additions straightforward.

## Roadmap status

Per `docs/PRD.md`'s Bolt numbering: Phase 1 (Bolts 1–10, the MVP) is fully done. Phase 2 (Bolts 11–13 — email digest, trend insights, co-owner invites) hasn't been started. Phase 3 (14–18) is explicitly deferred in the PRD.

## Gotchas

- Re-run API codegen after every OpenAPI change before editing server or client callers.
- AI responses must keep the educational disclaimer and urgent-care escalation behavior.
- The better-auth Express handler (`app.all("/api/auth/*splat", authHandler)`) must be mounted **before** `express.json()` in `app.ts` — better-auth parses the raw request body itself, and a body-parser upstream would consume the stream first.
- `lib/db/src/schema/auth.ts` mirrors better-auth's own generated schema for the config in `lib/auth/src/auth.ts` (plural table names, serial ids via `advanced.database.generateId: "serial"`). If that config changes (new fields, a plugin), regenerate with `npx @better-auth/cli generate` and reconcile — don't hand-edit column shapes from guesswork.
- Every route in `routes/care.ts` sits behind `requireAuth` and is scoped by owner via `pet_owners` (`getOwnedPetIds`/`isPetOwnedByUser` in `care.ts`) — a pet not owned by the caller 404s rather than leaking existence.
- Pets are capped at `MAX_PETS_PER_ACCOUNT` (3) in `routes/care.ts`; `POST /pets` 400s past that with a message, and the "Add another pet" link hides client-side at the cap.
- `asDateString`/`asWeightString` in `care.ts` pass `undefined` through as-is (don't coalesce to `null`) — an omitted field on a PATCH must leave that column untouched, not clear it. Only an explicit `null` clears a field.
- Health records support edit/delete (`PATCH`/`DELETE /pets/:petId/records/:recordId`), both ownership-checked. The records page has type + date-range filtering alongside the existing search — all client-side over the already-fetched list (record counts per pet are small; no need for server-side query params at this scale).
- Health record attachments: `POST /pets/:petId/documents` (multipart, PDF/image, 10MB max) uploads to a private Supabase Storage bucket (`health-record-documents`, created automatically on first upload) and returns a long-lived (10-year) signed URL, stored in `health_records.document_url` alongside `document_type` (`link`|`upload`) and `document_name`. The bucket is intentionally private — there's no public-URL path.
- Medications: `doseIntervalValue`/`doseIntervalUnit` (hours|days|weeks|months) are optional, structured, and independent of the free-text `frequency` label — a medication can stay purely descriptive if its schedule doesn't fit a fixed interval. `POST /pets/:petId/medications/:medicationId/log-dose` recalculates `nextDoseAt` from the *previous* `nextDoseAt` (not "now"), so an early or late mark-as-given doesn't drift the schedule; 400s with a clear message if no interval is set. `PATCH /pets/:petId/medications/:medicationId` also exists — used both for schedule edits and for "stop" (`active: false`), since there's no separate deactivate endpoint. The dashboard merges active medications' next-dose times with reminders into one "Upcoming Care" list, sorted, with a "Due soon" badge inside 48 hours.
- Care Recommendations Engine (`lib/care-recommendations.ts`) is rule-based, not AI — vaccine-renewal (rabies/DHPP-DAPP/FVRCP/Bordetella, species-matched) and age-based senior-screening (7yr dogs, 10yr cats) rules. It re-runs synchronously right after the mutations that could change its inputs (pet create/update, health record create/update) — there's no job scheduler in this app, so "re-run on the relevant mutation" is the trigger model. Reminders it creates carry `source: "system"` and a stable `ruleId` (e.g. `vaccine:rabies`, `senior-screening`) so re-runs upsert instead of duplicating, and only reset `completed` when the computed due date actually changes (a newer vaccine record came in) — an unrelated re-run never un-completes a reminder the owner already handled.
- There is no auto-seeded demo pet. A brand-new account has zero pets — the empty states in `Dashboard`/`Layout` ("Add Your Pet") are the real first-run experience, not a fallback. Uploading past records is an owner choice, not automatic.
- Symptom chat (`routes/care.ts` `/insights`, `lib/symptom-escalation.ts`, `lib/chat-quota.ts`): a red-flag question (difficulty breathing, collapse, seizure, poisoning, etc.) short-circuits before any AI call and returns a deterministic escalation message referencing the pet's saved vet contact. Everything else is a grounded single-turn Claude answer. Quota-governed at 50 questions/account/month (`ai_usage_monthly.chat_questions_used`) — checked before the AI call, recorded after a successful one, and **never applied to escalations**, since a maxed-out quota must not block a genuine emergency message. `GET`/`POST /insights` both return the current quota alongside the insight(s).
- Smart Document Upload (`routes/document-imports.ts`, `lib/document-extraction.ts`, `lib/document-import-quota.ts`, `lib/duplicate-detection.ts`, `lib/care-mutations.ts`): owner uploads a vet report (PDF/image), Claude extracts candidate health records/medications/reminders as a `document_import` with `pending` `document_import_items` — nothing is written to the real tables until the owner explicitly accepts each item (`POST .../items/:itemId/accept`, editable via an optional `proposedData` override in the body) or rejects it. Rejected items create nothing; the import flips to `status: "reviewed"` once every item is accepted or rejected (`markReviewedIfComplete`).
  - Two-lane quota, tracked on `pets.importDocsUsed`/`importWindowEndsAt` (per-pet, set on pet creation) and `ai_usage_monthly` (per-account, per-calendar-month): the first 30 days after a pet is added get 20 free "onboarding" imports; after that (or once onboarding is exhausted), it's 10/month "ongoing" imports shared across the account. `pickImportLane` throws `QuotaExceededError` → 400 before any AI call is made; usage is only recorded (`recordDocumentImportUsage`) *after* a successful extraction, so a failed/errored upload doesn't cost the owner an attempt.
  - PDF text is extracted via `pdf-parse` (20-page cap → `TooManyPagesError`; under ~40 chars of extracted text is treated as a scanned/image-only PDF → `ScannedDocumentError`, both surfaced as 400s). Images go to the model as a base64 data URL. `pdf-parse`/`pdfjs-dist` need an explicit `PDFParse.setWorker(...)` pointed at `pdfjs-dist`'s real on-disk `legacy/build/pdf.worker.mjs` (resolved relative to `pdf-parse`'s own location, not this package's — `pdfjs-dist` is only a transitive dependency, and pnpm's strict node_modules blocks resolving it directly) — without this, esbuild's single-file bundle breaks pdfjs's default relative-path worker resolution and every PDF upload 500s with "Setting up fake worker failed."
  - Duplicate detection (`findDuplicate`) is a same-pet, same-type, ±3-day-date + substring heuristic — it flags (`duplicateOfType`/`duplicateOfId` on the item) but never blocks or auto-drops; the owner still decides.
  - Accepted items go through the same insert helpers (`insertHealthRecordForPet`, etc. in `lib/care-mutations.ts`) as the manual create flows, so an accepted vaccine health record still triggers the Care Recommendations Engine.
  - The AI extraction prompt and `CreateMedicationBody`/`CreateHealthRecordBody`/`CreateReminderBody` schemas must stay in sync (e.g. medication `dose`/`frequency` field names, `active` injected as `true` before parsing) — extraction silently drops any item that fails `.safeParse()`, so a prompt/schema mismatch fails silently rather than with an error.
  - Frontend review UI (upload entry point, proposed-item review screen with accept/edit/reject + duplicate flags, quota display) is built (`smart-upload.tsx`).
- `lib/integrations-openai-ai-server` is leftover from before the provider switch to Claude and is no longer imported anywhere — a candidate for removal in its own cleanup pass, not done here.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
