import js from '@eslint/js';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescript from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';
import noSecretsPlugin from 'eslint-plugin-no-secrets';
import noUnsanitizedPlugin from 'eslint-plugin-no-unsanitized';
import prettier from 'eslint-plugin-prettier';
import promisePlugin from 'eslint-plugin-promise';
import regexpPlugin from 'eslint-plugin-regexp';
import securityPlugin from 'eslint-plugin-security';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import unicornPlugin from 'eslint-plugin-unicorn';

export default [
  // Base JavaScript configuration
  js.configs.recommended,

  // Prettier configuration
  prettierConfig,

  // Disable core no-useless-escape since we use regexp/no-useless-escape
  {
    rules: {
      'no-useless-escape': 'off', // Using regexp/no-useless-escape instead
    },
  },

  // Complexity rules werden von sonarjs/cognitive-complexity gehandhabt

  // TypeScript configuration for backend
  {
    files: ['backend/**/*.ts', 'backend/**/*.tsx'],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
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
      'tsdoc/syntax': 'warn',

      complexity: ['error', 60], // Beibehalten, aber SonarJS ist wichtiger.
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
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
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

      // --- ANGEPASST --- Deaktiviert wegen Circular Fix Konflikt
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
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
  },

  // Security configuration for all TypeScript/JavaScript files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      security: securityPlugin,
      'no-unsanitized': noUnsanitizedPlugin,
    },
    rules: {
      'security/detect-eval-with-expression': 'warn',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-object-injection': 'error',

      'no-unsanitized/method': 'warn',
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
  },

  // RegExp Plugin Configuration
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      regexp: regexpPlugin,
    },
    rules: {
      'regexp/no-super-linear-backtracking': 'error',
      'regexp/no-useless-lazy': 'error',
      'regexp/no-useless-quantifier': 'error',
      'regexp/optimal-quantifier-concatenation': 'error',
      'regexp/no-empty-alternative': 'error',
      'regexp/no-empty-group': 'error',
      'regexp/no-lazy-ends': 'error',
      'regexp/no-optional-assertion': 'error',
      'regexp/no-useless-escape': 'error',
      'regexp/no-useless-flag': 'error',
      'regexp/prefer-d': 'error',
      'regexp/prefer-w': 'error',
      'regexp/prefer-character-class': 'error',
      'regexp/sort-character-class-elements': 'error',
    },
  },

  // Promise Plugin Configuration
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
      // --- ANGEPASST --- Auf 'warn' gesetzt, um Flexibilität zu ermöglichen.
      'promise/prefer-await-to-then': 'warn',
      'promise/prefer-await-to-callbacks': 'error',
    },
  },

  // SonarJS Plugin Configuration
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
      'sonarjs/no-one-iteration-loop': 'error',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/non-existent-operator': 'error',

      // --- ANGEPASST --- Kognitive Komplexität auf einen realistischen Wert gesetzt.
      'sonarjs/cognitive-complexity': ['warn', 30],
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
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

  // Unicorn Plugin - Cherry-picked best rules
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/no-instanceof-builtins': 'error',
      'unicorn/no-new-buffer': 'error',
      'unicorn/catch-error-name': ['error', { name: 'error' }],
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/custom-error-definition': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-default-parameters': 'error',
      'unicorn/prefer-spread': 'error',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-modern-math-apis': 'error',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-undefined': 'error',
      'unicorn/filename-case': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/explicit-length-check': 'off',
      'unicorn/no-await-expression-member': 'off',
    },
  },

  // JSDoc Plugin - NUR für wichtige/public APIs (SELEKTIV)
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
  },

  // No-Secrets Plugin
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
          },
        },
      ],
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
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

      // --- ANGEPASST --- Korrigierte und vereinfachte Import-Reihenfolge.
      'import-x/order': [
        'warn',
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
  },

  // Frontend-specific DOM rules
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx', 'frontend/**/*.js'],
    rules: {
      'unicorn/prefer-modern-dom-apis': 'error',
      'unicorn/prefer-query-selector': 'error',
      'unicorn/prefer-dom-node-remove': 'error',
      'unicorn/prefer-dom-node-append': 'error',
      'unicorn/prefer-dom-node-text-content': 'error',
      'unicorn/prefer-dom-node-dataset': 'error',
    },
  },

  // Test files configuration
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
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
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
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
    },
  },

  // Remaining configurations for JS files, configs, etc.
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
      complexity: 'off',
      'max-depth': 'off',
      'max-lines': 'off',
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

  {
    files: ['**/jest.config.js', '**/jest.config.cjs'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        module: 'readonly',
        exports: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },

  {
    files: ['jest.globalSetup.js', 'jest.globalTeardown.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  {
    ignores: [
      'node_modules/**',
      'node_modules_old_backup/**',
      '**/node_modules_old_backup/**',
      '**/*.d.ts',
      'dist/**',
      'build/**',
      '*.min.js',
      'backend/dist/**',
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
      'jest.config.js',
      'jest.config.cjs',
      'uploads/**',
      'frontend/src/scripts/lib/**',
      'frontend/src/styles/lib/**',
      'frontend/public/**',
      '**/*.d.ts',
      'backend/src/database/migrations/**/*.js',
      'database/**/*.js',
      'backend/src/server-old.js',
      'backend/src/register-ts.js',
      'backend/src/__tests__/**',
      'backend/**/*.test.ts',
      'backend/**/*.spec.ts',
      'frontend/**/*.test.ts',
      'frontend/**/*.spec.ts',
      '**/__tests__/**',
      '**/test/**',
      '**/tests/**',
    ],
  },
];
``;
