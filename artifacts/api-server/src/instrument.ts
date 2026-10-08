import * as Sentry from "@sentry/node";

// Side-effect-only module, imported first (before ./app) in index.ts —
// Sentry's own docs require init() to run before anything else so its
// auto-instrumentation can patch Express/Node internals before they're
// used. Silently a no-op with no DSN set (e.g. local dev) rather than
// throwing, since error tracking isn't required to run the app locally.
const dsn = process.env["SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    dsn,
    // Sentry's own default is "production" whenever NODE_ENV isn't exactly
    // "production" — meaning every error from a local dev machine would
    // otherwise land in Sentry tagged (and alerted on) as real production
    // traffic, indistinguishable from an actual user hitting it. Render
    // sets NODE_ENV=production explicitly (see render.yaml); anywhere else
    // this reports as "development".
    environment: process.env["NODE_ENV"] === "production" ? "production" : "development",
  });
}
