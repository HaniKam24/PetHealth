import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { dash } from "@better-auth/infra";
import { db, users, sessions, accounts, verifications } from "@workspace/db";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set. Did you forget to provision it?`);
  }
  return value;
}

const webOrigins = (process.env["WEB_ORIGIN"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const googleClientId = process.env["GOOGLE_CLIENT_ID"];
const googleClientSecret = process.env["GOOGLE_CLIENT_SECRET"];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { users, sessions, accounts, verifications },
  }),
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL: requireEnv("BETTER_AUTH_URL"),
  trustedOrigins: webOrigins,
  emailAndPassword: {
    enabled: true,
  },
  // Google "sign in with" button. Only turns on once its real credentials
  // are set — until then these env vars are unset and the provider is left
  // out entirely, so this is safe to deploy early.
  // Apple sign-in was dropped for now (needs a paid $99/year Apple Developer
  // account) — revisit if that becomes worth it.
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
  },
  user: {
    modelName: "users",
    additionalFields: {
      // Which plan this account is on. Only "free" is ever actually set
      // today — there's no payment integration yet, so nothing writes
      // anything else here. `input: false` is deliberate: it stops
      // better-auth's own update-user endpoint from letting someone set
      // this on themselves client-side. Once billing is wired up, only
      // the backend (e.g. a payment-provider webhook) should ever change
      // this field.
      plan: {
        type: "string",
        required: true,
        defaultValue: "free",
        input: false,
      },
    },
  },
  session: { modelName: "sessions" },
  account: {
    modelName: "accounts",
    accountLinking: {
      // Google always reports email_verified: true for its standard
      // scope (confirmed against a real OAuth response, not assumed) —
      // explicit here anyway per better-auth's own docs example, rather
      // than relying silently on that external behavior staying true.
      trustedProviders: ["google"],
      // better-auth's default (true) also requires the *existing local*
      // account's row to already have emailVerified: true before letting
      // a new OAuth sign-in attach to it — a real protection against
      // someone pre-registering a password account at your email, then
      // inheriting your Google identity when you later sign in with it,
      // while still holding the password they set. This app has no local
      // email-verification step at all, though, so that flag can never
      // be true for *any* account — leaving the default on would block
      // linking permanently for every single existing user, not just
      // guard against the attack it's meant for. Turned off deliberately;
      // revisit if this app ever adds real email verification.
      // NOTE: better-auth has marked this option deprecated — a future
      // minor version removes it and makes the gate unconditional, which
      // would silently reintroduce this block on a routine dependency
      // bump. Check this comment against the changelog when upgrading
      // better-auth.
      requireLocalEmailVerified: false,
    },
  },
  verification: { modelName: "verifications" },
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  plugins: [
    dash({
      apiKey: requireEnv("BETTER_AUTH_API_KEY"),
    }),
  ],
});
