import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

// Read package.json version at config-load time.
// Sync with Changesets: `pnpm changeset:version` bumps this field → next build
// picks up the new value automatically (no manual step required).
// See docs/how-to/HOW-TO-USE-CHANGESETS.md.
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => ({
  // Build-time constant replacement.
  // __APP_VERSION__ is substituted everywhere in source → version number in UI
  // stays in lockstep with package.json (Fixed-Group via Changesets).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  plugins: [
    // Sentry MUSS vor SvelteKit kommen!
    sentrySvelteKit({
      // Dev: disable auto-instrumentation to prevent SvelteKit dev-mode warnings
      // (history.pushState conflict with SvelteKit router, window.fetch wrapper).
      // tracesSampleRate: 0 in dev → no spans collected → no value lost.
      autoInstrument: mode !== 'development',
      autoUploadSourceMaps:
        process.env.SENTRY_AUTH_TOKEN !== undefined && process.env.SENTRY_AUTH_TOKEN !== '',
      sourceMapsUploadOptions: {
        org: 'assixx',
        project: 'javascript-sveltekit',
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
    // Tailwind MUSS vor SvelteKit kommen!
    tailwindcss(),
    sveltekit(),
    // Bundle Analyzer - generiert stats.html nach build
    // Nur bei ANALYZE=true: ANALYZE=true pnpm run build
    visualizer({
      filename: 'stats.html',
      open: process.env.ANALYZE === 'true',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // treemap | sunburst | network
    }),
  ],

  server: {
    port: 5173,
    strictPort: true, // Fail if port 5173 is unavailable

    // Allow `*.localhost` subdomains for ADR-050 local subdomain-routing tests.
    // Vite 5+ defaults allowedHosts to `['localhost']` as a DNS-rebinding
    // defence; without this entry a request to `testfirma.localhost:5173`
    // returns "Blocked request. This host is not allowed." and the whole dev
    // flow on subdomains breaks. The leading dot is Vite's subdomain-wildcard
    // marker — matches `firma-a.localhost`, `testfirma.localhost`, etc.
    // Plain `localhost` stays allowed by default; this is purely additive.
    //
    // @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Local Dev"
    // @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md D9
    allowedHosts: ['.localhost'],

    // HMR Configuration — do NOT pin hmr.port. Vite defaults to server.port,
    // which is correct when Vite runs on a non-default port (e.g. Playwright E2E
    // starts a second instance on 5174 via CLI --port). A hardcoded hmr.port
    // would make the HMR websocket try to connect to 5173 even when the server
    // listens on 5174, breaking smoke tests with "WebSocket handshake 400".
    hmr: {
      overlay: true,
      protocol: 'ws',
      host: 'localhost',
    },

    // Proxy zum NestJS Backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Ausnahme: /api/turnstile wird von SvelteKit selbst bedient
        // (siehe frontend/src/routes/api/turnstile/+server.ts). Ohne
        // diesen Bypass würde der Request an NestJS:3000 laufen und
        // dort mit 404 NOT_FOUND beantwortet — Signup-Flow brechen.
        // Wenn bypass einen Pfad zurückgibt, überspringt Vite den Proxy
        // und SvelteKit's Router übernimmt. Siehe HOW-TO-CLOUDFLARE-TURNSTILE.md.
        bypass: (req) => (req.url?.startsWith('/api/turnstile') === true ? req.url : undefined),
      },
      '/chat-ws': {
        target: 'ws://localhost:3000',
        changeOrigin: true,
        ws: true, // WebSocket Proxy für Chat
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },

    // WSL2/Docker Support - ALWAYS use polling for WSL2 file system
    watch: {
      usePolling: true,
      interval: 100, // 100ms like legacy frontend
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.svelte-kit/**'],
    },
  },

  // SSR: Bundle @assixx/shared instead of externalizing it.
  // inject-workspace-packages (pnpm) hard-copies instead of symlinking,
  // so Vite treats it as a regular dependency and externalizes it.
  // Without noExternal, Node.js tries to resolve subpath exports
  // (e.g. @assixx/shared/constants) at runtime via dist/ which may not exist.
  ssr: {
    noExternal: ['@assixx/shared'],
  },

  // Build Optimierungen
  build: {
    rolldownOptions: {
      output: {
        // Targeted chunking - only split heavy libraries, let SvelteKit handle the rest
        manualChunks(id: string) {
          // EventCalendar is the heaviest dependency (~236 kB)
          if (id.includes('@event-calendar/')) {
            return 'calendar';
          }
          // Markdown processing
          if (id.includes('marked')) {
            return 'markdown';
          }
          // HTML sanitization
          if (id.includes('dompurify')) {
            return 'sanitize';
          }
          // Let Vite/SvelteKit handle everything else automatically
        },
        // CRITICAL: Strip console.* and debugger in production builds
        // This removes ALL 331+ console calls from the production bundle
        // Vite 8: rolldownOptions.output.minify.compress (rolldown CompressOptions)
        ...(mode === 'production' ?
          {
            minify: {
              compress: {
                dropConsole: true,
                dropDebugger: true,
              },
            },
          }
        : {}),
      },
    },
    // SvelteKit SSR bundles are large due to:
    // 1. Svelte runtime (~400 kB) shared across all routes
    // 2. Component hydration code bundled together for efficiency
    // Gzipped sizes are acceptable: 361 kB + 229 kB = ~590 kB total
    // For internal SaaS app, this is fine. Public-facing would need dynamic imports.
    chunkSizeWarningLimit: 850,
  },
}));
