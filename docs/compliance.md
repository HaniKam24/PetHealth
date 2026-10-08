# Compliance & Privacy — Working Notes

**This is not legal advice, and nothing in this file is a compliance claim made to
users.** It's an engineering-facing working document: what data this app actually
collects, where it actually flows, what's already in place, and what's genuinely
missing. Before anything here gets turned into a public privacy policy or an actual
compliance claim, get a real privacy/legal professional to review it — especially
before marketing to or signing up users in the EU (GDPR), California (CCPA/CPRA),
or any jurisdiction with its own rules.

Last verified against the codebase: 2026-10-08.

## 1. What data this app actually collects

**Account data:** name, email, password (hashed, never stored in plain text — see
`lib/auth/src/auth.ts`, handled by better-auth).

**Pet data:** name, species, breed, sex, birth date, weight, photo, free-text notes,
vet contact info (name, clinic, phone, address).

**Health data:** health records (visit/vaccine/lab/surgery/note, each with an
optional uploaded document or linked URL), medications (dose, schedule), symptom
logs and structured symptom journal entries (appetite, energy, stool quality,
vomiting, limping, behavior notes), weight logs.

**AI interaction data:** every Pawlie conversation — the owner's question and the
full generated answer — stored indefinitely per pet (`insights` table), plus any
AI-proposed action (`ai_actions`) and its outcome.

**Uploaded documents:** vet reports/invoices (PDF or image), stored in a private
Supabase Storage bucket. Pet photos, stored in a separate public bucket (see
`lib/storage.ts` — this split is deliberate, see §3 below).

**Sitter-sharing data:** when an owner creates a share link, a subset of the above
(vet contact, active medications, free-text care notes) becomes viewable by anyone
with the link — no account required on the sitter's end. Links are read-only,
expire, and can be revoked (`share-links.ts`).

**Technical/session data:** the auth session cookie, server request logs
(deliberately minimal — method, path, status code only; no headers or request
bodies logged, see `app.ts`'s `pinoHttp` config). Since adding Sentry (PR #79),
error reports may include an IP-derived approximate geographic location — see the
open question in §5.

## 2. Who else this data flows to (sub-processors)

| Service | What it receives | Why |
|---|---|---|
| **Supabase** | All of §1 — it's the database and file storage | Primary data store |
| **Anthropic (Claude API)** | Pet records relevant to a Pawlie question or Smart Upload document, sent as part of the AI prompt | Powers Pawlie chat and document extraction |
| **Render** | Everything, as the hosting platform | Runs the app |
| **Sentry** | Error reports: stack traces, request context, approximate IP-derived location (see §5) | Error tracking (PR #79) |
| **Google Fonts** | Visitor IP address (not a cookie — a side effect of loading fonts live from `fonts.googleapis.com`) | Typography |

Anthropic receiving real pet health data as part of every Pawlie/Smart-Upload call
is worth being deliberately aware of — it's the one sub-processor relationship where
actual health content (not just account metadata) leaves Supabase and goes to a
third party on every AI interaction. This is inherent to how the AI features work,
not a bug, but it belongs in any real privacy policy's sub-processor list.

## 3. What's already in place (verified, not assumed)

- Every pet-scoped database query is checked against the authenticated owner —
  confirmed by reviewing all ~50 API routes, not just spot-checked.
- Vet documents (the actually sensitive uploads) live in a **private** storage
  bucket behind short-lived (1-hour) signed URLs, minted fresh per view — never a
  long-lived link. Pet photos are deliberately in a separate **public** bucket,
  since they're not sensitive and need to load repeatedly without re-signing.
- Sitter share links are read-only, have an expiration date, and can be revoked
  early by the owner.
- Pet-level deletion exists today: an owner can remove a pet's profile and its
  records from the profile page.
- Passwords are hashed, never stored or logged in plain text.
- CORS, security headers, rate limiting, and known dependency vulnerabilities were
  hardened in PR #78 — see that PR for detail.
- Session cookie flags (`HttpOnly`, `Secure` in production, `SameSite=Lax`) were
  verified correct by reading the actual auth library's source, not just assumed.

## 4. Regulatory landscape — what likely applies

- **HIPAA — does not apply.** HIPAA covers human health information held by
  covered entities (providers, insurers, etc.). Pet/veterinary data isn't in scope.
  Already correctly noted in `docs/PRD.md`.
- **GDPR (EU)** — would apply the moment any EU resident signs up. Relevant rights:
  access, erasure ("right to be forgotten"), portability, and a lawful basis for
  processing. See gaps in §5 — several of these aren't implemented yet.
- **CCPA/CPRA (California)** — similar rights (access, deletion, opt-out of sale —
  this app doesn't sell data, so that part's moot) if California residents sign up.
- **COPPA (children's privacy)** — likely not applicable; this app isn't directed
  at or knowingly collecting from children. Worth a deliberate "13+ only" statement
  in terms of service if one ever gets written, mostly as a formality.
- **State-level veterinary/pet-data-specific rules** — none identified. This is a
  consumer record-keeping app, not a licensed veterinary practice or pharmacy, so
  veterinary-practice-specific regulation likely doesn't apply, but this hasn't
  been researched deeply and isn't a legal conclusion.

## 5. Open gaps (concrete, not yet built)

Roughly in order of how foundational they are:

1. **No privacy policy or terms of service exist anywhere** — not linked in the
   footer, not written. This is the most basic missing piece; most of the rights
   below are meaningless to a user without a document telling them what's
   collected and what their options are.
2. **No full-account deletion.** Pet-level deletion exists, but there's no path to
   delete an entire account and all associated data — relevant to GDPR's right to
   erasure and CCPA's right to delete.
3. **No data export.** No way for an owner to download everything stored about
   their account/pets — relevant to GDPR's right to data portability.
4. **Sentry's IP-derived geolocation** — flagged in an earlier conversation, not
   yet resolved. Need to confirm whether this reflects real visitor IPs once
   requests flow through the live Express app (vs. the standalone test script
   that surfaced it) and decide whether to configure Sentry's PII handling
   explicitly rather than leave it on default behavior.
5. **Google Fonts loaded live from Google's CDN** — sends every visitor's IP to
   Google on every page load. A 2022 German court ruling specifically flagged this
   pattern as a GDPR issue independent of cookies. Fix, if pursued: self-host the
   font files instead of loading from `fonts.googleapis.com`.
6. **No documented data retention policy.** Pawlie conversations, symptom logs,
   etc. are currently kept indefinitely with no defined retention/deletion
   schedule — not necessarily wrong, but undocumented.
7. **No formal sub-processor disclosure to users** — §2's table exists here, but
   nothing user-facing tells an owner their pet's health questions are sent to
   Anthropic, or that files live on Supabase's infrastructure.
8. **No cookie consent banner — and per the conversation that led to this doc,
   none is currently needed.** The only cookie in use is the strictly-necessary
   session cookie, exempt under GDPR/ePrivacy and CCPA-style frameworks. Documented
   here so the reasoning isn't lost, not because it's unresolved.

## 6. Suggested next steps, if this gets pursued further

None of this is committed to yet — these are options to discuss, not a plan:

- Write an actual privacy policy and terms of service (likely needs real legal
  input, not just an AI-drafted document, before being published as binding).
- Decide whether full-account deletion and data export are worth building before
  or after the first real external users, given the PRD's own billing/plan work
  is similarly still "if pursued at all."
- Decide whether to self-host fonts (small, contained fix) independent of the
  broader privacy-policy question.
- Revisit this file whenever a new third-party service gets added (another
  sub-processor) or a new jurisdiction's users become relevant.
