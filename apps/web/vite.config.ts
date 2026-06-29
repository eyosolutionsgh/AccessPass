import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

function rootEnvValue(key: string) {
  if (process.env[key]) return process.env[key];
  try {
    const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    const line = env.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
    return line
      ?.split('=')
      .slice(1)
      .join('=')
      .trim()
      .replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_INTERNAL_WEB_ORIGIN': JSON.stringify(
      rootEnvValue('VITE_INTERNAL_WEB_ORIGIN'),
    ),
    'import.meta.env.VITE_LOCAL_WEB_ORIGIN': JSON.stringify(rootEnvValue('VITE_LOCAL_WEB_ORIGIN')),
  },
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
          // Rich-text editor — only reached via the lazy admin chunk, so keep it isolated.
          if (/[\\/]node_modules[\\/](@tiptap|prosemirror-)/.test(id)) return 'editor-vendor';
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
