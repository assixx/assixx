/**
 * Storybook Main Configuration
 * Assixx Design System
 *
 * Framework: HTML + Vite
 * Purpose: Interactive component documentation
 */

export default {
  // Story files location
  stories: ['../design-system/stories/**/*.stories.@(js|jsx|ts|tsx|mdx)'],

  // Addons (essentials are now built into Storybook 9 core)
  addons: [
    // Navigate between stories
    '@storybook/addon-links',
    '@storybook/addon-docs',
  ],

  // Framework (Storybook 9 - HTML for Vanilla JS/Plain HTML)
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },

  // Vite configuration
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    const tailwindcss = await import('@tailwindcss/vite');

    return mergeConfig(config, {
      // Use same resolve config as main app
      resolve: {
        alias: {
          '@': '/frontend/src',
          '@styles': '/frontend/src/styles',
          '@design-system': '/frontend/src/design-system',
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
  staticDirs: ['../frontend/static'],
};
