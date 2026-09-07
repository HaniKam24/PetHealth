import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import { PetProvider } from '@/context/pet-context';
import { Layout } from '@/components/layout';
import { useSession } from '@/lib/auth-client';

import Dashboard from '@/pages/dashboard';
import Records from '@/pages/records';
import Medications from '@/pages/medications';
import Reminders from '@/pages/reminders';
import Insights from '@/pages/insights';
import Profile from '@/pages/profile';
import Login from '@/pages/login';
import Signup from '@/pages/signup';

const queryClient = new QueryClient();
const AUTH_PAGES = new Set(['/login', '/signup']);

function FullPageLoader() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );
}

function AuthedApp() {
  return (
    <PetProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/records" component={Records} />
          <Route path="/medications" component={Medications} />
          <Route path="/reminders" component={Reminders} />
          <Route path="/insights" component={Insights} />
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
