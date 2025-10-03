/**
 * Storybook Main Configuration
 * Assixx Design System
 *
 * Framework: HTML + Vite
 * Purpose: Interactive component documentation
 */

export default {
  // Story files location
  stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx|mdx)'],

  // Addons
  addons: [
    '@storybook/addon-essentials', // Controls, Actions, Viewport, Backgrounds, Docs
    '@storybook/addon-links', // Navigate between stories
  ],

  // Framework (Storybook 8.6.14 - Web Components = Plain HTML support)
  framework: {
    name: '@storybook/web-components-vite',
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

      // CSS configuration
      css: {
        postcss: './frontend/postcss.config.js',
      },

      // Tailwind Plugin - CRITICAL for utilities generation
      plugins: [tailwindcss.default()],
    });
  },

  // Documentation
  docs: {
    autodocs: true, // Auto-generate docs for all stories
  },

  // Static files (only directories that exist)
  staticDirs: ['../frontend/public'],
};
