import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [
    // Sentry MUSS vor SvelteKit kommen!
    sentrySvelteKit({
      // Source maps upload (optional - requires auth token)
      // sourceMapsUploadOptions: {
      //   org: 'assixx',
      //   project: 'javascript-sveltekit',
      //   authToken: process.env.SENTRY_AUTH_TOKEN,
      // },
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

    // HMR Configuration (Best Practice 2025)
    hmr: {
      overlay: true,
      port: 5173,
      protocol: 'ws',
      host: 'localhost',
    },

    // Proxy zum NestJS Backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
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

  resolve: {
    alias: {
      // Bereits in svelte.config.js definiert, hier für IDE Support
    },
  },

  // Build Optimierungen
  build: {
    rollupOptions: {
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
      },
    },
    // SvelteKit SSR bundles are large due to:
    // 1. Svelte runtime (~400 kB) shared across all routes
    // 2. Component hydration code bundled together for efficiency
    // Gzipped sizes are acceptable: 361 kB + 229 kB = ~590 kB total
    // For internal SaaS app, this is fine. Public-facing would need dynamic imports.
    chunkSizeWarningLimit: 850,
  },

  // CRITICAL: Strip console.* and debugger in production builds
  // This removes ALL 331+ console calls from the production bundle
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
