import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HeartPulse, LogIn } from 'lucide-react';
import { useSignIn } from '@clerk/react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Clerk's returned `error` is either a ClerkAPIResponseError-shaped object
// (an `errors` array of { message, longMessage }) or something else entirely
// (a plain Error, a network failure) — extract defensively rather than
// assuming one shape, since the docs for this API surface are thin.
function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'errors' in error) {
    const clerkErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const first = clerkErrors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Could not sign in with those details.';
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { signIn } = useSignIn();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    const { error } = await signIn.password({
      emailAddress: values.email,
      password: values.password,
    });

    if (error) {
      setFormError(extractErrorMessage(error));
      return;
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => setLocation('/') });
    } else {
      setFormError('Sign-in needs an extra step this app does not support yet — contact support.');
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <HeartPulse size={24} strokeWidth={2.5} />
          </div>
          <span className="font-serif text-2xl font-medium text-foreground tracking-tight">Health Hub</span>
        </div>

        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="text-center pb-2">
            <h1 className="text-2xl font-serif font-medium text-foreground">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your household's pet records.</p>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" placeholder="you@example.com" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {formError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{formError}</p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  <LogIn size={18} />
                  Sign in
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          New here?{' '}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
