/**
 * MAXIMUM STRICTNESS ESLint Configuration
 * Zero-Tolerance für schlechten Code
 * Basiert auf Google/Microsoft Enterprise Standards
 *
 * PHILOSOPHIE: Lieber jetzt Schmerzen als später Bugs!
 */

import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import typescript from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  // Base configurations
  js.configs.recommended,
  prettierConfig,

  // JavaScript/TypeScript files - MAXIMUM STRICTNESS
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Node.js globals for module system
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        // Libraries
        $: 'readonly',
        jQuery: 'readonly',
        bootstrap: 'readonly',
        marked: 'readonly',
        FullCalendar: 'readonly',
        tippy: 'readonly',
        Toastify: 'readonly',
        Chart: 'readonly',
        dayjs: 'readonly',
        // App globals
        API_BASE_URL: 'readonly',
        WS_URL: 'readonly',
        fetchWithAuth: 'readonly',
        showError: 'readonly',
        showSuccess: 'readonly',
        showInfo: 'readonly',
        authService: 'readonly',
        navigationService: 'readonly',
        themeService: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      // Formatting
      'prettier/prettier': 'error',

      // ALLES IST ERROR - KEINE KOMPROMISSE!
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
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
      'no-implicit-globals': 'error',
      'no-invalid-this': 'error',
      'no-mixed-operators': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',
      'no-inner-declarations': 'error',
      'no-shadow': 'error',
      'no-throw-literal': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-void': ['error', { allowAsStatement: true }],
      'prefer-spread': 'error',
      radix: 'error',
    },
  },

  // TypeScript - STRICT-TYPE-CHECKED + ALLES!
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
      // VOLLE STRENGE - strict-type-checked + stylistic-type-checked
      ...typescriptPlugin.configs['strict-type-checked'].rules,
      ...typescriptPlugin.configs['stylistic-type-checked'].rules,

      // ALLES IST ERROR!
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': false,
          'ts-nocheck': false,
          'ts-check': false,
        },
      ],

      // Type Safety - MAXIMUM
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // Code Quality - MAXIMUM
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignoreConditionalTests: false,
          ignoreTernaryTests: false,
          ignoreMixedLogicalExpressions: false,
        },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',

      // strict-boolean-expressions mit MINIMAL pragmatischen Einstellungen
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false, // STRENG: Keine strings in conditions
          allowNumber: false, // STRENG: Keine numbers in conditions
          allowNullableObject: true, // STRENG: Explizite null checks
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],

      // Template Expressions - STRENG aber fair
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true, // Numbers sind OK (einzige Ausnahme)
          allowBoolean: false,
          allowAny: false,
          allowNullish: false,
          allowRegExp: false,
        },
      ],

      // Weitere strenge Rules
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-duplicate-type-constituents': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/prefer-return-this-type': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',

      // Base rules off (TypeScript handles these)
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-shadow': 'off',
      'require-await': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/no-shadow': 'error',
    },
  },

  // Config files - Entspannt
  {
    files: ['vite.config.js', 'vite.config.ts', 'postcss.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // Test files - EINZIGE Ausnahme
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
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Ignore patterns - Best Practice 2025
  {
    ignores: [
      // Standard Build/Dependencies
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.vite/**',

      // External Libraries
      'src/scripts/lib/**', // Bootstrap, FullCalendar, etc.
      'src/styles/lib/**', // External CSS
      'src/styles/webfonts/**', // Font files
      'public/**',

      // Minified/Generated
      '**/*.min.js',
      '**/*.min.css',
      '**/*.generated.*',

      // Environment & Logs
      '.env',
      '.env.*',
      '*.log',

      // Type Declarations
      '**/*.d.ts',

      // Temp & Cache
      'tmp/**',
      '.cache/**',

      // HTML FILES - TODO: Separate HTML linting project
      '**/*.html',
      '**/*.html.bak',
    ],
  },
];
