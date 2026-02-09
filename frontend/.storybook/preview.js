/**
 * Storybook Preview Configuration
 * Global decorators, parameters, and styles
 */
// Import global styles (SvelteKit entry point - replaces legacy main.css)
import '../src/app.css';

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

    // Backgrounds - Solid colors for Storybook addon compatibility.
    // The addon sets background-color (not background-image), so gradients
    // don't work here. The actual gradient overlay comes from body::after
    // via CSS variables (--main-bg-gradient in base.css).
    backgrounds: {
      disable: false,
      options: {
        'assixx-dark': {
          name: 'Dark Mode',
          value: '#000',
        },
        'assixx-light': {
          name: 'Light Mode',
          value: '#fafafa',
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
    (story, context) => {
      // Sync html.dark class with selected background (drives CSS variable theming)
      // Backgrounds global can be string or { value: string, grid: boolean }
      const data = context.globals?.backgrounds;
      const bg = typeof data === 'string' ? data : data?.value;
      const isDark = !bg || bg === 'assixx-dark';

      // Apply class to BOTH html and body for maximum CSS variable coverage
      const html = document.documentElement;
      const body = document.body;
      if (isDark) {
        html.classList.add('dark');
        body.classList.add('dark');
      } else {
        html.classList.remove('dark');
        body.classList.remove('dark');
      }

      // Debug: log computed CSS variable values to find override source
      const computed = getComputedStyle(html);
      console.log('[Assixx Theme]', isDark ? 'DARK' : 'LIGHT', {
        bg,
        'html.dark': html.classList.contains('dark'),
        '--main-bg': computed.getPropertyValue('--main-bg'),
        '--color-text-primary': computed.getPropertyValue(
          '--color-text-primary',
        ),
        '--glass-bg': computed.getPropertyValue('--glass-bg'),
        '--color-white': computed.getPropertyValue('--color-white'),
        'body.color': getComputedStyle(body).color,
        'body.background': getComputedStyle(body).background,
        styleSheets: document.styleSheets.length,
      });

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
