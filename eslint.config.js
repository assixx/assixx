// ESLint Configuration - PostgreSQL 17 + pg (Raw SQL) + TypeScript
// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import js from '@eslint/js';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescript from '@typescript-eslint/parser';
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

export default [
  // Global ignores - must be first to apply to all configs
  {
    ignores: [
      'node_modules/**',
      'archive/**',
      'scripts/analyze-css.cjs',
      'scripts/purge-css-inplace.cjs',
      'node_modules_old_backup/**',
      '**/node_modules_old_backup/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '**/*.bak', // Ignore all backup files
      'backend/dist/**',
      'backend/src/routes/v1/**',
      'backend/archive/**', // Archived code - not actively maintained
      'frontend/dist/**',
      'coverage/**',
      '*.log',
      'backend/logs/**',
      '.env',
      '.env.*',
      'backend/**/*.js',
      '!frontend/dist/**/*.js',
      '!scripts/fix-esm-imports.js',
      'scripts/fix-*.js',
      'uploads/**',
      '**/*.yml',
      '**/*.yaml',
      'frontend/src/scripts/lib/**',
      'frontend/src/styles/lib/**',
      'backups/**',
      '.storybook/**',
      'stories/**',
      'design-system/build/**',
      'frontend/public/**',
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
      '**/test/**',
      '**/tests/**',
      '**/*.html',
    ],
  }, // Base JavaScript configuration
  js.configs.recommended, // Prettier configuration
  prettierConfig, // Complexity rules werden von sonarjs/cognitive-complexity gehandhabt

  // =============================================================================
  // PostgreSQL 17 + pg (Raw SQL) - Backend TypeScript Configuration
  // =============================================================================
  {
    files: ['backend/**/*.ts', 'backend/**/*.tsx'],
    ignores: ['backend/**/*.test.ts', 'backend/**/*.spec.ts'],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2022, // ES2022 für BigInt (PostgreSQL BIGINT/BIGSERIAL)
        sourceType: 'module',
        project: './backend/tsconfig.json',
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
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
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
      'import-x/external-module-folders': ['node_modules', 'node_modules/@types'],
    },
    rules: {
      ...typescriptPlugin.configs['strict-type-checked'].rules,
      ...typescriptPlugin.configs['stylistic-type-checked'].rules,

      'prettier/prettier': 'error',
      'tsdoc/syntax': 'error', // Regel 10: Zero Warnings

      // =======================================================================
      // PostgreSQL SQL Injection Prevention
      // =======================================================================
      'no-restricted-syntax': [
        'error',
        // Verbiete String-Konkatenation als erstes Argument in query()
        {
          selector: 'CallExpression[callee.property.name="query"] > BinaryExpression:first-child',
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
      '@typescript-eslint/no-loss-of-precision': 'error',

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

      // Line Length Control
      'max-len': [
        'error', // Regel 10: Zero Warnings
        {
          code: 120,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: true,
        },
      ],

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
      '@typescript-eslint/no-misused-promises': 'error',
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
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        // Erlaube jede Benennung für Properties, die von externen Quellen (DB, API) kommen.
        { selector: ['property', 'objectLiteralProperty', 'typeProperty'], format: null },
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
      // eslint-disable-next-line no-dupe-keys
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
      // detect-object-injection bleibt warn - zu viele false positives bei computed properties
      'security/detect-object-injection': 'warn',

      'no-unsanitized/method': 'error', // Regel 10: Zero Warnings
      'no-unsanitized/property': 'error',

      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='setAttribute'][arguments.0.value='onclick']",
          message: 'Use addEventListener instead of onclick attributes to prevent XSS',
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
            'JWT Token': 'eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*',
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
      'max-lines': ['error', { max: 1000, skipBlankLines: true, skipComments: true }],
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
  // PostgreSQL Migrations
  // =============================================================================
  {
    files: ['backend/src/database/migrations/**/*.ts', 'migration/**/*.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'no-console': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'security/detect-object-injection': 'off',
      'tsdoc/syntax': 'off',
    },
  },

  // TypeScript configuration for frontend
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx'],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './frontend/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        NodeJS: 'readonly',
        closeAdminModal: 'readonly',
        showModal: 'readonly',
        hideModal: 'readonly',
        navigator: 'readonly',
        screen: 'readonly',
        crypto: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        Audio: 'readonly',
        prompt: 'readonly',
        performance: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        event: 'readonly',
        Toastify: 'readonly',
        ApiClient: 'readonly',
        apiClient: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      prettier,
      'import-x': importPlugin,
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: './frontend/tsconfig.json',
          alwaysTryTypes: true,
        },
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      },
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import-x/external-module-folders': ['node_modules', 'node_modules/@types'],
    },
    rules: {
      ...typescriptPlugin.configs['strict-type-checked'].rules,
      ...typescriptPlugin.configs['stylistic-type-checked'].rules,

      'prettier/prettier': 'error',

      // Disable no-undef for TypeScript - TypeScript handles this better with type checking
      // ESLint's no-undef doesn't understand TypeScript's global declarations (.d.ts files)
      // See: https://typescript-eslint.io/linting/troubleshooting/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-runtime-errors
      'no-undef': 'off',

      // Enterprise Standards for Frontend (stricter than backend)
      // Power of Ten Rules: https://spinroot.com/gerard/pdf/P10.pdf
      // See: docs/POWER-OF-TEN-RULES.md
      'max-lines': [
        'error', // Regel 10: Zero Warnings
        {
          max: 400,
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
      'max-classes-per-file': ['error', 2], // Regel 10: Zero Warnings

      // Line Length Control
      'max-len': [
        'error', // Regel 10: Zero Warnings
        {
          code: 120,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: true,
        },
      ],

      // Import Dependencies Limit
      'import-x/max-dependencies': [
        'error', // Regel 10: Zero Warnings
        {
          max: 30,
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
      '@typescript-eslint/typedef': [
        'error',
        {
          arrayDestructuring: false,
          arrowParameter: false,
          memberVariableDeclaration: false,
          objectDestructuring: false,
          parameter: true,
          propertyDeclaration: true,
          variableDeclaration: false,
        },
      ],
      // Disable no-inferrable-types because it conflicts with typedef rule
      // We want explicit types for better documentation and consistency
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['error', { allow: ['warn', 'log', 'error', 'info'] }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      // Frontend nutzt strikteres nullish-coalescing
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

      // Die strenge Regelung für das Frontend bleibt erhalten.
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

      // --- ANGEPASST --- Radikal vereinfachte Naming Convention (identisch zum Backend).
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: ['property', 'objectLiteralProperty', 'typeProperty'], format: null },
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
      // eslint-disable-next-line no-dupe-keys
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: true,
          checksConditionals: true,
        },
      ],

      // Import-Reihenfolge - Regel 10: Zero Warnings
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
          'newlines-between': 'never',
          alphabetize: { order: 'ignore' },
        },
      ],
      'import-x/no-duplicates': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',
    },
  }, // HTML configuration removed - HTML files are ignored
  // This project doesn't use inline JavaScript in HTML files
  // All JavaScript is in separate TypeScript modules

  // Frontend-specific DOM rules
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx', 'frontend/**/*.js'],
    rules: {
      // Keep essential DOM modernization
      'unicorn/prefer-modern-dom-apis': 'error', // DOM modernization
    },
  },

  // Test files configuration - Vitest (Backend)
  {
    files: ['backend/**/*.test.ts', 'backend/**/*.spec.ts'],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './backend/tsconfig.test.json',
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
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      prettier,
      'import-x': importPlugin,
      vitest: vitestPlugin,
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
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
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
  {
    files: [
      'frontend/src/scripts/**/*.js',
      'frontend/src/components/**/*.js',
      'frontend/src/pages/**/*.js',
      'frontend/src/design-system/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
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
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        screen: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        $: 'readonly',
        jQuery: 'readonly',
        bootstrap: 'readonly',
        marked: 'readonly',
        FullCalendar: 'readonly',
        tippy: 'readonly',
        API_BASE_URL: 'readonly',
        WS_URL: 'readonly',
        fetchWithAuth: 'readonly',
        showError: 'readonly',
        showSuccess: 'readonly',
        fileNameSpan: 'readonly',
        authService: 'readonly',
        showModal: 'readonly',
        hideModal: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['frontend/vite.config.js', 'frontend/postcss.config.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
    },
  },
  {
    files: [
      'eslint.config.js',
      'backend/eslint.config.js',
      'frontend/eslint.config.js',
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
