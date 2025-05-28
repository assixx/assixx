const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // Base JavaScript configuration
  js.configs.recommended,

  // Prettier configuration
  prettierConfig,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'prefer-arrow-callback': 'error',
      'no-duplicate-imports': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-async-promise-executor': 'error',
      'prefer-promise-reject-errors': 'error',
    },
  },

  // Browser environment for client-side JavaScript
  {
    files: [
      'public/js/**/*.js',
      'middleware/public/js/**/*.js',
      'public/components/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        XMLHttpRequest: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        EventTarget: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        // Common libraries that might be used
        $: 'readonly',
        jQuery: 'readonly',
        bootstrap: 'readonly',
        marked: 'readonly',
        FullCalendar: 'readonly',
        tippy: 'readonly',
        // App-specific globals
        API_BASE_URL: 'readonly',
        WS_URL: 'readonly',
      },
    },
  },

  {
    ignores: [
      'node_modules/**',
      'uploads/**',
      '*.log',
      '.env',
      '.env.*',
      'dist/**',
      'build/**',
      'coverage/**',
      'public/js/lib/**',
      'public/css/lib/**',
    ],
  },
];
