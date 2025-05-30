import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import typescript from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  // Base JavaScript configuration
  js.configs.recommended,

  // Prettier configuration
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
        // Custom app functions that might be globally available
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
      'prettier/prettier': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
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
      // Frontend specific rules
      'no-implicit-globals': 'error',
      'no-invalid-this': 'error',
      'no-mixed-operators': 'error',
      'no-multi-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      'no-trailing-spaces': 'error',
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'comma-dangle': ['error', 'always-multiline'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'max-len': [
        'warn',
        {
          code: 120,
          ignoreComments: true,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
    },
  },

  // TypeScript configuration
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
      ...typescriptPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': false,
          'ts-nocheck': false,
          'ts-check': false,
        },
      ],
      // Disable base rules that are handled by TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },

  // HTML files with inline scripts
  {
    files: ['src/**/*.html'],
    plugins: {
      prettier,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // Vite and config files
  {
    files: ['vite.config.js', 'vite.config.ts', 'postcss.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // Test files
  {
    files: ['**/*.test.js', '**/*.test.ts', '**/*.spec.js', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.mocha,
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
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
      '**/*.html',
    ],
  },
];
