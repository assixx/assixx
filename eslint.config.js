import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import typescript from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import-x";

export default [
  // Base JavaScript configuration
  js.configs.recommended,

  // Prettier configuration
  prettierConfig,

  // Global overrides to disable complexity rules
  {
    rules: {
      complexity: "off",
      "max-depth": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
      "max-params": "off",
      "max-statements": "off",
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
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
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
      "no-console": "off",
      // Additional type safety rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
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

  // TypeScript configuration for frontend
  {
    files: ["frontend/**/*.ts", "frontend/**/*.tsx"],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        project: "./frontend/tsconfig.json",
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
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
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
      "no-console": "off",
      // Additional type safety rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
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
      "frontend/**/*.js",
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
