import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
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

const resend = new Resend(requireEnv("RESEND_API_KEY"));
// Resend's sandbox-only default sender — works without any setup, but can
// only deliver to the email address on the Resend account itself until a
// real sending domain is verified there. Override once one exists.
const resendFromEmail = process.env["RESEND_FROM_EMAIL"] ?? "PetHealth <onboarding@resend.dev>";

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
    // A password account can't be trusted as "really belongs to this
    // email" until verification exists — see emailVerification below.
    // Google sign-in is unaffected: an OAuth provider's own confirmation
    // already satisfies this, better-auth doesn't re-require it there.
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    // Also fires on a blocked sign-in attempt (unverified account trying
    // to log in) — a built-in "forgot to check your email" recovery path
    // with no extra code needed here.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      // resend.emails.send() doesn't throw on a rejected send (e.g.
      // sandbox mode refusing a non-owner recipient) — it resolves with
      // an `error` field instead, which silently does nothing unless
      // explicitly checked. Confirmed this the hard way: a real signup
      // reported success with no email ever sent and nothing logged
      // anywhere pointing at why.
      const { error } = await resend.emails.send({
        from: resendFromEmail,
        to: user.email,
        subject: "Verify your email for PetHealth",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="font-size: 20px;">Verify your email</h1>
            <p>Click the button below to verify ${user.email} and finish setting up your PetHealth account.</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background: #0f766e; color: #fff; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-weight: bold;">
                Verify email
              </a>
            </p>
            <p style="color: #666; font-size: 13px;">If you didn't create a PetHealth account, you can ignore this email.</p>
          </div>
        `,
      });
      if (error) {
        throw new Error(`Resend failed to send a verification email to ${user.email}: ${error.message}`);
      }
    },
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
