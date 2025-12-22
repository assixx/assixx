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
    // Chunk Strategy wie im Original
    rollupOptions: {
      output: {
        manualChunks(id) {
          // EventCalendar Bundle
          if (id.includes('@event-calendar/')) {
            return 'event-calendar';
          }
          // Marked.js für Markdown
          if (id.includes('marked')) {
            return 'marked';
          }
          // DOMPurify
          if (id.includes('dompurify')) {
            return 'vendor-utils';
          }
          // tRPC
          if (id.includes('@trpc/')) {
            return 'trpc';
          }
        },
      },
    },
  },
});
