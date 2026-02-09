# Storybook - Assixx Design System

**Version:** 10.2.7
**Framework:** HTML (via @storybook/html-vite)
**Builder:** Vite 7.x

## Quick Start

```bash
# Start Storybook (localhost:6006)
pnpm run storybook

# Build static Storybook
pnpm run build-storybook
```

## URLs

- **Development:** http://localhost:6006
- **Production Build:** `storybook-static/index.html`

## What's Documented

### 📦 Design System/Buttons

- **Primary** - Main CTA (gradient)
- **Primary-First** - Hero CTA (transparent)
- **Secondary** - Outline + glassmorphism
- **Danger** - Destructive actions (red)
- **Success** - Approval actions (green)
- **Status** - Toggle buttons (activate/deactivate)
- **Sizes** - sm, md, lg
- **Icons** - FontAwesome integration
- **States** - Loading, disabled

### 🎨 Design System/Tokens

- **Colors** - Material Design palette
- **Spacing** - 13-step scale (4px-96px)
- **Typography** - Font sizes, weights
- **Shadows** - 8 elevation levels

## File Structure

```
Assixx/
└── frontend/
    ├── .storybook/
    │   ├── main.js             # Main configuration
    │   ├── preview.js          # Global decorators & parameters
    │   ├── preview-head.html   # Fonts & Icons CDN
    │   └── stories/            # All story files
    │       ├── Buttons.stories.js
    │       └── DesignTokens.stories.js
    └── src/design-system/
        ├── tokens/         # Design tokens (colors, spacing, etc.)
        ├── primitives/     # Button components
        └── index.css       # Barrel export
```

## Why Storybook?

✅ **Best Practice 2025** - Industry standard (Microsoft, Google, Meta)
✅ **Living Documentation** - Always up-to-date with code
✅ **Component Playground** - Interactive testing
✅ **Design-Dev Alignment** - Single source of truth
✅ **Isolated Development** - No production interference

## Integration with Project

- **Development Mode:** Storybook runs separately from main app (Port 6006)
- **Production:** Excluded from build (NOT deployed)
- **Design Standards Page:** Removed from production (use Storybook instead)
- **CSS:** Shares same design tokens & Tailwind config

## Commands

```bash
# Development
pnpm run storybook              # Start dev server (http://localhost:6006)

# Stop Storybook
Ctrl + C                        # Im Terminal wo es läuft
pkill -f storybook              # Wenn Prozess hängt

# Check if running
lsof -i:6006                    # Zeigt Prozess auf Port 6006
curl http://localhost:6006      # HTTP 200 = läuft

# Production Build
pnpm run build-storybook        # Build static site → storybook-static/

# Deploy (optional)
# Serve storybook-static/ folder on design.assixx.com
```

## Hot Module Replacement (HMR)

**Änderungen sind SOFORT sichtbar - KEIN Restart nötig!** 🔥

### Was passiert bei Änderungen?

| Datei geändert                 | Was passiert       | Neu starten? |
| ------------------------------ | ------------------ | ------------ |
| **Story** (.stories.js)        | ✅ Auto-Reload <1s | ❌ NEIN      |
| **CSS** (design-system/\*.css) | ✅ Auto-Reload <1s | ❌ NEIN      |
| **Button CSS** (button.\*.css) | ✅ Auto-Reload <1s | ❌ NEIN      |
| **Config** (main.js)           | ⚠️ Manuell         | ✅ JA        |

### Beispiel Workflow:

```bash
# 1. Storybook läuft
http://localhost:6006 ✅

# 2. Datei in VS Code/Cursor/etc. öffnen und bearbeiten
# Beispiel: stories/Buttons.stories.js
# → Speichern → Browser updated AUTOMATISCH ✅

# 3. CSS ändern
# Beispiel: frontend/src/design-system/primitives/buttons/button.primary.css
# → Speichern → Browser updated AUTOMATISCH ✅

# 4. KEIN RESTART NÖTIG! 🚀
```

## Notes

- **Framework:** Using @storybook/html-vite (best HTML support)
- **CSS Warnings:** Tailwind @import order warnings can be ignored (funktioniert trotzdem!)
- **Stories Location:** All stories in `frontend/.storybook/stories/` directory
- **Design System Migration:** Button components already migrated from Bootstrap

## Real Life Production Preview

✅ **Storybook zeigt exakt wie Production aussieht:**

- Tailwind Utilities komplett aktiviert (via @tailwindcss/vite plugin)
- Google Fonts Outfit geladen (preview-head.html)
- FontAwesome CDN integriert
- Alle Design System CSS-Dateien
- Gleiche PostCSS Config wie Hauptapp

**Config-Details:**

- `frontend/.storybook/main.js` → Tailwind Plugin + PostCSS
- `frontend/.storybook/preview-head.html` → Fonts & Icons
- `frontend/tailwind.config.js` → Stories werden gescannt

## Future Extensions

- [ ] Form components (inputs, selects, checkboxes)
- [ ] Card components
- [ ] Modal components
- [ ] Table components
- [ ] Navigation components
- [ ] Toast notifications

---

**Maintained by:** SCS Technik
**Last Updated:** 2025-10-03
