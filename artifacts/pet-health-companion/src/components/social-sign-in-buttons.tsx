import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export default function SocialSignInButtons() {
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    });

    if (signInError) {
      setError(signInError.message ?? 'Could not sign in with Google.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 rounded-full"
        onClick={signInWithGoogle}
      >
        <FcGoogle size={18} />
        Google
      </Button>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
