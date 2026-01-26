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
    // Sentry + Google Fonts must be whitelisted
    csp: {
      mode: 'auto',
      directives: {
        // Allow connections to Sentry for error/performance data
        'connect-src': ['self', '*.ingest.de.sentry.io', '*.sentry.io'],
        // Allow scripts: self + inline (Svelte) + Sentry
        'script-src': ['self', 'unsafe-inline'],
        // Allow styles: self + inline + Google Fonts
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        // Allow fonts: self + Google Fonts
        'font-src': ['self', 'https://fonts.gstatic.com'],
        // Allow Sentry replay worker
        'worker-src': ['self', 'blob:'],
        // Allow images: self + data URIs (for inline SVGs, etc.)
        'img-src': ['self', 'data:', 'blob:'],
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
