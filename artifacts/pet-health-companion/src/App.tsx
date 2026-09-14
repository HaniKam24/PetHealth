import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useListPets } from '@workspace/api-client-react';

import { PetProvider } from '@/context/pet-context';
import { Layout } from '@/components/layout';
import { useSession } from '@/lib/auth-client';

import Dashboard from '@/pages/dashboard';
import Records from '@/pages/records';
import Medications from '@/pages/medications';
import Reminders from '@/pages/reminders';
import Insights from '@/pages/insights';
import SmartUpload from '@/pages/smart-upload';
import Profile from '@/pages/profile';
import Onboarding from '@/pages/onboarding';
import Login from '@/pages/login';
import Signup from '@/pages/signup';

const ONBOARDING_PATH = '/onboarding';

const queryClient = new QueryClient();
const AUTH_PAGES = new Set(['/login', '/signup']);

function FullPageLoader() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );
}

// A brand-new (or newly pet-less) account has nowhere useful to go — every
// other page either 404s on missing data or shows its own "add a pet first"
// message. Rather than patching every entry point that links to
// /profile?new=true, this redirects the zero-pets case to the onboarding
// wizard from anywhere. Deliberately one-directional: the wizard's upload
// path creates the pet, then stays on /onboarding for its own review step
// before the "Let's go" button leaves — a "hasPets => redirect away from
// /onboarding" rule would fire the instant that pet exists and yank the user
// out from under their own review step. Someone already onboarded who
// navigates to /onboarding directly just sees the wizard again, equivalent
// to "Add another pet" — a harmless edge case, not worth the conflict.
function AuthedApp() {
  const { data: pets, isLoading: petsLoading } = useListPets();
  const [location, setLocation] = useLocation();
  const hasPets = (pets?.length ?? 0) > 0;

  useEffect(() => {
    if (petsLoading) return;
    if (!hasPets && location !== ONBOARDING_PATH) {
      setLocation(ONBOARDING_PATH);
    }
  }, [petsLoading, hasPets, location, setLocation]);

  if (petsLoading) {
    return <FullPageLoader />;
  }

  if (location === ONBOARDING_PATH) {
    return (
      <PetProvider>
        <Onboarding />
      </PetProvider>
    );
  }

  return (
    <PetProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/records" component={Records} />
          <Route path="/medications" component={Medications} />
          <Route path="/reminders" component={Reminders} />
          <Route path="/insights" component={Insights} />
          <Route path="/smart-upload" component={SmartUpload} />
          <Route path="/profile" component={Profile} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </PetProvider>
  );
}

function Router() {
  const { data: session, isPending } = useSession();
  const [location, setLocation] = useLocation();
  const isAuthPage = AUTH_PAGES.has(location);

  useEffect(() => {
    if (isPending) return;
    if (!session && !isAuthPage) {
      setLocation('/login');
    } else if (session && isAuthPage) {
      setLocation('/');
    }
  }, [session, isPending, isAuthPage, setLocation]);

  if (isPending) {
    return <FullPageLoader />;
  }

  if (!session) {
    return (
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route>
          <FullPageLoader />
        </Route>
      </Switch>
    );
  }

  return (
    <RoutedErrorBoundary>
      <AuthedApp />
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
