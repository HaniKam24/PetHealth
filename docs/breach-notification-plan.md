# Data Breach Notification Plan — Working Draft

**This is not legal advice.** This is a practical, working first draft of "what do we
actually do if something goes wrong" — written so there's *something* in place
instead of nothing, per gap #9 in `docs/compliance.md`. Before this is treated as a
final/binding process, get it reviewed by a real privacy/legal professional, since
exact notification deadlines and requirements vary by US state and aren't all listed
here precisely. The goal of this draft is to make sure that if a breach happened
today, we wouldn't be figuring out the entire process from scratch under pressure.

## 1. What counts as a "breach" here

Any of the following, involving data described in `compliance.md` §1 (account info,
pet/health data, uploaded documents, AI conversation history):

- Unauthorized access to the Supabase database or storage buckets (e.g. a leaked
  service-role key, a misconfigured access policy).
- Unauthorized access to the Render hosting account or deployment.
- A vulnerability that let one user see another user's data (even briefly, even if
  no evidence it was actually exploited beyond the person who found it).
- Loss or theft of a device with access to production credentials.
- A vendor (Supabase, Anthropic, Render, Sentry) notifying us of a breach on their
  end that affected our data.

Not every security bug is a breach — a bug that's caught and fixed before any
unauthorized access actually occurred isn't one. When in doubt, treat it as a
possible breach and work through this plan; it's cheaper to stand down than to
discover later it needed to happen sooner.

## 2. How we'd likely find out

- Sentry error alerts (see `docs/compliance.md` — error tracking added in PR #79)
  showing unusual error patterns (e.g. repeated auth/authorization failures).
- Supabase's own dashboard alerts or audit logs.
- A user reporting something looks wrong with their account or seeing another
  user's data.
- A vendor's own security notification (Supabase, Anthropic, Render, Sentry all
  have obligations to notify customers of incidents affecting their data).
- Unusual billing/usage spikes on any vendor dashboard, which can indicate
  unauthorized use of API keys.

## 3. Immediate response (first 24 hours)

1. **Contain it.** Depending on what's affected: rotate the leaked credential/key
   immediately (Supabase service role key, `BETTER_AUTH_SECRET`, `ANTHROPIC_API_KEY`,
   etc. — see `.env.example` for the full list of secrets in play), revoke active
   sessions if auth itself is compromised, or take the affected service offline if
   containment requires it.
2. **Don't destroy evidence.** Before cleaning anything up, capture what you can:
   relevant Sentry events, Supabase logs, Render deploy/access logs, timestamps.
   This matters both for understanding scope and because some notification
   requirements ask what was known and when.
3. **Figure out scope, roughly.** What data was actually exposed? How many users?
   Pet health data, account credentials, or both? This drives both urgency and who
   needs to be told.
4. **Both of us get looped in immediately** — this is a two-person team, so there's
   no "security team" to hand this to. Whoever discovers it tells the other
   immediately, not after trying to fix it alone first.

## 4. Notification — who, what, and roughly when

- **Affected users:** if personal data (account info, pet/health records, uploaded
  documents) was actually accessed or acquired without authorization, affected
  users need to be notified. Every US state has its own breach notification law;
  most require notice "without unreasonable delay," and several set an outer bound
  — commonly in the 30–60 day range from discovery, but this varies by state and
  genuinely needs real legal confirmation before relying on a specific number here.
  Don't wait for a lawyer to start drafting the user notification, but do get one
  before sending it if at all possible.
- **State Attorney General offices:** many states also require notifying the state
  AG once the number of affected residents crosses a threshold (often 500–1,000+,
  varies by state). Relevant once scope is known — most likely not applicable at
  this app's current user count, but worth checking per-state once a real incident
  has defined numbers.
- **Vendors:** if the breach originated in how we use a vendor (not the vendor's
  own fault), consider whether they need to know too (e.g. to help investigate, or
  per contract terms).

### What a user notification should include, at minimum

- What happened, in plain language (same tone as the rest of this codebase's
  user-facing writing — see `CLAUDE.md`'s note that both team members and, by
  extension, our users, prefer plain language over jargon).
- What data of theirs was involved — be specific (e.g. "your account email and
  pet records," not just "some data").
- What we've already done about it (contained, fixed, rotated credentials, etc).
- What they should do, if anything (e.g. "we recommend changing your password" —
  only if relevant).
- How to reach us with questions.

## 5. After the immediate response

- Write up what actually happened, how it was found, how it was fixed, and what's
  changing to prevent a repeat — even a short internal writeup. This becomes the
  record if anyone (a user, a regulator, a future legal review) asks later.
- Revisit whether this plan itself needs updating based on what was learned.
- If the breach involved a specific vendor's infrastructure rather than our own
  code, confirm what their own incident response/notification obligations covered
  versus what's on us.

## 6. Before this is "real"

This draft exists so there's a starting point, not because it's been reviewed by
anyone qualified to sign off on it. Before treating it as the actual plan:

- Have an actual privacy/legal professional review it, especially the notification
  timing — state requirements genuinely vary and matter here.
- Decide on a concrete internal contact point (even for a 2-person team, write
  down literally what "both of us get looped in" means in practice — text? call?).
- Revisit this whenever a new sub-processor is added or the user base grows enough
  that state AG notification thresholds become realistically relevant.
