# Vendor International Data Transfer Mechanisms — Research Notes

**This is not legal advice.** Resolves gap #11 in `docs/compliance.md`: confirming,
per sub-processor, what legal mechanism each one actually offers for moving EU
personal data to the US (all four are US-based companies). Every claim below was
checked directly against that vendor's own published DPA or an official company
page — not a third-party summary site — with the source linked. This also directly
informs gap #10 (accepting each DPA), since it answers "what will I actually find
when I go look."

Last verified: 2026-10-08.

## Summary

| Vendor | Standard Contractual Clauses (SCCs) | EU-US Data Privacy Framework | How the DPA activates |
|---|---|---|---|
| **Supabase** | Yes, incorporated | Not mentioned in the DPA | Automatic — accepting Supabase's main Terms of Service has "the same effect as signing the SCCs." No separate signature. |
| **Anthropic** | Yes, incorporated (Module 2/3) | Not mentioned — SCCs are the only mechanism | Automatic — incorporated into the Commercial Terms of Service that API/paid customers already agree to. No separate signature. |
| **Render** | Yes, incorporated | **Yes — actively certified** (EU-US DPF + UK extension + Swiss-US DPF, effective Jan 6, 2025) | Incorporated into the Agreement automatically; DPA is a standalone page, no separate signature described. |
| **Sentry** | Yes, incorporated (fallback) | **Yes — self-certified**, this is the *primary* mechanism, SCCs are the fallback if DPF is ever invalidated | Automatic on accepting standard terms; Sentry also offers a documented formal "execute the DPA" path via their help center for anyone who wants a signed copy on file. |

**Bottom line: all four vendors already have a valid transfer mechanism in place
today**, two different ways:

- **Render and Sentry** both hold actual Data Privacy Framework certification —
  the stronger, more straightforward mechanism (a direct adequacy-style
  certification, not just a fallback contract clause).
- **Supabase and Anthropic** rely on Standard Contractual Clauses only. SCCs are
  a fully valid, standard mechanism under GDPR — just a contractual commitment
  rather than a government-certified program. This isn't a gap or a weaker
  position, just a different (and equally common) approach.

## Per-vendor detail

### Supabase
DPA: [supabase.com/legal/dpa](https://supabase.com/legal/dpa). Incorporates the
EU Commission's 2021 SCCs (Commission Implementing Decision (EU) 2021/914) —
Module 2 when we're the controller and Supabase the processor. The DPA text
states acceptance of Supabase's regular Terms of Service has "the same effect as
signing the Standard Contractual Clauses" — meaning this may already be in effect
simply by having a Supabase account, independent of any separate DPA-specific
action. Worth confirming directly with Supabase (or in their dashboard) whether
anything further needs to be explicitly accepted, or whether this is genuinely
already binding.

### Anthropic
DPA: [anthropic.com/legal/data-processing-addendum](https://www.anthropic.com/legal/data-processing-addendum).
Incorporates the EU Commission's 2021 SCCs (Module 2 and/or Module 3 depending on
role), automatically part of the Anthropic Commercial Terms of Service that
governs paid API usage (this app's Claude integration is exactly that — API
access via `ANTHROPIC_API_KEY`, not free consumer Claude.ai). No Data Privacy
Framework reference anywhere in the document — Anthropic relies on SCCs alone for
this.

### Render
DPA: [render.com/dpa](https://render.com/dpa). Incorporates SCCs, *and* separately
[announced EU-US Data Privacy Framework certification](https://render.com/changelog/render-achieves-certification-under-the-eu-us-data-privacy-framework)
effective January 6, 2025 — covering the EU-US DPF, its UK extension, and the
Swiss-US DPF. Of the four vendors, Render has the most explicit, most recently
confirmed transfer story.

### Sentry
DPA: [sentry.io/legal/dpa](https://sentry.io/legal/dpa/) (version 5.1.0, dated
May 29, 2024). States plainly: "Sentry complies with the Data Privacy Framework
in relation to transfers of Personal Data from Europe to the United States" — DPF
is the primary mechanism, with SCCs kicking in only if DPF is ever invalidated by
EU courts (as Privacy Shield, the DPF's predecessor, previously was). Sentry also
offers EU-region data hosting as an option, which would avoid the international
transfer question for this data entirely, if ever worth pursuing.

## What this means for gap #10 (accepting each vendor's DPA)

Based on the above, accepting each DPA is likely closer to "confirm it's already
in effect" than "go sign something new" — three of the four (Supabase, Anthropic,
Render) describe their DPA as automatically incorporated into the standard terms
already agreed to by having an account. Sentry explicitly offers a formal
acceptance path if a signed-and-dated copy on file is wanted rather than relying
on implicit acceptance. Concretely, when Samih/Hani get to gap #10, the actual
work is probably:

1. Check each vendor's account/dashboard settings for an explicit "Accept DPA"
   toggle or page (several vendors surface this even when it's also automatically
   covered by the ToS, so it's worth doing for a clear paper trail).
2. For Sentry specifically, consider using their documented formal execution path
   if a signed copy is wanted on record.
3. Keep a short note (even just a dated line in this file) once each is
   confirmed, so there's a record of when this was checked.

## Sources

- [Supabase Data Processing Addendum](https://supabase.com/legal/dpa)
- [Anthropic Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum)
- [Render Data Processing Addendum](https://render.com/dpa)
- [Render EU-US Data Privacy Framework certification announcement](https://render.com/changelog/render-achieves-certification-under-the-eu-us-data-privacy-framework)
- [Sentry Data Processing Addendum](https://sentry.io/legal/dpa/)
