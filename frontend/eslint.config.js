// ESLint Configuration for SvelteKit Frontend (Svelte 5 with Runes)
// Based on official eslint-plugin-svelte recommendations
// https://sveltejs.github.io/eslint-plugin-svelte/user-guide/
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
  // Ignore patterns FIRST (must be standalone object)
  {
    ignores: ['build/**', '.svelte-kit/**', 'node_modules/**', '*.min.js', 'static/**', 'dist/**'],
  },

  // Base JavaScript recommendations
  js.configs.recommended,

  // TypeScript recommendations
  ...ts.configs.recommended,

  // Svelte recommendations (includes base + rules to prevent errors)
  ...svelte.configs['flat/recommended'],

  // Prettier compatibility (disables conflicting rules)
  ...svelte.configs['flat/prettier'],

  // Global settings
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // Svelte files with TypeScript support
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
        svelteConfig,
        // Note: Svelte 5 has runes enabled by default, no svelteFeatures needed
      },
    },
  },

  // TypeScript/JavaScript rules
  {
    files: ['**/*.ts', '**/*.js', '**/*.svelte'],
    rules: {
      // Assixx TypeScript Standards - adapted for Svelte
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          // Allow Svelte runes ($state, $derived, etc.) and $$ prefix
          varsIgnorePattern: '^_|^\\$',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off', // Svelte infers types
      'no-console': ['error', { allow: ['warn', 'error', 'info', 'log'] }],

      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      // Svelte specific
      'svelte/no-at-html-tags': 'error', // Allow {@html} but error
      // svelte/valid-compile disabled: Known issue with eslint-plugin-svelte 3.x + Svelte 5
      // Using svelte-check instead for compile validation
      'svelte/valid-compile': 'off',
      // Navigation rule disabled: We use `base` from $app/paths correctly
      // The rule wants resolve(base, path) but ${base}/path is equivalent for internal navigation
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/require-each-key': 'error',
    },
  },

  // =============================================================================
  // Svelte Component Size Limits
  // Best Practice: Svelte components should be max 300-500 lines
  // See: docs/LONG-FILES-RANKING.md for current violations
  // =============================================================================
  {
    files: ['**/*.svelte'],
    rules: {
      'max-lines': [
        'warn',
        {
          max: 700,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
);
