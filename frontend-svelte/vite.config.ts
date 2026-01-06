import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Tailwind MUSS vor SvelteKit kommen!
    tailwindcss(),
    sveltekit(),
  ],

  server: {
    port: 5174,
    strictPort: true, // Fail if port 5174 is unavailable (5173 = legacy Vite)

    // HMR Configuration (Best Practice 2025)
    hmr: {
      overlay: true,
      port: 5174,
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
        manualChunks(id) {
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
});
