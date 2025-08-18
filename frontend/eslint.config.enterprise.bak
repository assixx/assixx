/**
 * ENTERPRISE-GRADE ESLint Configuration
 * Based on Google/Microsoft Best Practices 2024-2025
 *
 * MIGRATION STRATEGY:
 * Phase 1 (Week 1): Critical Security & Type Safety - ERRORS
 * Phase 2 (Week 2-3): Code Quality - WARNINGS
 * Phase 3 (Week 4+): Full Strict Mode - ALL ERRORS
 *
 * Current Phase: 1 (Critical Only)
 */

import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import typescript from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import htmlPlugin from 'eslint-plugin-html';
import globals from 'globals';

// PHASE CONFIGURATION
const CURRENT_PHASE = 1; // Change to 2 or 3 as you progress

export default [
  // Base JavaScript configuration
  js.configs.recommended,
  prettierConfig,

  // Global configuration for all frontend files
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // jQuery and libraries
        $: 'readonly',
        jQuery: 'readonly',
        bootstrap: 'readonly',
        marked: 'readonly',
        FullCalendar: 'readonly',
        tippy: 'readonly',
        Toastify: 'readonly',
        Chart: 'readonly',
        dayjs: 'readonly',
        // App-specific globals
        API_BASE_URL: 'readonly',
        WS_URL: 'readonly',
        fetchWithAuth: 'readonly',
        showError: 'readonly',
        showSuccess: 'readonly',
        showInfo: 'readonly',
        authService: 'readonly',
        navigationService: 'readonly',
        themeService: 'readonly',
        // Development globals
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      // ALWAYS ERRORS (All Phases)
      'prettier/prettier': 'error',
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // PHASE 1: Critical Security & Type Safety (ERRORS)
      'no-console': CURRENT_PHASE >= 1 ? ['warn', { allow: ['warn', 'error', 'info'] }] : 'off',
      'no-alert': CURRENT_PHASE >= 1 ? 'warn' : 'off',
      'no-unused-vars':
        CURRENT_PHASE >= 1
          ? [
              'warn',
              {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true,
              },
            ]
          : 'off',

      // PHASE 2: Code Quality (Start as WARNINGS, then ERRORS)
      'arrow-body-style': CURRENT_PHASE >= 2 ? ['warn', 'as-needed'] : 'off',
      'prefer-arrow-callback': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      'no-duplicate-imports': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      'object-shorthand': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      'prefer-template': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      'no-return-await': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      'require-await': CURRENT_PHASE >= 2 ? 'warn' : 'off',

      // PHASE 3: Full Strict Mode (Enterprise Level)
      'no-async-promise-executor': CURRENT_PHASE >= 3 ? 'error' : 'off',
      'prefer-promise-reject-errors': CURRENT_PHASE >= 3 ? 'error' : 'off',
      'no-implicit-globals': CURRENT_PHASE >= 3 ? 'error' : 'off',
      'no-invalid-this': CURRENT_PHASE >= 3 ? 'error' : 'off',
      'no-mixed-operators': CURRENT_PHASE >= 3 ? 'error' : 'off',
      'no-shadow': CURRENT_PHASE >= 3 ? 'error' : 'off',
      'no-throw-literal': CURRENT_PHASE >= 3 ? 'error' : 'off',
      radix: CURRENT_PHASE >= 3 ? 'error' : 'off',
    },
  },

  // TypeScript configuration - PHASED APPROACH
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      // Base TypeScript Rules (Google/Microsoft recommended)
      ...typescriptPlugin.configs.recommended.rules,

      // PHASE 1: Critical Type Safety (ERRORS)
      '@typescript-eslint/no-explicit-any': CURRENT_PHASE >= 1 ? 'error' : 'off',
      '@typescript-eslint/no-unused-vars':
        CURRENT_PHASE >= 1
          ? [
              'warn',
              {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true,
              },
            ]
          : 'off',

      // PHASE 2: Enhanced Type Safety (WARNINGS -> ERRORS)
      '@typescript-eslint/no-unsafe-assignment': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      '@typescript-eslint/no-unsafe-call': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      '@typescript-eslint/no-unsafe-member-access': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      '@typescript-eslint/no-unsafe-return': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      '@typescript-eslint/no-floating-promises': CURRENT_PHASE >= 2 ? 'error' : 'off',
      '@typescript-eslint/await-thenable': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      '@typescript-eslint/require-await': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      '@typescript-eslint/no-misused-promises': CURRENT_PHASE >= 2 ? 'warn' : 'off',

      // PHASE 3: Full Strict Mode (Microsoft TypeScript Team Level)
      '@typescript-eslint/explicit-module-boundary-types': CURRENT_PHASE >= 3 ? 'error' : 'off',
      '@typescript-eslint/no-non-null-assertion': CURRENT_PHASE >= 3 ? 'error' : 'off',
      '@typescript-eslint/strict-boolean-expressions':
        CURRENT_PHASE >= 3
          ? [
              'warn',
              {
                allowString: true, // Allow string in conditions (pragmatic)
                allowNumber: true, // Allow number in conditions (pragmatic)
                allowNullableObject: true, // Allow nullable objects (pragmatic)
                allowNullableBoolean: true,
                allowNullableString: true,
                allowNullableNumber: true,
                allowAny: false,
              },
            ]
          : 'off',
      '@typescript-eslint/prefer-nullish-coalescing': CURRENT_PHASE >= 3 ? 'warn' : 'off',
      '@typescript-eslint/no-unnecessary-condition': CURRENT_PHASE >= 3 ? 'warn' : 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': CURRENT_PHASE >= 3 ? 'warn' : 'off',
      '@typescript-eslint/promise-function-async': CURRENT_PHASE >= 3 ? 'warn' : 'off',
      '@typescript-eslint/restrict-template-expressions':
        CURRENT_PHASE >= 3
          ? [
              'warn',
              {
                allowNumber: true, // Numbers in templates are OK
                allowBoolean: true,
                allowAny: false,
                allowNullish: false,
              },
            ]
          : 'off',

      // Disable base rules that TypeScript handles
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-redeclare': CURRENT_PHASE >= 2 ? 'error' : 'off',
      '@typescript-eslint/no-shadow': CURRENT_PHASE >= 3 ? 'error' : 'off',
    },
  },

  // HTML files with inline scripts - PROPER GLOBALS
  {
    files: ['src/**/*.html'],
    plugins: {
      html: htmlPlugin,
      prettier,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        // ALL Browser APIs available in HTML
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        location: 'readonly',
        history: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        XMLHttpRequest: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
        // App globals
        $: 'readonly',
        jQuery: 'readonly',
        showError: 'readonly',
        showSuccess: 'readonly',
        showInfo: 'readonly',
        fetchWithAuth: 'readonly',
        API_BASE_URL: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'error',
      // Relaxed rules for HTML inline scripts
      'no-console': 'off', // Console is OK in HTML for debugging
      'no-debugger': 'error',
      'no-alert': CURRENT_PHASE >= 2 ? 'warn' : 'off', // Alert is sometimes needed
      'no-var': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      'prefer-const': CURRENT_PHASE >= 2 ? 'warn' : 'off',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-unused-vars': 'off', // Hard to track in HTML scripts
    },
  },

  // Config files
  {
    files: ['vite.config.js', 'vite.config.ts', 'postcss.config.js', 'eslint.config.js', 'eslint.config.enterprise.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // Test files - Relaxed rules
  {
    files: ['**/*.test.js', '**/*.test.ts', '**/*.spec.js', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.mocha,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.vite/**',
      '*.min.js',
      '*.min.css',
      'src/scripts/lib/**',
      'src/styles/lib/**',
      'src/styles/webfonts/**',
      'public/**',
    ],
  },
];

/**
 * MIGRATION GUIDE:
 *
 * Week 1 (CURRENT_PHASE = 1):
 * - Fix all no-explicit-any errors (~200 errors)
 * - Fix critical security issues (eval, implied-eval)
 * - Run: npm run lint:fix for auto-fixable issues
 *
 * Week 2-3 (CURRENT_PHASE = 2):
 * - Fix all no-unsafe-* warnings (~676 errors)
 * - Fix floating-promises errors
 * - Improve async/await usage
 *
 * Week 4+ (CURRENT_PHASE = 3):
 * - Enable strict-boolean-expressions with pragmatic settings
 * - Full TypeScript strict mode
 * - Achieve 0 errors/warnings
 *
 * CI/CD Integration:
 * - Phase 1: Block on ERRORS only
 * - Phase 2: Block on ERRORS, report WARNINGS
 * - Phase 3: Block on any ERRORS or WARNINGS
 */
