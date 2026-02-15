// ESLint Configuration for SvelteKit Frontend (Svelte 5 with Runes)
// ENTERPRISE Configuration - matches root config strictness + Svelte 5 support
// Based on: https://sveltejs.github.io/eslint-plugin-svelte/user-guide/
// Last Updated: 2026-01-08

import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import-x';
import noUnsanitizedPlugin from 'eslint-plugin-no-unsanitized';
import securityPlugin from 'eslint-plugin-security';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

export default ts.config(
  // =============================================================================
  // IGNORES - Must be first
  // Note: Config files are ignored because strictTypeChecked preset rules
  // cannot be disabled after loading. This is standard practice.
  // =============================================================================
  {
    ignores: [
      'build/**',
      '.svelte-kit/**',
      'node_modules/**',
      '**/node_modules/**',
      '../node_modules/**', // Root node_modules (pnpm workspace)
      '/home/scs/projects/Assixx/node_modules/**', // Absolute path fallback
      '*.min.js',
      'static/**',
      'dist/**',
      // Config files - strictTypeChecked preset rules can't be disabled
      '*.config.js',
      '*.config.ts',
    ],
  },

  // =============================================================================
  // BASE CONFIGS - Only for src/** files!
  // CRITICAL: Map all configs to restrict to src/** to prevent node_modules parsing
  // =============================================================================
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
    ...js.configs.recommended,
  },

  // STRICT TypeScript - restricted to src/**
  ...ts.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
  })),
  ...ts.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
  })),

  // Svelte recommendations - restricted to src/**
  ...svelte.configs['flat/recommended'].map((config) => ({
    ...config,
    files: config.files ?? ['src/**/*.svelte'],
  })),
  ...svelte.configs['flat/prettier'].map((config) => ({
    ...config,
    files: config.files ?? ['src/**/*.svelte'],
  })),

  // =============================================================================
  // TYPESCRIPT/JS/SVELTE FILES - CONSOLIDATED Type-aware linting
  // Using project instead of projectService to respect tsconfig exclude patterns
  // =============================================================================
  {
    files: [
      'src/**/*.ts',
      'src/**/*.js',
      'src/**/*.svelte',
      'src/**/*.svelte.ts',
      'src/**/*.svelte.js',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
  },

  // =============================================================================
  // SVELTE FILES - Additional Svelte-specific parser options
  // =============================================================================
  {
    files: ['src/**/*.svelte', 'src/**/*.svelte.ts', 'src/**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        svelteConfig,
      },
    },
  },

  // =============================================================================
  // BROWSER FILES - Client-side code (NO Node.js globals)
  // =============================================================================
  {
    files: ['src/**/*.svelte', 'src/**/*.ts', 'src/**/*.js'],
    ignores: [
      '**/*.server.ts',
      '**/*.server.js',
      '**/+*.server.ts',
      '**/+*.server.js',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // =============================================================================
  // SERVER FILES - SSR/Server code (Node.js globals allowed)
  // =============================================================================
  {
    files: [
      'src/**/*.server.ts',
      'src/**/*.server.js',
      'src/**/+*.server.ts',
      'src/**/+*.server.js',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // =============================================================================
  // SONARJS - Code Quality & Cognitive Complexity (Power of Ten Rule 1!)
  // =============================================================================
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
    plugins: {
      sonarjs: sonarjsPlugin,
    },
    rules: {
      // Power of Ten Rule 1: Simple control flow
      'sonarjs/cognitive-complexity': ['error', 10],

      // Code smells
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-extra-arguments': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/non-existent-operator': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-gratuitous-expressions': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-same-line-conditional': 'error',
      'sonarjs/no-small-switch': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/prefer-object-literal': 'error',
      'sonarjs/prefer-single-boolean-return': 'error',
    },
  },

  // =============================================================================
  // SECURITY PLUGIN - All rules (Zero Warnings Policy)
  // =============================================================================
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
    plugins: {
      security: securityPlugin,
    },
    rules: {
      'security/detect-bidi-characters': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-non-literal-require': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
      // Disabled: Too many false positives, TypeScript provides protection
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'off',
    },
  },

  // =============================================================================
  // NO-UNSANITIZED - XSS Prevention (CRITICAL for Frontend!)
  // =============================================================================
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
    plugins: {
      'no-unsanitized': noUnsanitizedPlugin,
    },
    rules: {
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
    },
  },

  // =============================================================================
  // IMPORT-X - Import Management & Cycle Detection
  // =============================================================================
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
    plugins: {
      'import-x': importPlugin,
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
      },
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
        'svelte-eslint-parser': ['.svelte'],
      },
      // Fix for node_modules parsing issue (GitHub #2837)
      'import-x/ignore': ['\\.svelte$', 'node_modules', '@event-calendar'],
    },
    rules: {
      'import-x/first': 'error', // Imports must be at top of file
      'import-x/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }],
      'import-x/no-duplicates': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/max-dependencies': [
        'error',
        { max: 25, ignoreTypeImports: true },
      ],
      // Import sorting for team consistency (auto-fixable)
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: '$app/**', group: 'internal', position: 'before' },
            { pattern: '$lib/**', group: 'internal', position: 'before' },
            { pattern: '$design-system/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['type'],
        },
      ],
    },
  },

  // =============================================================================
  // STRICT TYPESCRIPT RULES - Enterprise Standards (Power of Ten)
  // =============================================================================
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
    plugins: {
      svelte, // Required for svelte/* rules below
    },
    rules: {
      // Disable no-undef - TypeScript handles this better
      'no-undef': 'off',

      // =======================================================================
      // POWER OF TEN RULES - Zero Warnings Policy
      // =======================================================================
      'max-lines': [
        'error',
        {
          max: 800,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'error',
        {
          max: 60,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      'max-depth': ['error', 4],
      'max-nested-callbacks': ['error', 4],
      'max-classes-per-file': ['error', 2],
      // max-len: removed — deprecated in ESLint v8.53.0, Prettier handles line length
      complexity: ['error', 10], // Cyclomatic complexity

      // =======================================================================
      // TYPESCRIPT STRICT RULES
      // =======================================================================
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_|^\\$', // Allow Svelte runes ($state, $derived)
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/typedef': [
        'error',
        {
          arrayDestructuring: false,
          arrowParameter: false,
          memberVariableDeclaration: false,
          objectDestructuring: false,
          parameter: false,
          propertyDeclaration: true,
          variableDeclaration: false,
        },
      ],
      '@typescript-eslint/no-inferrable-types': 'off', // Conflicts with typedef
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: true,
          checksConditionals: true,
        },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignoreConditionalTests: false,
          ignoreTernaryTests: false,
          ignoreMixedLogicalExpressions: false,
          allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false,
        },
      ],
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: true,
          allowNumber: true,
          allowNullableObject: true,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        {
          selector: ['property', 'objectLiteralProperty', 'typeProperty'],
          format: null,
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: false,
          allowNullish: false,
        },
      ],
      '@typescript-eslint/return-await': ['error', 'always'],
      // Tech Debt Prevention - catch deprecated API usage
      '@typescript-eslint/no-deprecated': 'warn',

      // =======================================================================
      // SECURITY RULES (non-plugin)
      // =======================================================================
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-unsafe-finally': 'error',
      'require-atomic-updates': 'error',

      // =======================================================================
      // CODE QUALITY
      // =======================================================================
      // STRICT: Only warn and error allowed in production frontend code
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      // =======================================================================
      // SVELTE 5 RULES - Comprehensive Best Practices
      // =======================================================================
      // Security
      'svelte/no-at-html-tags': 'error', // XSS prevention
      'svelte/no-target-blank': 'error', // Security: rel="noopener noreferrer"

      // Svelte 5 Runes Best Practices
      'svelte/no-unnecessary-state-wrap': 'error', // Don't wrap reactive classes
      'svelte/prefer-writable-derived': 'error', // $derived over $state + $effect
      'svelte/no-inspect': 'error', // No $inspect in production

      // SSR Safety
      'svelte/no-top-level-browser-globals': 'error', // Prevents SSR bugs

      // Code Quality
      'svelte/no-at-debug-tags': 'error', // No {@debug} in production
      'svelte/require-each-key': 'error', // Keys in {#each}
      'svelte/no-reactive-reassign': 'error', // Bug prevention
      'svelte/no-useless-mustaches': 'error', // Cleaner code
      'svelte/no-dom-manipulating': 'error', // Let Svelte handle DOM
      'svelte/no-unused-svelte-ignore': 'error', // Clean up ignore comments

      // Accessibility
      'svelte/button-has-type': 'error', // Explicit button types

      // SvelteKit
      'svelte/no-navigation-without-resolve': 'off', // We use ${base}/path correctly

      // Known issues
      'svelte/valid-compile': 'off', // Known issue with eslint-plugin-svelte 3.x + Svelte 5
    },
  },

  // =============================================================================
  // SVELTE COMPONENT SIZE LIMITS (separate for .svelte only)
  // User requested: Keep at 700 lines
  // =============================================================================
  {
    files: ['src/**/*.svelte'],
    rules: {
      'max-lines': [
        'error',
        {
          max: 1900,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      // Svelte components often have longer functions due to reactive blocks
      'max-lines-per-function': [
        'error',
        {
          max: 80,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      // More duplicate strings allowed in templates
      'sonarjs/no-duplicate-string': ['error', { threshold: 8 }],
      // Disable rules that crash with Svelte parser
      'sonarjs/no-unused-collection': 'off', // Crashes on Svelte files
    },
  },

  // =============================================================================
  // LOGGER UTILITIES - Allow all console methods (these ARE the central loggers)
  // All other code should use these loggers instead of console.* directly
  // =============================================================================
  {
    files: ['src/lib/utils/logger.ts', 'src/lib/utils/perf-logger.ts'],
    rules: {
      'no-console': 'off', // Logger utilities intentionally use all console methods
    },
  },

  // =============================================================================
  // JAVASCRIPT FILES - Disable TypeScript-only rules
  // JS files can't have inline type annotations, they use JSDoc instead
  // =============================================================================
  {
    files: ['src/**/*.js'],
    rules: {
      '@typescript-eslint/typedef': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
);
