# Data Retention Policy — Working Draft

**This is not legal advice.** Like the other docs in this folder, this is an
engineering-facing working document, not something to publish as a user-facing
policy without real review first. It resolves gap #6 in `docs/compliance.md`:
there was no documented answer to "how long do we keep things, and why."

Everything below was checked against the actual code (schema `onDelete` behavior,
the pet-deletion route, better-auth's session config), not assumed — flagged
inline wherever that mattered.

Last verified against the codebase: 2026-10-08.

## 1. Core pet/health data — kept indefinitely, on purpose

Health records, medications, symptom logs, weight logs, Pawlie conversations
(`insights`), and `ai_actions` are all kept for as long as the pet profile exists,
with no automatic expiry. **This is a deliberate product decision, not an
oversight** — the entire point of this app is to be a pet's complete lifelong
health history. A vet record from three years ago is exactly as valuable as one
from last week; there's no natural "this is stale, delete it" point the way there
might be for, say, marketing analytics data.

Deleting a pet's profile (already built — see `compliance.md` §3) cascades
immediately via the database schema's `onDelete: "cascade"` relationships: health
records, medications, symptom entries, weight logs, insights, and ai_actions are
all deleted along with the pet, confirmed directly in `lib/db/src/schema/care.ts`,
`ai-actions.ts`, and `symptom-entries.ts`.

## 2. Uploaded files — mostly cleaned up, one confirmed gap

- **Health record documents** (vet PDFs/images in the private Supabase bucket):
  explicitly deleted from storage when a pet is deleted — confirmed in
  `artifacts/api-server/src/routes/care.ts`'s pet-delete route, which reads every
  attached document's storage path *before* the cascade delete removes the
  database rows, then calls `deleteDocumentBestEffort` on each file.
- **Pet photos** (public bucket): **not cleaned up.** The same delete route never
  touches `photoUrl` or removes the image file from storage — only health record
  documents are covered. Deleting a pet today leaves its photo file sitting in
  Supabase Storage forever, with nothing left pointing to it. This is a real,
  concrete gap found while writing this doc, not a retention *policy* question —
  it's a one-line fix (clean up the photo the same way documents already are),
  tracked here so it doesn't get lost. Worth fixing independent of any broader
  retention decisions.

## 3. Things that currently accumulate forever, with no cleanup job

None of these are actively harmful today, but none of them are deliberate either
— confirmed there's no scheduled job of any kind in this repo (no cron service in
`render.yaml`, nothing in `scripts/`) that purges any of the following:

- **Expired or revoked sitter share links** (`petShareLinks` table) — once a link
  expires or is revoked, the app correctly stops honoring it (verified in
  `share-links.ts`), but the database row itself is never deleted. These rows
  will grow forever, one per share link ever created.
- **Expired auth sessions** (`sessions` table) — better-auth's default session
  lifetime is 7 days (confirmed in the installed package: no `expiresIn` override
  is set in `lib/auth/src/auth.ts`, so the library default of `60 * 60 * 24 * 7`
  applies). The library stops honoring an expired session automatically, but
  again, nothing deletes the row afterward.

Neither of these is sensitive the way health data is — a stale, inert session or
share-link row can't be used for anything once expired/revoked. Still worth a
periodic cleanup eventually, both for database hygiene and because "we delete
things we no longer need" is generally the right default to be able to say.

## 4. Data retention this app doesn't control directly

- **Server request logs** — written to Render's own "Logs" tab (see
  `compliance.md` §1), retained per Render's own plan-level log retention, not
  something this app's code configures.
- **Sentry error reports** (once PR #79 merges) — retained per Sentry's own
  plan-level data retention settings in the Sentry dashboard, not app code.

Worth knowing these exist and are governed by vendor settings, in case a future
privacy policy needs to state a retention period for them — the honest answer is
"whatever the vendor's plan allows," unless that's explicitly configured
otherwise in each vendor's dashboard.

## 5. Account-level data

There's currently no full-account deletion (compliance.md gap #2) — so there's no
"account retention period" to document yet beyond "forever, until that feature
exists." Revisit this doc once account deletion is built, since that'll be the
actual trigger for most of what a real retention policy needs to say about
account-level data (name, email, password hash).

## 6. Suggested next steps

- Fix the pet-photo storage cleanup gap (§2) — small, contained, not a policy
  decision, just a bug.
- Decide whether to add a scheduled cleanup job for expired sessions and
  revoked/expired share links (§3), and if so, what interval makes sense — this
  isn't urgent, just currently undecided.
- Once full-account deletion (gap #2) exists, revisit §5 with an actual answer.
- Before any of this is restated in a public privacy policy, get real legal input
  on whether "indefinite, tied to account lifetime" is an acceptable framing for
  the core health data category, same caveat as the rest of this file.
