# Assixx Design System

## 🎨 Multi-Theme, Multi-Platform Design Tokens

### Quick Start

```bash
# Install dependencies
npm install

# Build all tokens
npm run build

# Watch mode (development)
npm run build:watch
```

### 📁 Structure

```
tokens/
  core/        → Raw values (colors, spacing, etc.)
  semantic/    → Meaningful names (primary, background)
  themes/      → Theme-specific overrides (dark, light, contrast)
```

### 🎯 Usage

#### CSS Variables
```html
<!-- Default Dark Theme -->
<link rel="stylesheet" href="/design-system/build/web/css/variables-dark.css">

<!-- Theme Switching -->
<body data-theme="light">
  <!-- Will use light theme variables -->
</body>
```

#### Tailwind
```javascript
// tailwind.config.js
const designTokens = require('./design-system/build/web/tailwind');

module.exports = {
  theme: {
    extend: {
      ...designTokens.current
    }
  }
}
```

#### TypeScript
```typescript
import { tokens } from './design-system/build/web/ts';

// Type-safe token access
const primaryColor = tokens['color.primary'];
```

### 🌓 Theme Switching

```javascript
// JavaScript
document.documentElement.setAttribute('data-theme', 'light');

// Or with class
document.documentElement.classList.toggle('dark');
```

### 📊 Available Themes

- **dark** - Default dark theme
- **light** - Light theme
- **contrast** - High contrast accessibility theme

### 🚀 Future Platforms

- iOS (Swift)
- Android (Kotlin/XML)
- React Native
- Flutter