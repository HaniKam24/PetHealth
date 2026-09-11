import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HeartPulse, UserPlus, MailCheck } from 'lucide-react';
import { useSignUp } from '@clerk/react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

// See extractErrorMessage in login.tsx for why this is defensive rather
// than assuming one error shape.
function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'errors' in error) {
    const clerkErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const first = clerkErrors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const { signUp } = useSignUp();
  const [formError, setFormError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setFormError(null);
    // A single "name" field maps to Clerk's firstName — only actually
    // collected if "First and last name" is enabled for this Clerk
    // instance (Dashboard -> User & authentication -> Personal information).
    const { error } = await signUp.password({
      emailAddress: values.email,
      password: values.password,
      firstName: values.name,
    });

    if (error) {
      setFormError(extractErrorMessage(error, 'Could not create your account.'));
      return;
    }

    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: () => setLocation('/') });
      return;
    }

    // Default Clerk behavior: email must be verified before the account is
    // usable. If email verification is turned off for this Clerk instance,
    // signUp.status will already be 'complete' above and this is skipped.
    await signUp.verifications.sendEmailCode();
    setVerifying(true);
  };

  const handleVerify = async () => {
    setVerifyError(null);
    setIsVerifying(true);
    try {
      await signUp.verifications.verifyEmailCode({ code });
      if (signUp.status === 'complete') {
        await signUp.finalize({ navigate: () => setLocation('/') });
      } else {
        setVerifyError('That code didn\'t complete sign-up — double check it and try again.');
      }
    } catch (error) {
      setVerifyError(extractErrorMessage(error, "That code wasn't right. Try again."));
    } finally {
      setIsVerifying(false);
    }
  };

  if (verifying) {
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
              <h1 className="text-2xl font-serif font-medium text-foreground">Verify your email</h1>
              <p className="text-muted-foreground text-sm mt-1">We sent a code to {form.getValues('email')}.</p>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <label className="text-sm font-medium leading-none">Verification code</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="h-11 mt-2"
                />
              </div>

              {verifyError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{verifyError}</p>
              )}

              <Button type="button" size="lg" className="w-full" disabled={isVerifying || !code} onClick={handleVerify}>
                <MailCheck size={18} />
                Verify and finish
              </Button>

              <button
                type="button"
                onClick={() => void signUp.verifications.sendEmailCode()}
                className="text-sm text-primary font-medium hover:underline w-full text-center"
              >
                Send a new code
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-serif font-medium text-foreground">Create your account</h1>
            <p className="text-muted-foreground text-sm mt-1">Up to 3 pets, one place for their whole history.</p>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your name</FormLabel>
                      <FormControl>
                        <Input autoComplete="name" placeholder="Jamie Rivera" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        <Input type="password" autoComplete="new-password" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {formError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{formError}</p>
                )}

                {/* Clerk's bot-protection widget (CAPTCHA), shown only when the
                    instance has it enabled. Invisible otherwise. */}
                <div id="clerk-captcha" />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  <UserPlus size={18} />
                  Create account
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
