// ESLint Configuration - PostgreSQL 17 + pg (Raw SQL) + TypeScript
// Modernized for typescript-eslint v8+ (unified package)
// For more info, see https://typescript-eslint.io/getting-started/
import js from '@eslint/js';
import vitestPlugin from '@vitest/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';
import noSecretsPlugin from 'eslint-plugin-no-secrets';
import noUnsanitizedPlugin from 'eslint-plugin-no-unsanitized';
import prettier from 'eslint-plugin-prettier';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import storybook from 'eslint-plugin-storybook';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import unicornPlugin from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default [
  // Global ignores - must be first to apply to all configs
  // NOTE: Frontend has its own eslint.config.mjs with Svelte + strict rules
  // Run: cd frontend && pnpm run lint
  {
    ignores: [
      // =============================================================
      // FRONTEND - Has separate ESLint config with Svelte support
      // =============================================================
      'frontend/**',

      // =============================================================
      // STANDARD IGNORES
      // =============================================================
      '.svelte-kit/**',
      'node_modules/**',
      'archive/**',
      'scripts/analyze-css.cjs',
      'scripts/purge-css-inplace.cjs',
      'node_modules_old_backup/**',
      '**/node_modules_old_backup/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '**/*.bak',
      'backend/dist/**',
      'shared/dist/**',
      'backend/src/routes/v1/**',
      'backend/archive/**',
      'coverage/**',
      'vitest.frontend-setup.ts',
      'frontend/test/**',
      '*.log',
      'backend/logs/**',
      '.env',
      '.env.*',
      'backend/**/*.js',
      '!scripts/fix-esm-imports.js',
      'scripts/fix-*.js',
      'uploads/**',
      '**/*.yml',
      '**/*.yaml',
      'backups/**',
      'frontend/.storybook/**',
      'archive/**',
      'backend/src/database/migrations/**/*.js',
      'database/**/*.js',
      'backend/src/server-old.js',
      'backend/coverage/**',
      '**/*.generated.ts',
      '**/*.config.js',
      '**/vite.config.optimized.js',
      '**/*.min.css',
      'backend/src/routes/mocks/**',
      '**/__tests__/**',
      '**/tests/**',
      '**/*.html',
      'frontend-legacy/**',
    ],
  }, // Base JavaScript configuration
  js.configs.recommended, // Prettier configuration
  prettierConfig, // Complexity rules werden von sonarjs/cognitive-complexity gehandhabt

  // =============================================================================
  // PostgreSQL 17 + pg (Raw SQL) - Backend TypeScript Configuration
  // =============================================================================
  {
    files: ['backend/**/*.ts', 'backend/**/*.tsx', 'shared/**/*.ts'],
    ignores: [
      'backend/**/*.test.ts',
      'backend/**/*.spec.ts',
      'backend/test/**',
      'shared/**/*.test.ts',
      'shared/**/*.spec.ts',
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022, // ES2022 für BigInt (PostgreSQL BIGINT/BIGSERIAL)
        sourceType: 'module',
        projectService: true, // v8 recommended: automatic tsconfig discovery
        tsconfigRootDir: import.meta.dirname,
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
        Express: 'readonly',
        BigInt: 'readonly', // PostgreSQL BIGINT/BIGSERIAL Support
        NodeJS: 'readonly', // Node.js namespace for types like NodeJS.ErrnoException
        URL: 'readonly', // Node.js global since v10 (no import needed)
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier,
      'import-x': importPlugin,
      tsdoc: tsdocPlugin,
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: './backend/tsconfig.json',
          alwaysTryTypes: true,
        },
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      },
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import-x/external-module-folders': [
        'node_modules',
        'node_modules/@types',
      ],
    },
    rules: {
      // v8: Access rules via tseslint.plugin.configs (same structure as before)
      ...tseslint.plugin.configs['strict-type-checked'].rules,
      ...tseslint.plugin.configs['stylistic-type-checked'].rules,

      'prettier/prettier': 'error',
      'tsdoc/syntax': 'error', // Regel 10: Zero Warnings

      // =======================================================================
      // PostgreSQL SQL Injection Prevention
      // =======================================================================
      'no-restricted-syntax': [
        'error',
        // Verbiete String-Konkatenation als erstes Argument in query()
        {
          selector:
            'CallExpression[callee.property.name="query"] > BinaryExpression:first-child',
          message:
            '⚠️ SQL INJECTION: Keine String-Konkatenation in query()! Nutze parameterisierte Queries: pool.query("SELECT * FROM x WHERE id = $1", [id])',
        },
        // Verbiete eval() komplett
        {
          selector: 'CallExpression[callee.name="eval"]',
          message: '⚠️ SECURITY: eval() ist verboten - Code Injection Risiko',
        },
      ],

      // PostgreSQL BigInt Precision (BIGINT/BIGSERIAL)
      // NOTE: @typescript-eslint/no-loss-of-precision deprecated in v8, use base ESLint rule
      'no-loss-of-precision': 'error',

      // Enterprise Code Quality Standards
      // Power of Ten Rules: https://spinroot.com/gerard/pdf/P10.pdf
      // See: docs/POWER-OF-TEN-RULES.md
      'max-lines': [
        'error', // Regel 10: Zero Warnings
        {
          max: 800,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'error', // Regel 10: Zero Warnings
        {
          max: 60, // Regel 4: Max 60 Zeilen pro Funktion
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      'max-depth': ['error', 4], // Regel 9: Max 3-4 Referenz-Levels, Regel 10: Zero Warnings
      'max-nested-callbacks': ['error', 4], // Regel 10: Zero Warnings
      'max-classes-per-file': ['error', 1], // Regel 10: Zero Warnings

      // max-len: removed — deprecated in ESLint v8.53.0, Prettier handles line length

      // Import Dependencies Limit
      'import-x/max-dependencies': [
        'error', // Regel 10: Zero Warnings
        {
          max: 25,
          ignoreTypeImports: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        },
      ],
      '@typescript-eslint/typedef': [
        'error',
        {
          parameter: true,
          arrowParameter: true,
        },
      ],
      // Disable no-inferrable-types because it conflicts with typedef rule
      // We want explicit types for better documentation and consistency
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      'no-console': ['error', { allow: ['warn', 'log', 'error', 'info'] }],
      '@typescript-eslint/no-floating-promises': 'error',
      // no-misused-promises configured below with detailed options
      '@typescript-eslint/await-thenable': 'error',
      // Backend erlaubt || für strings und numbers
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignoreConditionalTests: true,
          ignoreTernaryTests: true,
          ignoreMixedLogicalExpressions: true,
          allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false,
        },
      ],
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Power of Ten Regel 7: Parameter validieren, Regel 10: Zero Warnings
      // Reaktiviert - Circular Fix Konflikt muss manuell gelöst werden
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
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

      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-unsafe-finally': 'error',
      'require-atomic-updates': 'error',

      // --- ANGEPASST --- Radikal vereinfachte Naming Convention.
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
        // Erlaube jede Benennung für Properties, die von externen Quellen (DB, API) kommen.
        {
          selector: ['property', 'objectLiteralProperty', 'typeProperty'],
          format: null,
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],

      // --- ANGEPASST --- Erlaubt nun Zahlen und Booleans in Template Strings.
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
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: true,
          checksConditionals: true,
        },
      ],

      // --- ANGEPASST --- Korrigierte und vereinfachte Import-Reihenfolge.
      // DEAKTIVIERT - Verursacht circular fixes mit Prettier
      // 'import-x/order': [
      //   'warn',
      //   {
      //     groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
      //     'newlines-between': 'never',
      //     alphabetize: { order: 'ignore' },
      //   },
      // ],
      // Die doppelte Deaktivierung wurde entfernt.
      'import-x/no-duplicates': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',
    },
  }, // Security configuration for all TypeScript/JavaScript files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      security: securityPlugin,
      'no-unsanitized': noUnsanitizedPlugin,
    },
    rules: {
      // Power of Ten Regel 10: Zero Warnings - Security Rules
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      // detect-object-injection DEAKTIVIERT für Frontend
      // Grund: Extrem hohe False-Positive-Rate, keine Konfigurationsoptionen
      // TypeScript types schützen bereits bei Record<K,V>[key] Zugriffen
      // Siehe: https://github.com/nodesecurity/eslint-plugin-security/issues/21
      // GitLab hat diese Regel ebenfalls deaktiviert: https://gitlab.com/gitlab-org/gitlab/-/issues/351399
      'security/detect-object-injection': 'off',

      'no-unsanitized/method': 'error', // Regel 10: Zero Warnings
      'no-unsanitized/property': 'error',

      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='setAttribute'][arguments.0.value='onclick']",
          message:
            'Use addEventListener instead of onclick attributes to prevent XSS',
        },
      ],
    },
  }, // Promise Plugin Configuration
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      promise: promisePlugin,
    },
    rules: {
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-native': 'off',
      'promise/no-nesting': 'error',
      'promise/no-promise-in-callback': 'error',
      'promise/no-callback-in-promise': 'error',
      'promise/avoid-new': 'off',
      'promise/no-new-statics': 'error',
      'promise/no-return-in-finally': 'error',
      'promise/valid-params': 'error',
    },
  }, // SonarJS Plugin Configuration
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      sonarjs: sonarjsPlugin,
    },
    rules: {
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-extra-arguments': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/non-existent-operator': 'error',

      // Power of Ten Regel 1: Einfacher Kontrollfluss, Regel 10: Zero Warnings
      'sonarjs/cognitive-complexity': ['error', 10],
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }], // Regel 10: Zero Warnings
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
  }, // Unicorn Plugin - Cherry-picked best rules
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      // Keep only critical unicorn rules
      'unicorn/no-new-buffer': 'error', // Security: deprecated API
      'unicorn/prefer-number-properties': 'error', // Regel 10: Zero Warnings - Type safety: Number.isNaN vs isNaN
    },
  }, // JSDoc Plugin - NUR für wichtige/public APIs (SELEKTIV)
  {
    files: [
      '**/controllers/**/*.ts',
      '**/services/**/*.ts',
      '**/utils/db.ts',
      '**/middleware/auth*.ts',
      '**/routes/v2/**/*.ts',
      '**/config/*.ts',
    ],
    // JSDoc entfernt - wir nutzen nur TSDoc
  }, // No-Secrets Plugin
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      'no-secrets': noSecretsPlugin,
    },
    rules: {
      'no-secrets/no-secrets': [
        'error',
        {
          tolerance: 5.2,
          additionalRegexes: {
            'German Password': '(passwort|kennwort)\\s*[:=]\\s*[\'"]?.+[\'"]?',
            'JWT Token':
              'eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*',
            // PostgreSQL Connection Strings (nur env vars, nicht generische password strings)
            'PostgreSQL Env Hardcoded':
              '(PG_PASSWORD|POSTGRES_PASSWORD|DATABASE_URL)\\s*[:=]\\s*[\'"][^$\\{][^\'"]{8,}[\'"]',
          },
        },
      ],
    },
  },

  // =============================================================================
  // PostgreSQL Database Layer - Spezielle Regeln für DB-Code
  // =============================================================================
  {
    files: [
      'backend/src/database/**/*.ts',
      'backend/src/config/database*.ts',
      'backend/src/utils/db*.ts',
    ],
    rules: {
      // Längere Dateien für komplexe DB-Queries erlauben
      'max-lines': [
        'error',
        { max: 1000, skipBlankLines: true, skipComments: true },
      ],
      // Längere Funktionen für komplexe DB-Operationen
      'max-lines-per-function': [
        'error',
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      // Duplicate Strings OK in SQL (Spaltennamen wiederholen sich)
      'sonarjs/no-duplicate-string': ['error', { threshold: 8 }],
    },
  },

  // =============================================================================
  // PostgreSQL Migrations - TypeScript parser for root-level database/ directory
  // ADR-014: node-pg-migrate migrations live in database/migrations/*.ts
  // No projectService needed - migrations are simple pgm.sql() wrappers
  // =============================================================================
  {
    files: ['database/migrations/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },

  // =============================================================================
  // PostgreSQL Migrations - Relaxed rules for all migration locations
  // =============================================================================
  {
    files: [
      'backend/src/database/migrations/**/*.ts',
      'migration/**/*.ts',
      'database/migrations/**/*.ts',
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'no-console': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'security/detect-object-injection': 'off',
      'tsdoc/syntax': 'off',
    },
  },

  // =============================================================================
  // NOTE: Frontend configuration REMOVED - see frontend/eslint.config.mjs
  // Frontend has its own config with Svelte support + all strict rules
  // Run: cd frontend && pnpm run lint
  // =============================================================================

  // Test files configuration - Vitest (Backend + Shared + API Integration)
  {
    files: [
      'backend/**/*.test.ts',
      'backend/**/*.spec.ts',
      'shared/**/*.test.ts',
      'shared/**/*.spec.ts',
      'backend/test/**/*.ts',
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: [
          './backend/tsconfig.test.json',
          './shared/tsconfig.test.json',
          './backend/test/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        // Node globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        fetch: 'readonly', // Node 18+ native fetch
        Response: 'readonly', // Node 18+ native fetch
        Request: 'readonly', // Node 18+ native fetch
        Headers: 'readonly', // Node 18+ native fetch
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Promise: 'readonly',
        URL: 'readonly',
        RequestInit: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier,
      'import-x': importPlugin,
      vitest: vitestPlugin,
    },
    rules: {
      ...tseslint.plugin.configs.recommended.rules,
      ...vitestPlugin.configs.recommended.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'off', // In Tests oft notwendig
      '@typescript-eslint/no-non-null-assertion': 'off', // In Tests oft notwendig
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Relaxed rules for tests
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },

  // Test files configuration - Vitest (Other/JS)
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    ignores: ['backend/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      prettier,
      vitest: vitestPlugin,
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      'prettier/prettier': 'error',
    },
  }, // Remaining configurations for JS files, configs, etc.
  // ... (Diese Teile waren bereits gut und wurden unverändert übernommen)

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
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
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'prefer-arrow-callback': 'error',
      'no-duplicate-imports': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-return-await': 'error',
      'max-depth': ['error', 4], // Regel 9: Max 3-4 Levels, Regel 10: Zero Warnings
      'max-lines': ['error', 400], // Regel 10: Zero Warnings
      'require-await': 'error',
      'no-async-promise-executor': 'error',
      'prefer-promise-reject-errors': 'error',
    },
  },
  // NOTE: Frontend JS/config blocks REMOVED - handled by frontend/eslint.config.mjs
  {
    files: [
      'eslint.config.mjs',
      'backend/eslint.config.mjs',
      'scripts/fix-esm-imports.js',
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        import: 'readonly',
      },
    },
  },
  ...storybook.configs['flat/recommended'],
];
