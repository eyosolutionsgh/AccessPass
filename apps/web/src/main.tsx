import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App.tsx';
import { BrandThemeSync } from './components/BrandThemeSync.tsx';
import { createTrpcClient, trpc } from './lib/trpc.ts';
import { applyCachedBrandTheme } from './lib/theme.ts';
import './index.css';

// Apply the cached brand colour before first paint so returning users don't flash the default.
applyCachedBrandTheme();

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrandThemeSync />
        <App />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
