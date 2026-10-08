import * as Sentry from "@sentry/node";

// Side-effect-only module, imported first (before ./app) in index.ts —
// Sentry's own docs require init() to run before anything else so its
// auto-instrumentation can patch Express/Node internals before they're
// used. Silently a no-op with no DSN set (e.g. local dev) rather than
// throwing, since error tracking isn't required to run the app locally.
const dsn = process.env["SENTRY_DSN"];

if (dsn) {
  Sentry.init({ dsn });
}
