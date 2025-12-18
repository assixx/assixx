/**
 * Storybook Preview Configuration
 * Global decorators, parameters, and styles
 */
// Import global styles
// NOTE: main.css already imports tailwind.css which includes design-system
import '../frontend/src/styles/dashboard-theme.css';
import '../frontend/src/styles/main.css';

/** @type { import('@storybook/html-vite').Preview } */
const preview = {
  // Parameters apply to all stories
  parameters: {
    // Actions
    actions: { argTypesRegex: '^on[A-Z].*' },

    // Controls
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },

    // Backgrounds - Match Assixx dark theme
    backgrounds: {
      options: {
        'assixx-dark': {
          name: 'assixx-dark',
          value: '#000000',
        },

        'assixx-gradient': {
          name: 'assixx-gradient',
          value:
            'linear-gradient(5deg, transparent 0%, rgba(0, 142, 255, 0.1) 25%, rgba(1, 0, 4, 0.51) 60%, rgba(0, 0, 4, 0.6) 90%, black 100%)',
        },

        light: {
          name: 'light',
          value: '#ffffff',
        },
      },
    },

    // Viewport presets
    viewport: {
      options: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '900px' },
        },
        wide: {
          name: 'Wide Desktop',
          styles: { width: '1920px', height: '1080px' },
        },
      },
    },

    // Layout
    layout: 'centered',

    // Documentation
    docs: {
      toc: true, // Table of contents
    },
  },

  // Global decorators
  decorators: [
    (story) => {
      // Wrap each story in a container with padding
      const container = document.createElement('div');
      container.style.padding = '2rem';
      container.appendChild(story());
      return container;
    },
  ],

  // Tags
  tags: ['autodocs'],

  initialGlobals: {
    backgrounds: {
      value: 'assixx-dark',
    },
  },
};

export default preview;
