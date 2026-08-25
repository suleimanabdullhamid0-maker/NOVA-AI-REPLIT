import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { getGetCurrentUserQueryKey, useGetCurrentUser, useHealthCheck } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { NovaShell, SurfaceLoader } from '@/components/nova-shell';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthPage } from '@/pages/auth';
import { ChatPage } from '@/pages/chat';
import { SettingsPage } from '@/pages/settings';
import { PricingPage } from '@/pages/pricing';
import { AdminPage } from '@/pages/admin';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
    mutations: { retry: false },
  },
});

function Root() {
  const [, setLocation] = useLocation();
  const currentUser = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const health = useHealthCheck();
  useEffect(() => {
    if (!currentUser.isLoading) setLocation(currentUser.data ? '/chat' : '/login');
  }, [currentUser.isLoading, currentUser.data, setLocation]);
  if (currentUser.isLoading) return <SurfaceLoader />;
  return <div className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="rounded-2xl border border-border bg-card p-6 text-center text-sm"><p data-testid="status-health">NOVA {health.data?.status === 'ok' ? 'is online.' : 'is connecting.'}</p></div></div>;
}

function Protected({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const currentUser = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  useEffect(() => {
    if (currentUser.isError) setLocation('/login');
  }, [currentUser.isError, setLocation]);
  if (currentUser.isLoading || currentUser.isError || !currentUser.data) return <SurfaceLoader />;
  return <>{children}</>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={Root} />
    <Route path="/login"><AuthPage /></Route>
    <Route path="/signup"><AuthPage signup /></Route>
    <Route path="/chat"><Protected><ChatPageWithUser /></Protected></Route>
    <Route path="/settings"><Protected><SettingsPageWithUser /></Protected></Route>
    <Route path="/pricing"><Protected><PricingPageWithUser /></Protected></Route>
    <Route path="/admin"><Protected><AdminPageWithUser /></Protected></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function ChatPageWithUser() {
  const { data } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  return <ChatPage user={data} />;
}
function SettingsPageWithUser() {
  const { data } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  return <SettingsPage user={data} />;
}
function PricingPageWithUser() {
  const { data } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  return <PricingPage user={data} />;
}
function AdminPageWithUser() {
  const { data } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  return <AdminPage user={data} />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;