import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
const appleClientId = process.env["APPLE_CLIENT_ID"];
const appleClientSecret = process.env["APPLE_CLIENT_SECRET"];
const appleAppBundleIdentifier = process.env["APPLE_APP_BUNDLE_IDENTIFIER"];

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
  // Google/Apple "sign in with" buttons. Each provider only turns on once
  // its real credentials are set — until then these env vars are unset and
  // the provider is left out entirely, so this is safe to deploy early.
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
    ...(appleClientId && appleClientSecret
      ? {
          apple: {
            clientId: appleClientId,
            clientSecret: appleClientSecret,
            appBundleIdentifier: appleAppBundleIdentifier,
          },
        }
      : {}),
  },
  user: { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  advanced: {
    database: {
      generateId: "serial",
    },
  },
});
