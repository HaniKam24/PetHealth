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
- **COPPA (children's privacy)** — likely not applicable; this app isn't directed
  at or knowingly collecting from children. Worth a deliberate "13+ only" statement
  in terms of service if one ever gets written, mostly as a formality.
- **State-level veterinary/pet-data-specific rules** — none identified. This is a
  consumer record-keeping app, not a licensed veterinary practice or pharmacy, so
  veterinary-practice-specific regulation likely doesn't apply, but this hasn't
  been researched deeply and isn't a legal conclusion.

### 4a. USA specifics

- **No single comprehensive federal privacy law.** The US regulates privacy
  sector-by-sector (HIPAA for health, COPPA for kids, GLBA for financial) plus one
  broad catch-all: **the FTC Act's ban on "unfair or deceptive practices."** In
  practice, this means: once a privacy policy exists and makes promises, the FTC
  can enforce against the company for not actually following them. Reason to write
  one carefully, not a reason to avoid writing one.
- **Every US state now has a data breach notification law** — if personal data is
  ever breached, there's a legal obligation to notify affected individuals (and
  sometimes the state AG) within a set window, commonly 30–60 days depending on
  the state. This applies *regardless of company size* — no revenue or user-count
  threshold. See gap in §5.
- **State comprehensive privacy laws (California's CCPA/CPRA, plus a fast-growing
  list — Virginia, Colorado, Connecticut, and others since 2023)** grant rights
  like access, deletion, and opt-out of sale. Each has its own applicability
  thresholds — CCPA/CPRA's are roughly: $25M+ annual revenue, OR personal data on
  100,000+ consumers, OR 50%+ of revenue from selling/sharing personal data. **At
  this app's current scale, these almost certainly don't apply yet.** Worth
  knowing the thresholds so effort isn't spent on something not yet legally
  required — but also worth building the underlying capability (deletion, export)
  before crossing them, since retrofitting under pressure is worse than having it
  ready.

### 4b. EU specifics

- **GDPR** — would apply the moment any EU resident signs up. Relevant rights:
  access, erasure ("right to be forgotten"), portability, and a lawful basis for
  processing every category of data collected. See gaps in §5 — several of these
  aren't implemented yet.
- **Pet health data is very likely *not* GDPR "special category data."** Article
  9's strictest protections (effectively requiring explicit consent, not just
  ordinary justification) apply to health data about *identifiable natural
  persons*. A dog's vaccine record isn't that — same reasoning as the HIPAA
  finding above, just under a different law. Good news, not a gap — noted here so
  it's a deliberate conclusion, not an assumption.
- **Data Processing Agreements (DPAs) are required with every sub-processor**
  handling EU personal data — Supabase, Anthropic, Render, Sentry (see §2's
  table). All four are mainstream SaaS vendors that already publish standard
  GDPR-ready DPAs; for most, accepting one is a checkbox in their own dashboard,
  not a document either of us would draft. Still needs to actually be done per
  vendor — see gap in §5.
- **International data transfers** — if any sub-processor handles EU data outside
  the EU (likely, all four are US-based), GDPR requires a valid transfer
  mechanism (the EU-US Data Privacy Framework, or Standard Contractual Clauses).
  Most major vendors already offer one by default as part of their DPA — worth
  confirming per vendor rather than assuming.
- **EU representative (GDPR Article 27)** — a company with no EU presence that
  offers services to EU residents technically needs to appoint an EU
  representative, unless processing is occasional/low-risk. Easy to overlook for
  a small US team. Only relevant once EU signups are actually being accepted, not
  before.
- **The EU AI Act** — a current, real EU regulation specifically for AI systems,
  directly relevant here because of Pawlie. It sorts AI systems into risk tiers;
  a pet-advice chatbot that explicitly discloses it's AI and isn't medical advice
  (which Pawlie's UI already does — the "Written by AI · not medical advice"
  labeling) almost certainly lands in the lower-risk "transparency obligation"
  tier, not the high-risk tier (which covers things like actual medical device
  software). Worth awareness, not urgent, and the app's existing disclaimer
  design already happens to align with what that tier expects.

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
9. **No breach notification plan.** Every US state legally requires notifying
   affected users within a set window if personal data is breached — this one
   applies regardless of company size, unlike the threshold-gated state privacy
   laws. Right now there's no documented "what do we actually do" process.
10. **No Data Processing Agreements signed with any sub-processor** (Supabase,
    Anthropic, Render, Sentry) — required under GDPR once EU users are in the
    picture. Likely a quick per-vendor checkbox, not a drafting exercise, but
    hasn't actually been done for any of the four yet.
11. **International data transfer mechanisms not confirmed per vendor.** All four
    sub-processors likely already offer a valid mechanism by default (EU-US Data
    Privacy Framework or Standard Contractual Clauses) — this gap is "hasn't been
    checked," not "known to be missing."

## 6. Suggested next steps, if this gets pursued further

None of this is committed to yet — these are options to discuss, not a plan:

- Write an actual privacy policy and terms of service (likely needs real legal
  input, not just an AI-drafted document, before being published as binding).
- Decide whether full-account deletion and data export are worth building before
  or after the first real external users, given the PRD's own billing/plan work
  is similarly still "if pursued at all."
- Decide whether to self-host fonts (small, contained fix) independent of the
  broader privacy-policy question.
- Check each sub-processor's dashboard for a DPA to accept (Supabase, Anthropic,
  Render, Sentry) — likely low-effort, hasn't been done yet.
- Write down an actual breach-notification process, even a short one — this is
  the one item here that's a legal requirement regardless of how small the app
  still is.
- Revisit this file whenever a new third-party service gets added (another
  sub-processor) or a new jurisdiction's users become relevant.
