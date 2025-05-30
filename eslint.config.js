import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import typescript from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

export default [
  // Base JavaScript configuration
  js.configs.recommended,

  // Prettier configuration
  prettierConfig,

  // TypeScript configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
        Promise: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      prettier,
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': 'off',
    },
  },

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
      'frontend/src/scripts/**/*.js',
      'frontend/src/components/**/*.js',
      'frontend/src/pages/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
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
        // Additional globals for frontend scripts
        fetchWithAuth: 'readonly',
        showError: 'readonly',
        showSuccess: 'readonly',
        fileNameSpan: 'readonly',
        authService: 'readonly',
      },
    },
  },

  // Vite config needs ES modules
  {
    files: ['frontend/vite.config.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
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
      'frontend/dist/**',
      'frontend/src/scripts/lib/**',
      'frontend/src/styles/lib/**',
      'backend/logs/**',
      // Backend Scripts - bleiben CommonJS
      'backend/scripts/**/*.js',
      'backend/src/utils/scripts/**/*.js',
      // Entry Points - bleiben als .js für Stabilität
      'backend/src/app.js',
      'backend/src/auth.js',
      'backend/src/database.js',
      'backend/src/server.js',
      'backend/src/server-old.js',
      'backend/src/register-ts.js',
      // Database Migrations
      'backend/src/database/migrations/**/*.js',
      // Temporär - werden später migriert
      'backend/src/websocket.js',
    ],
  },
];
