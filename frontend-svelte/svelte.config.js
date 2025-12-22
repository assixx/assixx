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
      $trpc: 'src/lib/trpc',
      $utils: 'src/lib/utils',
      $types: 'src/lib/types',
      $styles: 'src/styles',
    },

    // CSP Headers für Sicherheit
    csp: {
      mode: 'auto',
    },
  },
};

export default config;
