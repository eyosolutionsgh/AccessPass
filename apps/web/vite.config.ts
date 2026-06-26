import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Never inline the country flag SVGs as data-URIs — keeping them as separate
    // files means the browser only fetches the few flags actually shown (and
    // caches them), instead of loading every flag up front inside the CSS.
    assetsInlineLimit(filePath) {
      if (filePath.includes('flag-icons')) return false;
      return undefined;
    },
    rollupOptions: {
      output: {
        // Split the always-loaded vendor code into logical chunks so no single
        // chunk trips Vite's 500 kB warning. Route pages are additionally
        // code-split via React.lazy in src/App.tsx. All chunks are emitted
        // locally and served same-origin — no CDN/remote imports (air-gap safe).
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
            return 'react-vendor';
          if (/[\\/]node_modules[\\/](@trpc|@tanstack|superjson)[\\/]/.test(id))
            return 'data-vendor';
          if (id.includes('better-auth')) return 'auth-vendor';
          if (id.includes('socket.io') || id.includes('engine.io')) return 'realtime-vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API + auth + tRPC to the server during dev (avoids CORS in the browser).
      '/trpc': 'http://localhost:4000',
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
