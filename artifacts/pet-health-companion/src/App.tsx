import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import { PetProvider } from '@/context/pet-context';
import { Layout } from '@/components/layout';

import Dashboard from '@/pages/dashboard';
import Records from '@/pages/records';
import Medications from '@/pages/medications';
import Reminders from '@/pages/reminders';
import Insights from '@/pages/insights';
import Profile from '@/pages/profile';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
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
