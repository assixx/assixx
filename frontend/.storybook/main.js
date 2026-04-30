/**
 * Storybook Main Configuration
 * Assixx Design System
 *
 * Framework: HTML + Vite
 * Purpose: Interactive component documentation
 *
 * NOTE: configDir is frontend/.storybook/ (via -c flag in package.json).
 * Storybook's Vite builder auto-detects frontend/vite.config.ts from the
 * parent directory, which loads sveltekit() and sentrySvelteKit() plugins.
 * These override Vite's root and break path resolution for Storybook.
 * We use viteConfigPath: '' to skip loading that config entirely —
 * Storybook only needs Tailwind, not SvelteKit.
 */

export default {
  // Story files location
  stories: ['./stories/**/*.stories.@(js|jsx|ts|tsx|mdx)'],

  // Addons (essentials are now built into Storybook 9 core)
  addons: [
    // Navigate between stories
    '@storybook/addon-links',
    '@storybook/addon-docs',
  ],

  // Framework — html-vite, NOT sveltekit (stories are plain HTML/CSS)
  framework: {
    name: '@storybook/html-vite',
    options: {
      builder: {
        // Point to our minimal Storybook-only Vite config.
        // Without this, Storybook resolves projectRoot=frontend/ and
        // loads frontend/vite.config.ts which has sveltekit() + sentry.
        // Path is resolved relative to cwd; pnpm --filter sets cwd=frontend/.
        viteConfigPath: '.storybook/vite.config.js',
      },
    },
  },

  // Vite configuration
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    const tailwindcss = await import('@tailwindcss/vite');
    const path = await import('path');

    // pnpm --filter assixx-frontend sets cwd=frontend/, which is the
    // correct Vite root for Storybook (stories live under ./src/...).
    // Storybook would otherwise default root to configDir (.storybook/).
    const frontendRoot = process.cwd();
    config.root = frontendRoot;

    // Absolute filesystem paths for aliases
    const frontendSrc = path.resolve(frontendRoot, 'src');

    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': frontendSrc,
          '@styles': path.resolve(frontendSrc, 'styles'),
          '@design-system': path.resolve(frontendSrc, 'design-system'),
        },
      },

      // Tailwind Plugin - CRITICAL for utilities generation
      // @tailwindcss/vite handles all CSS processing (PostCSS not needed with Tailwind v4)
      plugins: [tailwindcss.default()],
    });
  },

  // Documentation (Storybook 9 - autodocs via tags: ['autodocs'] in stories)
  docs: {
    defaultName: 'Docs', // Name of the docs tab
  },

  // Static files (SvelteKit uses 'static' not 'public')
  staticDirs: ['../static'],
};
