/**
 * MAXIMUM STRICTNESS ESLint Configuration - BACKEND
 * Zero-Tolerance für schlechten Code
 * Basiert auf Google/Microsoft Enterprise Standards
 *
 * PHILOSOPHIE: Lieber jetzt Schmerzen als später Bugs!
 */

import js from "@eslint/js";
import typescript from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  prettierConfig,

  // TypeScript files - MAXIMUM STRICTNESS!
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescript,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.eslint.json",
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
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        NodeJS: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      prettier,
    },
    rules: {
      // VOLLE STRENGE - strict-type-checked + stylistic-type-checked
      ...typescriptPlugin.configs["strict-type-checked"].rules,
      ...typescriptPlugin.configs["stylistic-type-checked"].rules,

      "prettier/prettier": "error",

      // ALLES IST ERROR - KEINE KOMPROMISSE!
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-empty-function": "error",
      "no-console": ["error", { allow: ["warn", "error", "info", "debug"] }],

      // Type Safety - MAXIMUM
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",

      // Code Quality - MAXIMUM
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        {
          ignoreConditionalTests: false,
          ignoreTernaryTests: false,
          ignoreMixedLogicalExpressions: false,
        },
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "warn",
        { allowConstantLoopConditions: true },
      ],

      // strict-boolean-expressions - VOLLE STRENGE
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
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

      // Template Expressions - STRENG
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true, // Numbers sind OK
          allowBoolean: true,
          allowAny: false,
          allowNullish: true,
          allowRegExp: false,
        },
      ],

      // Weitere strenge Rules
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
      "@typescript-eslint/no-unnecessary-qualifier": "error",
      "@typescript-eslint/no-useless-empty-export": "error",
      "@typescript-eslint/prefer-includes": "error",
      "@typescript-eslint/prefer-reduce-type-parameter": "error",
      "@typescript-eslint/prefer-return-this-type": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": false,
          "ts-nocheck": false,
          "ts-check": false,
        },
      ],

      // Disable ESLint rules that conflict with Prettier
      "comma-dangle": "off",
      "@typescript-eslint/comma-dangle": "off",

      // Disable base rules that are handled by TypeScript
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "no-shadow": "off",
      "require-await": "off",
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/no-shadow": "error",
    },
  },

  // JavaScript files (scripts, configs) - AUCH STRENG!
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        import: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": "error",
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "prefer-const": "error",
      "no-var": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-eval": "error",
      "no-implied-eval": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "require-await": "error",
      "no-return-await": "error",
      "no-async-promise-executor": "error",
      "prefer-promise-reject-errors": "error",
      "object-shorthand": "error",
      "no-duplicate-imports": "error",
    },
  },

  // Test files - EINZIGE Ausnahme
  {
    files: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.test.js",
      "**/*.spec.js",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.js",
      "**/test/**/*.ts",
      "**/test/**/*.js",
    ],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "no-console": "off",
    },
  },

  // Ignore patterns - Best Practice 2025
  {
    ignores: [
      // Standard Build/Dependencies
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".vite/**",

      // SQL Files (ESLint kann SQL nicht parsen)
      "**/*.sql",
      "database/migrations/**",
      "database/backups/**",

      // Environment & Logs
      "*.log",
      "logs/**",
      ".env",
      ".env.*",

      // Generated/Minified
      "**/*.min.js",
      "**/*.min.css",
      "**/*.generated.*",

      // Type Declarations
      "**/*.d.ts",

      // Temp & Cache
      "tmp/**",
      ".cache/**",

      // WICHTIG: JavaScript in scripts/ wird GELINTET für Code-Qualität!
    ],
  },
];
