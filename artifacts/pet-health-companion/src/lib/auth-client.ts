import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
// Type-only import — erased at compile time, so this never actually pulls
// the server's betterAuth() instance (DB connection, secrets, etc.) into
// the frontend bundle. It's only here so TypeScript knows about custom
// fields like `plan` on session.user; the field itself is already present
// in the real API response regardless of this import.
import type { auth } from '@workspace/auth';

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
