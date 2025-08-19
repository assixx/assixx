import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import typescript from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import-x";
import securityPlugin from "eslint-plugin-security";
import noUnsanitizedPlugin from "eslint-plugin-no-unsanitized";
import regexpPlugin from "eslint-plugin-regexp";
import promisePlugin from "eslint-plugin-promise";
import sonarjsPlugin from "eslint-plugin-sonarjs";
import unicornPlugin from "eslint-plugin-unicorn";
import jsdocPlugin from "eslint-plugin-jsdoc";
import noSecretsPlugin from "eslint-plugin-no-secrets";
// import jsxA11yPlugin from "eslint-plugin-jsx-a11y"; // Für später wenn wir React/JSX haben

export default [
  // Base JavaScript configuration
  js.configs.recommended,

  // Prettier configuration
  prettierConfig,

  // Disable core no-useless-escape since we use regexp/no-useless-escape
  {
    rules: {
      "no-useless-escape": "off", // Using regexp/no-useless-escape instead
    },
  },

  // Global complexity rules for code quality
  {
    rules: {
      // complexity: ["warn", 15], // Deaktiviert - nutzen sonarjs/cognitive-complexity stattdessen
      // "max-depth": ["warn", 4], // Deaktiviert - nutzen sonarjs/no-collapsible-if stattdessen
      "max-lines": [
        "warn",
        { max: 2500, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "warn",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["warn", 4],
      "max-params": ["warn", 10], // Max 10 parameters
      "max-statements": ["warn", 75], // Max 55 statements per function
    },
  },

  // TypeScript configuration for backend
  {
    files: ["backend/**/*.ts", "backend/**/*.tsx"],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        project: "./backend/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "readonly",
        module: "readonly",
        require: "readonly",
        global: "readonly",
        Promise: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        Express: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      prettier,
      "import-x": importPlugin,
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          project: "./backend/tsconfig.json",
          alwaysTryTypes: true,
        },
        node: {
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      },
      "import-x/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import-x/external-module-folders": [
        "node_modules",
        "node_modules/@types",
      ],
    },
    rules: {
      // VOLLE STRENGE - strict-type-checked + stylistic-type-checked (wie in Backend Original)
      ...typescriptPlugin.configs["strict-type-checked"].rules,
      ...typescriptPlugin.configs["stylistic-type-checked"].rules,

      "prettier/prettier": "error",

      // Complexity rule aus original Backend Config
      complexity: ["error", 60],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/non-nullable-type-assertion-style": "off", // Konflikt mit no-non-null-assertion
      "no-console": ["warn", { allow: ["warn", "error", "info"] }], // Log nur für debugging
      // Additional type safety rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // STRICT MODE - Maximum Type Safety
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          // TODO: Backend und Frontend haben unterschiedliche Einstellungen
          allowString: true, // Backend: true, Frontend: false
          allowNumber: true, // Backend: true, Frontend: false
          allowNullableObject: true, // Beide: true
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/only-throw-error": "error", // Correct rule name

      // XSS/Injection Prevention
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",

      // Error Handling
      "no-unsafe-finally": "error",
      "require-atomic-updates": "warn", // Auf warn wegen False-Positives
      // Naming convention rules for camelCase enforcement
      "@typescript-eslint/naming-convention": [
        "error",
        // Default: prefer camelCase
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Variables: camelCase, UPPER_CASE for constants, PascalCase for components/Models, snake_case with underscore prefix
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase", "snake_case"],
          leadingUnderscore: "allow",
        },
        // Destructured variables from APIs can have any format
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        // Import default (for Model classes like UserModel, Department, etc.)
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        // Function parameters: Allow snake_case for DB fields (tenant_id, user_id, etc.)
        {
          selector: "parameter",
          format: ["camelCase", "snake_case"],
          leadingUnderscore: "allow",
        },
        // Common database field parameters - ignore format completely
        {
          selector: "parameter",
          filter:
            "^(tenant_id|user_id|created_at|updated_at|department_id|team_id|machine_id|shift_plan_id|org_id|is_pinned)$",
          format: null,
        },
        // Variables for database fields - allow snake_case
        {
          selector: "variable",
          filter:
            "^(tenant_id|user_id|created_at|updated_at|department_id|team_id|duration_hours|org_id|shift_plan_id|is_pinned)$",
          format: null,
        },
        // Properties: Allow both camelCase and snake_case (for API responses)
        {
          selector: "property",
          format: ["camelCase", "snake_case", "PascalCase", "UPPER_CASE"],
        },
        // Object literal properties: Allow any format (for API payloads)
        {
          selector: "objectLiteralProperty",
          format: null,
        },
        // Type properties: Allow any format (for API type definitions)
        {
          selector: "typeProperty",
          format: null,
        },
        // Types and interfaces: PascalCase
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // Enum members: UPPER_CASE
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
        // Functions: camelCase or PascalCase (for React components)
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        // Class methods: camelCase
        {
          selector: "method",
          format: ["camelCase"],
        },
      ],
      // Import order rules
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import-x/no-duplicates": "error",
      "import-x/no-cycle": "error",
      "import-x/no-self-import": "error",
      // Code quality - deaktiviert
      // 'max-lines': ['warn', { max: 3000, skipBlankLines: true, skipComments: true }],
      // complexity: ['warn', { max: 15 }],
      // 'max-depth': ['warn', { max: 5 }],
    },
  },

  // Security configuration for all TypeScript/JavaScript files
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      security: securityPlugin,
      "no-unsanitized": noUnsanitizedPlugin,
    },
    rules: {
      // Security plugin rules
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-non-literal-regexp": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-object-injection": "error",

      // No-unsanitized plugin rules for DOM XSS prevention
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",

      // Custom rule to prevent onclick attributes
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='setAttribute'][arguments.0.value='onclick']",
          message:
            "Use addEventListener instead of onclick attributes to prevent XSS",
        },
      ],
    },
  },

  // RegExp Plugin Configuration - ReDoS Prevention and Best Practices
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      regexp: regexpPlugin,
    },
    rules: {
      // ReDoS Prevention - CRITICAL
      "regexp/no-super-linear-backtracking": "error",

      // Performance
      "regexp/no-useless-lazy": "error",
      "regexp/no-useless-quantifier": "error",
      "regexp/optimal-quantifier-concatenation": "error",

      // Best Practices
      "regexp/no-empty-alternative": "error",
      "regexp/no-empty-group": "error",
      "regexp/no-lazy-ends": "error",
      "regexp/no-optional-assertion": "error",
      "regexp/no-useless-escape": "error",
      "regexp/no-useless-flag": "error",

      // Readability
      "regexp/prefer-d": "error", // Use \d instead of [0-9]
      "regexp/prefer-w": "error", // Use \w instead of [a-zA-Z0-9_]
      "regexp/prefer-character-class": "error",
      "regexp/sort-character-class-elements": "warn",
    },
  },

  // Promise Plugin Configuration - Async/Promise Best Practices
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      promise: promisePlugin,
    },
    rules: {
      // Promise Best Practices
      "promise/always-return": "error",
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/catch-or-return": "error",
      "promise/no-native": "off", // We use native promises
      "promise/no-nesting": "warn",
      "promise/no-promise-in-callback": "warn",
      "promise/no-callback-in-promise": "warn",
      "promise/avoid-new": "off", // Sometimes needed
      "promise/no-new-statics": "error",
      "promise/no-return-in-finally": "error",
      "promise/valid-params": "error",

      // Async/Await
      "promise/prefer-await-to-then": "warn",
      "promise/prefer-await-to-callbacks": "warn",
    },
  },

  // SonarJS Plugin Configuration - Code Quality and Bug Detection
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      sonarjs: sonarjsPlugin,
    },
    rules: {
      // Bug Detection
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/no-element-overwrite": "error",
      "sonarjs/no-extra-arguments": "error",
      "sonarjs/no-identical-conditions": "error",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-one-iteration-loop": "error",
      "sonarjs/no-use-of-empty-return-value": "error",
      "sonarjs/non-existent-operator": "error",

      // Code Smells
      "sonarjs/cognitive-complexity": ["warn", 50],
      "sonarjs/no-collapsible-if": "warn",
      "sonarjs/no-collection-size-mischeck": "error",
      "sonarjs/no-duplicate-string": ["warn", { threshold: 3 }],
      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-gratuitous-expressions": "error",
      "sonarjs/no-inverted-boolean-check": "warn",
      "sonarjs/no-redundant-boolean": "error",
      "sonarjs/no-redundant-jump": "error",
      "sonarjs/no-same-line-conditional": "warn",
      "sonarjs/no-small-switch": "warn",
      "sonarjs/no-unused-collection": "warn",
      "sonarjs/no-useless-catch": "error",
      "sonarjs/prefer-immediate-return": "warn",
      "sonarjs/prefer-object-literal": "warn",
      "sonarjs/prefer-single-boolean-return": "error",
    },
  },

  // Unicorn Plugin - Cherry-picked best rules (NON-DISRUPTIVE)
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      // SICHERHEIT & BUGS (als error)
      "unicorn/no-instanceof-builtins": "error", // instanceof Array/Object/Function ist falsch
      "unicorn/no-new-buffer": "error", // Buffer() deprecated, use Buffer.from()

      // DOM APIs entfernt - nur für Frontend relevant, nicht für Backend!
      // Siehe Frontend-spezifischer Block weiter unten

      // BESSERE ERROR HANDLING (als warn)
      "unicorn/catch-error-name": ["warn", { name: "error" }], // catch(error) nicht catch(e)
      "unicorn/prefer-optional-catch-binding": "warn", // catch {} statt catch (_error)
      "unicorn/custom-error-definition": "warn", // Richtige Error-Klassen

      // PERFORMANCE & LESBARKEIT (als warn)
      "unicorn/prefer-includes": "warn", // .includes() statt .indexOf() !== -1
      "unicorn/prefer-string-starts-ends-with": "warn", // startsWith/endsWith
      "unicorn/prefer-array-find": "warn", // .find() statt .filter()[0]
      "unicorn/prefer-array-some": "warn", // .some() statt .find() für boolean
      "unicorn/prefer-default-parameters": "warn", // Default params statt ||
      "unicorn/prefer-spread": "warn", // [...arr] statt Array.from()
      "unicorn/prefer-number-properties": "warn", // Number.isNaN statt isNaN
      "unicorn/prefer-modern-math-apis": "warn", // Math.trunc() statt ~~

      // NULL/UNDEFINED HANDLING (als warn)
      "unicorn/no-null": "off", // Zu disruptiv - wir nutzen null
      "unicorn/no-useless-undefined": "warn",

      // EXPLICITLY DISABLED - zu disruptiv
      "unicorn/filename-case": "off", // Würde alle Dateien umbenennen
      "unicorn/prevent-abbreviations": "off", // req, res, err sind OK
      "unicorn/no-array-for-each": "off", // forEach ist OK
      "unicorn/no-array-reduce": "off", // reduce ist OK
      "unicorn/explicit-length-check": "off", // if (arr.length) ist OK
      "unicorn/no-await-expression-member": "off", // (await foo).bar ist OK
    },
  },

  // JSDoc Plugin - NUR für wichtige/public APIs (SELEKTIV)
  {
    files: [
      // NUR diese Dateien brauchen vollständige Dokumentation:
      "**/controllers/**/*.ts", // API Controllers
      "**/services/**/*.ts", // Business Logic Services
      "**/utils/db.ts", // Database Utilities
      "**/middleware/auth*.ts", // Auth Middleware
      "**/routes/v2/**/*.ts", // V2 API Routes
      "**/config/*.ts", // Configuration Files
    ],
    plugins: {
      jsdoc: jsdocPlugin,
    },
    rules: {
      // BASIC JSDoc Requirements (als warn)
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            // ArrowFunctionExpression und FunctionExpression nur für exports
          },
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportDefaultDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > ClassDeclaration",
          ],
        },
      ],

      // PARAMETER & RETURN Documentation (als warn)
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-description": "off", // Description optional
      "jsdoc/require-param-type": "off", // TypeScript hat Types
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-description": "off", // Description optional
      "jsdoc/require-returns-type": "off", // TypeScript hat Types

      // VALIDITY Checks (als error - wenn JSDoc da ist, muss es korrekt sein)
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": [
        "error",
        {
          definedTags: ["swagger"],
        },
      ],
      "jsdoc/check-types": "off", // TypeScript handled das
      "jsdoc/valid-types": "off", // TypeScript handled das

      // EXPLIZIT DISABLED - zu streng
      "jsdoc/require-description": "off",
      "jsdoc/require-example": "off",
      "jsdoc/require-throws": "off",
    },
  },

  // No-Secrets Plugin - Detect API Keys, Passwords, Tokens
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      "no-secrets": noSecretsPlugin,
    },
    rules: {
      "no-secrets/no-secrets": [
        "error",
        {
          tolerance: 4.5, // Default is 5, lower = stricter
          additionalRegexes: {
            // Custom patterns für deutsche Begriffe
            "German Password": "(passwort|kennwort)\\s*[:=]\\s*['\"]?.+['\"]?",
            "JWT Token":
              "eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*",
          },
        },
      ],
    },
  },

  // TypeScript configuration for frontend
  {
    files: ["frontend/**/*.ts", "frontend/**/*.tsx"],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        project: "./frontend/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        alert: "readonly",
        confirm: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        atob: "readonly",
        btoa: "readonly",
        NodeJS: "readonly",
        closeAdminModal: "readonly",
        showModal: "readonly",
        hideModal: "readonly",
        // Browser API globals
        navigator: "readonly",
        screen: "readonly",
        crypto: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        requestAnimationFrame: "readonly",
        Audio: "readonly",
        prompt: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      prettier,
      "import-x": importPlugin,
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          project: "./frontend/tsconfig.json",
          alwaysTryTypes: true,
        },
        node: {
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      },
      "import-x/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import-x/external-module-folders": [
        "node_modules",
        "node_modules/@types",
      ],
    },
    rules: {
      // VOLLE STRENGE - strict-type-checked + stylistic-type-checked (wie in Frontend Original)
      ...typescriptPlugin.configs["strict-type-checked"].rules,
      ...typescriptPlugin.configs["stylistic-type-checked"].rules,

      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }], // Log nur für debugging
      // Additional type safety rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // STRICT MODE - Maximum Type Safety (Frontend ist STRENGER!)
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          // Frontend ist strenger als Backend (wie in Original Frontend Config)
          allowString: false, // Frontend: KEINE strings in conditions!
          allowNumber: false, // Frontend: KEINE numbers in conditions!
          allowNullableObject: true, // Beide: true
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/only-throw-error": "error", // Correct rule name

      // XSS/Injection Prevention
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",

      // Error Handling
      "no-unsafe-finally": "error",
      "require-atomic-updates": "warn", // Auf warn wegen False-Positives
      // Naming convention rules for camelCase enforcement
      "@typescript-eslint/naming-convention": [
        "warn",
        // Default: prefer camelCase
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Variables: camelCase, UPPER_CASE for constants, PascalCase for components/Models, snake_case with underscore prefix
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase", "snake_case"],
          leadingUnderscore: "allow",
        },
        // Destructured variables from APIs can have any format
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: null,
        },
        // Import default (for Model classes like UserModel, Department, etc.)
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        // Function parameters: Allow snake_case for DB fields (tenant_id, user_id, etc.)
        {
          selector: "parameter",
          format: ["camelCase", "snake_case"],
          leadingUnderscore: "allow",
        },
        // Common database field parameters - ignore format completely
        {
          selector: "parameter",
          filter:
            "^(tenant_id|user_id|created_at|updated_at|department_id|team_id|machine_id|shift_plan_id|org_id|is_pinned)$",
          format: null,
        },
        // Variables for database fields - allow snake_case
        {
          selector: "variable",
          filter:
            "^(tenant_id|user_id|created_at|updated_at|department_id|team_id|duration_hours|org_id|shift_plan_id|is_pinned)$",
          format: null,
        },
        // Properties: Allow both camelCase and snake_case (for API responses)
        {
          selector: "property",
          format: ["camelCase", "snake_case", "PascalCase", "UPPER_CASE"],
        },
        // Object literal properties: Allow any format (for API payloads)
        {
          selector: "objectLiteralProperty",
          format: null,
        },
        // Type properties: Allow any format (for API type definitions)
        {
          selector: "typeProperty",
          format: null,
        },
        // Types and interfaces: PascalCase
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // Enum members: UPPER_CASE
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
        // Functions: camelCase or PascalCase (for React components)
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        // Class methods: camelCase
        {
          selector: "method",
          format: ["camelCase"],
        },
      ],
      // Import order rules
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import-x/no-duplicates": "error",
      "import-x/no-cycle": "error",
      "import-x/no-self-import": "error",
      // Code quality - deaktiviert
      // 'max-lines': ['warn', { max: 3000, skipBlankLines: true, skipComments: true }],
      // complexity: ['warn', { max: 15 }],
      // 'max-depth': ['warn', { max: 5 }],
    },
  },

  // Frontend-specific DOM rules (nur für Browser-Code!)
  {
    files: ["frontend/**/*.ts", "frontend/**/*.tsx", "frontend/**/*.js"],
    rules: {
      // MODERNE DOM APIs - nur im Frontend relevant
      "unicorn/prefer-modern-dom-apis": "warn", // .append() statt .appendChild()
      "unicorn/prefer-query-selector": "warn", // querySelector statt getElementById
      "unicorn/prefer-dom-node-remove": "warn", // node.remove() statt parent.removeChild()
      "unicorn/prefer-dom-node-append": "warn", // append() statt appendChild()
      "unicorn/prefer-dom-node-text-content": "warn", // textContent statt innerText
      "unicorn/prefer-dom-node-dataset": "warn", // dataset statt getAttribute('data-')
    },
  },

  // Test files configuration
  {
    files: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/__tests__/**/*.ts",
      "**/*.test.js",
      "**/*.spec.js",
    ],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
      globals: {
        // Jest globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
        // Node globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      prettier,
      "import-x": importPlugin,
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      "prettier/prettier": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        global: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
      "arrow-body-style": ["error", "as-needed"],
      "prefer-arrow-callback": "error",
      "no-duplicate-imports": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "no-return-await": "error",
      complexity: "off",
      "max-depth": "off",
      "max-lines": "off",
      "require-await": "error",
      "no-async-promise-executor": "error",
      "prefer-promise-reject-errors": "error",
    },
  },

  // Browser environment for client-side JavaScript
  {
    files: [
      "frontend/src/scripts/**/*.js",
      "frontend/src/components/**/*.js",
      "frontend/src/pages/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        location: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        atob: "readonly",
        btoa: "readonly",
        FormData: "readonly",
        FileReader: "readonly",
        Blob: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        WebSocket: "readonly",
        XMLHttpRequest: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        EventTarget: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        // Additional browser globals
        screen: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        // Common libraries that might be used
        $: "readonly",
        jQuery: "readonly",
        bootstrap: "readonly",
        marked: "readonly",
        FullCalendar: "readonly",
        tippy: "readonly",
        // App-specific globals
        API_BASE_URL: "readonly",
        WS_URL: "readonly",
        // Additional globals for frontend scripts
        fetchWithAuth: "readonly",
        showError: "readonly",
        showSuccess: "readonly",
        fileNameSpan: "readonly",
        authService: "readonly",
        showModal: "readonly",
        hideModal: "readonly",
      },
    },
    rules: {
      "prettier/prettier": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },

  // Vite and PostCSS configs need ES modules
  {
    files: ["frontend/vite.config.js", "frontend/postcss.config.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
    },
  },

  // ESLint config files and ESM scripts
  {
    files: [
      "eslint.config.js",
      "backend/eslint.config.js",
      "frontend/eslint.config.js",
      "scripts/fix-esm-imports.js",
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        import: "readonly",
      },
    },
  },

  // Jest config files
  {
    files: ["**/jest.config.js", "**/jest.config.cjs"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        module: "readonly",
        exports: "writable",
        require: "readonly",
        __dirname: "readonly",
      },
    },
  },

  // Jest setup/teardown files
  {
    files: ["jest.globalSetup.js", "jest.globalTeardown.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "prettier/prettier": "error",
    },
  },

  {
    ignores: [
      // Node modules
      "node_modules/**",
      "node_modules_old_backup/**",
      "**/node_modules_old_backup/**",

      // TypeScript declaration files
      "**/*.d.ts",

      // Build outputs
      "dist/**",
      "build/**",
      "*.min.js",
      "backend/dist/**",
      "frontend/dist/**",

      // Coverage reports
      "coverage/**",

      // Log files
      "*.log",
      "backend/logs/**",

      // Environment files
      ".env",
      ".env.*",

      // Compiled JS from TypeScript (aber nicht frontend/dist)
      "backend/**/*.js",
      "!frontend/dist/**/*.js",
      "!scripts/fix-esm-imports.js",

      // Script files
      "scripts/fix-*.js",

      // Test config files
      "jest.config.js",
      "jest.config.cjs",

      // Other ignored files
      "uploads/**",
      "frontend/src/scripts/lib/**",
      "frontend/src/styles/lib/**",
      "frontend/public/**",

      // TypeScript Declaration Files
      "**/*.d.ts",

      // Database files
      "backend/src/database/migrations/**/*.js",
      "database/**/*.js",

      // Legacy files
      "backend/src/server-old.js",
      "backend/src/register-ts.js",

      // Test files
      "backend/src/__tests__/**",
      "backend/**/*.test.ts",
      "backend/**/*.spec.ts",
      "frontend/**/*.test.ts",
      "frontend/**/*.spec.ts",
      "**/__tests__/**",
      "**/test/**",
      "**/tests/**",
    ],
  },
];
