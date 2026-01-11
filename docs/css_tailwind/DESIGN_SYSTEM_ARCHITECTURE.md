# Design System Architecture 2025 - Multi-Theme & Multi-Platform

## 🎯 ULTRA-DURCHDACHTE STRUKTUR

### Kern-Prinzipien

1. **Semantic Tokens** > Color Values
2. **Theme-agnostic Core**
3. **Platform-specific Outputs**
4. **Type-safe Everything**

## 📁 PERFEKTE ORDNERSTRUKTUR

```bash
/design-system/
├── tokens/
│   ├── core/                    # 🌍 Platform-agnostic
│   │   ├── colors.json          # Raw: blue-500, gray-900
│   │   ├── typography.json      # Sizes: xs, sm, md, lg
│   │   ├── spacing.json         # 4, 8, 16, 24, 32
│   │   ├── radii.json           # Borders: sm, md, lg
│   │   └── shadows.json         # Elevations: 1-5
│   │
│   ├── semantic/                # 🎨 Bedeutungs-Layer
│   │   ├── colors.json          # primary -> {core.blue-500}
│   │   ├── typography.json      # heading-1 -> {core.xl}
│   │   └── components.json      # button-padding -> {core.16}
│   │
│   ├── themes/                  # 🌓 Theme Variations
│   │   ├── base.json           # Shared across themes
│   │   ├── light/
│   │   │   └── index.json      # bg -> white, text -> gray-900
│   │   ├── dark/
│   │   │   └── index.json      # bg -> gray-900, text -> white
│   │   ├── contrast/           # Accessibility
│   │   │   └── index.json      # High contrast mode
│   │   └── brand/              # White-Label
│   │       ├── assixx/        # Default brand
│   │       └── [client]/      # Custom brands
│   │
│   └── platforms/              # 📱 Platform Overrides
│       ├── web/
│       │   └── overrides.json # CSS-specific
│       ├── ios/
│       │   └── overrides.json # iOS-specific
│       └── android/
│           └── overrides.json # Android-specific
│
├── config/
│   ├── style-dictionary.config.js
│   └── transforms/            # Custom transforms
│       ├── css-variables.js
│       ├── tailwind.js
│       └── typescript.js
│
├── build/                     # 🏗️ Generated (git-ignored)
│   ├── web/
│   │   ├── css/
│   │   │   ├── variables-light.css
│   │   │   ├── variables-dark.css
│   │   │   └── variables-contrast.css
│   │   ├── tailwind/
│   │   │   └── theme.js
│   │   └── ts/
│   │       └── tokens.ts
│   ├── ios/
│   │   └── Colors.swift
│   └── android/
│       └── colors.xml
│
└── scripts/
    ├── build.js              # Build all platforms
    ├── watch.js              # Dev mode
    └── validate.js           # Token validation
```

## 🔄 TOKEN FLOW

```mermaid
Core Tokens (blue-500: #2196F3)
    ↓
Semantic Tokens (primary: blue-500)
    ↓
Theme Layer (dark: primary: blue-400)
    ↓
Platform Output (--color-primary: #42A5F5)
```

## 💡 BEISPIEL TOKEN-STRUKTUR

### Core Token (colors.json)

```json
{
  "color": {
    "blue": {
      "50": { "value": "#E3F2FD" },
      "500": { "value": "#2196F3" },
      "900": { "value": "#0D47A1" }
    }
  }
}
```

### Semantic Token (semantic/colors.json)

```json
{
  "color": {
    "primary": { "value": "{color.blue.500}" },
    "background": { "value": "{color.gray.50}" },
    "text": { "value": "{color.gray.900}" }
  }
}
```

### Theme Override (themes/dark/index.json)

```json
{
  "color": {
    "background": { "value": "{color.gray.900}" },
    "text": { "value": "{color.gray.50}" },
    "primary": { "value": "{color.blue.400}" }
  }
}
```

## 🚀 THEME SWITCHING

### CSS (Runtime)

```css
/* Automatisch generiert */
:root {
  --color-background: #fafafa; /* Light mode default */
  --color-text: #212121;
}

[data-theme='dark'] {
  --color-background: #121212;
  --color-text: #fafafa;
}

[data-theme='contrast'] {
  --color-background: #000000;
  --color-text: #ffffff;
}
```

### TypeScript Support

```typescript
// Auto-generiert
export const themes = {
  light: { ... },
  dark: { ... },
  contrast: { ... }
} as const;

export type Theme = keyof typeof themes;
```

## ⚡ WARUM DIESE STRUKTUR?

### ✅ Skalierbar

- Neue Themes = neuer Ordner
- Neue Platform = neuer Ordner
- Keine Breaking Changes

### ✅ Maintainable

- Klare Trennung von Concerns
- Single Source of Truth
- Git-friendly JSON

### ✅ Type-Safe

- TypeScript Generierung
- Autocomplete in IDE
- Compile-time Checks

### ✅ Multi-Brand Ready

- White-Label durch theme/brand/
- Client-specific Overrides
- Zentrale Verwaltung

## 🎯 MIGRATION PATH

1. **Phase 1**: Core Tokens aus CSS extrahieren
2. **Phase 2**: Semantic Layer aufbauen
3. **Phase 3**: Dark Theme implementieren
4. **Phase 4**: Tailwind Integration
5. **Phase 5**: TypeScript Types
6. **Phase 6**: Component Tokens

## 🔧 BUILD PIPELINE

```javascript
// style-dictionary.config.js
module.exports = {
  source: [
    'tokens/core/**/*.json',
    'tokens/semantic/**/*.json',
    'tokens/themes/base.json',
    'tokens/themes/{theme}/**/*.json', // Per theme
    'tokens/platforms/web/**/*.json',
  ],
  platforms: {
    'web-css': {
      /* CSS Variables */
    },
    'web-tailwind': {
      /* Tailwind Config */
    },
    'web-ts': {
      /* TypeScript */
    },
    ios: {
      /* Swift */
    },
    android: {
      /* Kotlin/XML */
    },
  },
};
```

## 🏆 ENDERGEBNIS

```bash
# Ein Befehl baut ALLES
npm run tokens:build

# Outputs:
✅ CSS Variables (Light/Dark/Contrast)
✅ Tailwind Config
✅ TypeScript Types
✅ iOS Swift Files
✅ Android Resources
```

**Diese Struktur hält 10+ Jahre!**
