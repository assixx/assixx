# 🔧 ESLint & Prettier Verbesserungsvorschläge

## Aktuelle Konfiguration - Bewertung

### ✅ Prettier - Sehr gut

Die aktuelle Prettier-Konfiguration folgt Best Practices:

- Konsistente Code-Formatierung
- Sinnvolle Defaults
- Override für Markdown-Dateien

### ⚠️ ESLint - Gut, aber verbesserbar

Die ESLint-Konfiguration ist funktional, könnte aber erweitert werden.

## Empfohlene Verbesserungen

### 1. Zusätzliche TypeScript-Regeln

```javascript
// In eslint.config.js hinzufügen:
rules: {
  // Bestehende Regeln...

  // Type Safety
  '@typescript-eslint/strict-boolean-expressions': ['error', {
    allowString: false,
    allowNumber: false,
    allowNullableObject: false,
  }],
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/await-thenable': 'error',

  // Code Quality
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/prefer-readonly': 'error',

  // Naming Conventions
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'interface',
      format: ['PascalCase'],
      custom: {
        regex: '^I[A-Z]',
        match: false
      }
    },
    {
      selector: 'typeAlias',
      format: ['PascalCase']
    },
    {
      selector: 'enum',
      format: ['PascalCase']
    }
  ],
}
```

### 2. Import/Export Regeln

```javascript
// ESLint Plugin Import installieren:
// pnpm add -D eslint-plugin-import

import importPlugin from 'eslint-plugin-import';

// In der Config:
plugins: {
  'import': importPlugin,
},
rules: {
  'import/order': ['error', {
    groups: [
      'builtin',
      'external',
      'internal',
      'parent',
      'sibling',
      'index'
    ],
    'newlines-between': 'always',
    alphabetize: {
      order: 'asc',
      caseInsensitive: true
    }
  }],
  'import/no-duplicates': 'error',
  'import/no-cycle': 'error',
  'import/no-self-import': 'error',
}
```

### 3. Security Rules

```javascript
// ESLint Plugin Security installieren:
// pnpm add -D eslint-plugin-security

import security from 'eslint-plugin-security';

plugins: {
  'security': security,
},
rules: {
  'security/detect-object-injection': 'warn',
  'security/detect-non-literal-regexp': 'warn',
  'security/detect-unsafe-regex': 'error',
  'security/detect-buffer-noassert': 'error',
  'security/detect-eval-with-expression': 'error',
  'security/detect-no-csrf-before-method-override': 'error',
  'security/detect-possible-timing-attacks': 'warn',
}
```

### 4. Prettier Erweiterungen

```json
{
  // In .prettierrc.json ergänzen:
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "htmlWhitespaceSensitivity": "css",
  "embeddedLanguageFormatting": "auto",
  "experimentalTernaries": false
}
```

### 5. Pre-commit Hooks mit Husky

```bash
# Installation
pnpm add -D husky lint-staged

# Setup
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

```json
// In package.json:
{
  "lint-staged": {
    "*.{js,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

### 6. VS Code Integration

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "typescript"],
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.eol": "\n"
}
```

## Zusätzliche Best Practices

### 1. Commitlint für Commit Messages

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional

echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js
```

### 2. TypeScript Strict Mode

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

### 3. Performance Budget

```javascript
// In ESLint config:
rules: {
  'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
  'complexity': ['warn', { max: 10 }],
  'max-depth': ['warn', { max: 4 }],
  'max-nested-callbacks': ['warn', { max: 3 }],
}
```

## Prioritäten

1. **Sofort:** EditorConfig hinzufügen ✅ (bereits erledigt)
2. **Hoch:** TypeScript strictness rules
3. **Mittel:** Import ordering rules
4. **Optional:** Security rules, Pre-commit hooks

Diese Verbesserungen würden die Code-Qualität und Konsistenz weiter erhöhen!
