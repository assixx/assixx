import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  // Content paths für Tailwind CSS
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,html}',
    './public/**/*.html',
    '../Testing/test-pages/**/*.html', // Design System Living Style Guide
    '../stories/**/*.{js,jsx,ts,tsx,mdx}', // Storybook stories (CRITICAL for utilities!)
  ],

  // Safelist custom component classes that are defined in CSS
  safelist: [
    'custom-glass-card',
    'glass-button',
    'glass-input',
    'card-glass',
    'btn-glass',
    'btn-glass-primary',
    'btn-glass-secondary',
    'btn-glass-danger',
    'input-glass',
    'select-glass',
    'textarea-glass',
    'modal-glass',
    'sidebar-glass',
    'nav-glass',
    'table-glass',
    'badge-glass',
    'alert-glass',
    'dropdown-glass',
    'tabs-glass',
    'progress-glass',
    'tooltip-glass',
  ],

  // Theme switching via data attribute
  darkMode: ['selector', '[data-theme="dark"]'],

  theme: {
    extend: {
      // Import Design Tokens
      colors: {
        // Core Colors from Design System
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
        },
        secondary: 'var(--color-secondary)',

        // Semantic Colors
        background: {
          DEFAULT: 'var(--color-background)',
          secondary: 'var(--color-background-secondary)',
        },
        surface: 'var(--color-surface)',

        // Text Colors
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          disabled: 'var(--color-text-disabled)',
        },

        // Border Colors
        border: {
          DEFAULT: 'var(--color-border)',
          hover: 'var(--color-border-hover)',
        },

        // State Colors
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',

        // Glassmorphism Colors
        glass: {
          bg: 'var(--glass-background)',
          'bg-hover': 'var(--glass-background-hover)',
          'bg-active': 'var(--glass-background-active)',
          border: 'var(--color-glass-border)',
        },
      },

      // Spacing from Design System
      spacing: {
        18: '72px',
        88: '352px',
        128: '512px',
      },

      // Typography
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },

      // Border Radius from Design System
      borderRadius: {
        glass: 'var(--radius-lg)',
      },

      // Shadows
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 12px 40px 0 rgba(0, 0, 0, 0.45)',
      },

      // Backdrop filters for Glassmorphism
      backdropBlur: {
        glass: '20px',
        'glass-strong': '30px',
        'glass-subtle': '10px',
      },

      backdropSaturate: {
        glass: '180%',
        'glass-high': '200%',
        'glass-medium': '150%',
      },

      // Animations
      animation: {
        'glass-shimmer': 'shimmer 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },

      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },

      // Component specific
      height: {
        header: 'var(--header-height)',
      },

      width: {
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        'sidebar-expanded': 'var(--sidebar-width-expanded)',
      },

      maxWidth: {
        modal: 'var(--modal-max-width)',
      },

      // Container
      container: {
        center: true,
        padding: '1rem',
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1536px',
        },
      },
    },
  },

  plugins: [
    forms({
      strategy: 'class', // Nutze Klassen statt base styles
    }),
    typography,
    containerQueries,

    // Custom Glassmorphism Plugin
    function ({ addUtilities, addComponents }) {
      // Glassmorphism Utilities
      addUtilities({
        '.glass': {
          background: 'var(--glass-background)',
          backdropFilter: 'var(--glass-backdrop)',
          WebkitBackdropFilter: 'var(--glass-backdrop)',
          border: 'var(--glass-border)',
        },
        '.glass-hover': {
          '&:hover': {
            background: 'var(--glass-background-hover)',
          },
        },
        '.glass-active': {
          '&:active': {
            background: 'var(--glass-background-active)',
          },
        },
      });

      // Glassmorphism Components
      addComponents({
        '.glass-button': {
          background: 'var(--glass-background)',
          backdropFilter: 'blur(10px) saturate(150%)',
          WebkitBackdropFilter: 'blur(10px) saturate(150%)',
          borderRadius: 'var(--radius-3xl)',
          border: 'var(--glass-border)',
          padding: 'var(--spacing-2) var(--spacing-4)',
          transition: 'all 0.3s ease',
          '&:hover': {
            background: 'var(--glass-background-hover)',
            transform: 'translateY(-2px)',
            boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.45)',
          },
          '&:active': {
            background: 'var(--glass-background-active)',
            transform: 'translateY(0)',
          },
        },
        '.glass-input': {
          background: 'var(--form-field-bg)',
          border: 'var(--form-field-border)',
          borderRadius: 'var(--form-field-radius)',
          color: 'var(--form-field-text)',
          fontSize: 'var(--form-field-font-size)',
          lineHeight: '1.5',
          padding: 'var(--form-field-padding-y) var(--form-field-padding-x)',
          transition: 'var(--form-field-transition)',
          outline: 'none',
          backdropFilter: 'var(--glass-form-backdrop)',
          WebkitBackdropFilter: 'var(--glass-form-backdrop)',
          '&:focus': {
            background: 'var(--form-field-bg-focus)',
            border: 'var(--form-field-border-focus)',
            boxShadow: 'var(--form-field-focus-ring)',
            transition: 'var(--form-field-transition-shadow)',
          },
          '&:hover': {
            background: 'var(--form-field-bg-hover)',
            border: 'var(--form-field-border-hover)',
          },
          '&::placeholder': {
            color: 'var(--form-field-placeholder)',
            opacity: '1',
          },
          '&:disabled': {
            background: 'var(--form-field-bg-disabled)',
            border: 'var(--form-field-border)',
            color: 'var(--form-field-disabled-text)',
            cursor: 'not-allowed',
            opacity: '0.6',
          },
          '&.is-error': {
            border: 'var(--form-field-border-error)',
            color: 'var(--form-field-text-error)',
          },
          '&.is-success': {
            border: 'var(--form-field-border-success)',
            color: 'var(--form-field-text-success)',
          },
        },
      });
    },
  ],
};
