import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './auth/AuthGate';
import { AutoUpdate } from './components/AutoUpdate';
import { applyTheme, readTheme } from './lib/theme';
import './index.css';

// The saved theme, before anything is drawn (the page has no inline script: its content policy does not allow one)
applyTheme(readTheme());

// What is on screen is what the server holds: refetch when coming back to the tab, never serve a stale list as final.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: 1, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AutoUpdate />
      <AuthGate>
        <App />
      </AuthGate>
    </QueryClientProvider>
  </StrictMode>,
);
