import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Preprocessor für TypeScript und PostCSS
  preprocess: vitePreprocess(),

  kit: {
    // Node Adapter für NestJS Backend Kompatibilität
    adapter: adapter({
      out: 'build',
      precompress: true,
    }),

    // Aliases für saubere Imports
    alias: {
      $components: 'src/lib/components',
      $ui: 'src/lib/components/ui',
      $layout: 'src/lib/components/layout',
      $features: 'src/lib/components/features',
      $stores: 'src/lib/stores',
      $utils: 'src/lib/utils',
      $types: 'src/lib/types',
      $styles: 'src/styles',
      '$design-system': 'src/design-system',
    },

    // CSP Headers für Sicherheit
    // nonce-based: SvelteKit generates per-request cryptographic nonce for inline SSR scripts
    // This is strictly better than unsafe-inline — only scripts with the correct nonce execute
    // @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 6.6)
    csp: {
      mode: 'nonce',
      directives: {
        'default-src': ['self'],
        // nonce added automatically by SvelteKit for inline scripts (SSR hydration)
        // Cloudflare Turnstile widget loads from challenges.cloudflare.com
        'script-src': ['self', 'https://challenges.cloudflare.com'],
        // Allow styles: self + inline + Google Fonts
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        // Allow fonts: self + Google Fonts
        'font-src': ['self', 'https://fonts.gstatic.com'],
        // Allow connections: Sentry + WebSocket (dev + prod)
        'connect-src': [
          'self',
          '*.ingest.de.sentry.io',
          '*.sentry.io',
          'ws://localhost:*',
          'wss://*.assixx.com',
        ],
        // Allow Web Workers (CryptoWorker uses blob: in dev, self in prod)
        'worker-src': ['self', 'blob:'],
        // Allow images: self + data URIs (for inline SVGs, etc.)
        'img-src': ['self', 'data:', 'blob:'],
        // Cloudflare Turnstile renders challenge in an iframe
        'frame-src': ['https://challenges.cloudflare.com'],
        // Security: block object embeds and frame ancestors
        'object-src': ['none'],
        'base-uri': ['self'],
        'frame-ancestors': ['none'],
      },
    },

    // Experimental features for Sentry instrumentation
    experimental: {
      // Required for Sentry server-side tracing
      instrumentation: {
        server: true,
      },
    },
  },
};

export default config;
