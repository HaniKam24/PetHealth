import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa6';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export default function SocialSignInButtons() {
  const [error, setError] = useState<string | null>(null);

  const signInWithProvider = async (provider: 'google' | 'apple') => {
    setError(null);
    const { error: signInError } = await authClient.signIn.social({
      provider,
      callbackURL: '/',
    });

    if (signInError) {
      setError(signInError.message ?? `Could not sign in with ${provider === 'google' ? 'Google' : 'Apple'}.`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full"
          onClick={() => signInWithProvider('google')}
        >
          <FcGoogle size={18} />
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full"
          onClick={() => signInWithProvider('apple')}
        >
          <FaApple size={18} />
          Apple
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
