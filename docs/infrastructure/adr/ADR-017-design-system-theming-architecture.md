# ADR-017: Design System Theming Architecture

| Metadata                | Value                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                |
| **Date**                | 2026-02-02                                                                              |
| **Decision Makers**     | SCS-Technik                                                                             |
| **Affected Components** | Frontend CSS, Design System, Tailwind v4, Storybook, all component primitives, app.html |

---

## Context

Assixx is a multi-tenant SaaS application with a glassmorphism-based design system (29 component primitives, 200+ variants). The application was originally dark-mode-only. Adding light mode support required a systematic approach to theming that:

1. Doesn't break the existing glassmorphism aesthetic in dark mode
2. Scales to 29+ components without per-component overrides
3. Integrates with Tailwind v4's `@theme` directive and `dark:` variant
4. Prevents FOUC (Flash of Unstyled Content) on page load
5. Supports always-dark pages (landing, login, signup)
6. Remains simple enough that a junior dev can add a new themed value in under 2 minutes

The design system uses a **token-first** architecture where components reference semantic CSS variables, not raw color values. This ADR documents the variable architecture, the dark/light switching mechanism, and the rules for extending it.

---

## Decision

### 1. Three-Tier Token System

```
Tier 1: Primitives (@theme)     → --color-blue-500, --spacing-4, --radius-xl
Tier 2: Semantic (:root)        → --color-primary, --glass-bg, --color-text-primary
Tier 3: Component (primitives/) → References Tier 2 tokens only
```

**Tier 1 — Tailwind Primitives** (`app.css @theme`):
Raw design values. Theme-independent. Identical in dark and light. These are the Material Design color palette, spacing scale, typography, radii, and shadows. Tailwind v4 utilities (`bg-blue-500`, `text-gray-900`) are generated from these.

**Tier 2 — Semantic Tokens** (split across 6 files):
| File | Scope | Selector |
| -------------------- | --------------------------------- | --------------------- |
| `variables-light.css`| Neutral tokens + light defaults | `:root` |
| `variables-dark.css` | Dark mode overrides only | `html.dark` |
| `tokens/colors.css` | Semantic color mappings | `:root` + `html.dark` |
| `tokens/shadows.css` | Shadow tokens | `:root` + `html.dark` |
| `tokens/gradients.css`| Gradient tokens | `:root` + `html.dark` |
| `tokens/forms.css` | Form-specific tokens | `:root` + `html.dark` |

**Tier 3 — Component CSS** (`primitives/**/*.css`):
Components reference Tier 2 variables exclusively. No hardcoded colors. If a component needs a value that doesn't exist in Tier 2, you add it there first.

### 2. Class-Based Dark Mode Toggle

```html
<html lang="de" class="dark">
  <!-- Dark is default -->
</html>
```

- **Mechanism:** `.dark` class on `<html>` element
- **Specificity:** `html.dark` (0,1,1) always beats `:root` (0,1,0) — no `!important` needed
- **Tailwind v4 integration:** `@custom-variant dark (&:where(.dark, .dark *));` enables `dark:` utilities
- **Toggle:** Svelte 5 runes store (`theme.svelte.ts`) adds/removes `.dark` class + persists to `localStorage`

### 3. Glassmorphism Inversion Pattern

The core insight: glassmorphism uses semi-transparent overlays. On dark backgrounds, overlays are white (`rgb(255 255 255 / X%)`). On light backgrounds, overlays are black (`rgb(0 0 0 / X%)`). The variables invert automatically:

```css
/* Light mode (variables-light.css) */
:root {
  --glass-bg: rgb(0 0 0 / 6.2%); /* Dark overlay on light surface */
  --glass-border: 1px solid rgb(0 0 0 / 8%);
}

/* Dark mode (variables-dark.css) */
html.dark {
  --glass-bg: rgb(255 255 255 / 2%); /* Light overlay on dark surface */
  --glass-border: 1px solid rgb(255 255 255 / 10%);
}
```

Components use `var(--glass-bg)` and get the correct overlay direction for free.

### 4. FOUC Prevention

Inline `<script>` in `app.html` runs **before first paint** (synchronous, blocking):

```javascript
var path = window.location.pathname;
if (path === '/' || path === '/login' || path === '/signup') {
  // Always-dark pages: keep dark class
} else {
  var theme = localStorage.getItem('theme');
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  }
}
```

This ensures the correct theme class is on `<html>` before any CSS is evaluated. No flash.

### 5. Always-Dark Pages

Landing (`/`), login (`/login`), and signup (`/signup`) are always dark:

- FOUC script skips light mode for these paths
- Svelte components call `forceDark()` on mount (updates rune state without persisting)
- `restoreUserTheme()` on cleanup restores user's saved preference

### 6. CSS Import Order

Order in `app.css` is critical for correct cascade:

```css
@layer base, components, utilities; /* 1. Layer declaration */
@import 'tailwindcss'; /* 2. Tailwind + @theme primitives */
@custom-variant dark (...); /* 3. Dark variant */
@import 'variables-light.css'; /* 4. Semantic tokens (light defaults) */
@import 'variables-dark.css'; /* 5. Dark overrides */
@import 'base.css'; /* 6. Body, scrollbar, color-scheme */
@import 'design-system/index.css'; /* 7. All component primitives */
```

### 7. Storybook Integration (Planned)

`@storybook/addon-themes` with `withThemeByClassName`:

```javascript
// .storybook/preview.js
withThemeByClassName({
  themes: { dark: 'dark', light: '' },
  defaultTheme: 'dark',
  parentSelector: 'html',
});
```

This toggles the same `.dark` class Storybook-side, reusing all existing CSS without duplication.

---

## How to Modify

### Add a New Theme-Aware Variable

1. Define the **light mode default** in `variables-light.css` under `:root`:
   ```css
   :root {
     --my-new-token: #222; /* Light mode value */
   }
   ```
2. Define the **dark mode override** in `variables-dark.css` under `html.dark`:
   ```css
   html.dark {
     --my-new-token: #ddd; /* Dark mode value */
   }
   ```
3. Use in component CSS:
   ```css
   .my-component {
     color: var(--my-new-token);
   }
   ```

**Rule:** Never put the dark value in `variables-light.css` or the light value in `variables-dark.css`. Each file owns one theme.

### Replace a Hardcoded Color in a Component

1. Identify the hardcoded value (e.g., `color: #fff`)
2. Find the matching semantic variable:
   - Text white → `var(--color-text-primary)` (adapts to theme)
   - Glass overlay → `var(--glass-bg)` / `var(--glass-bg-hover)` / `var(--glass-bg-active)`
   - Border → `var(--color-glass-border)` or `var(--color-border)`
   - Background → `var(--color-background)` or `var(--color-surface)`
3. Replace. Test both themes.

**Common mappings:**
| Hardcoded value | Variable replacement |
| --------------------------- | --------------------------------- |
| `#fff` / `#000` (text) | `var(--color-text-primary)` |
| `rgb(255 255 255 / 2-3%)` | `var(--glass-bg)` |
| `rgb(255 255 255 / 5%)` | `var(--glass-bg-hover)` |
| `rgb(255 255 255 / 8-10%)` | `var(--glass-bg-active)` |
| `rgb(255 255 255 / 10%)` border | `var(--color-glass-border)` |
| `rgb(255 255 255 / 15-20%)` border | `var(--color-glass-border-hover)` |
| `#e0e0e0` / `#b0b0b0` | `var(--color-text-secondary)` |
| `rgba(0,0,0,0.5)` overlay | `var(--color-overlay-dark)` |

### Add a New Always-Dark Page

1. Add the path to the FOUC script in `app.html`:
   ```javascript
   if (path === '/' || path === '/login' || path === '/signup' || path === '/new-page') {
   ```
2. In the Svelte component:

   ```svelte
   <script>
     import { forceDark, restoreUserTheme } from '$lib/stores/theme.svelte';
     import { onMount } from 'svelte';

     onMount(() => {
       forceDark();
       return () => restoreUserTheme();
     });
   </script>
   ```

### Add Tailwind Dark Utilities

Use the `dark:` variant (auto-configured via `@custom-variant`):

```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Mixed Tailwind + design system</div>
```

Prefer CSS variables over `dark:` utilities for component-level theming. Use `dark:` for one-off layout tweaks.

---

## Alternatives Considered

### A. `prefers-color-scheme` Media Query

**Pros:** OS-level sync, zero JS needed.
**Cons:** No user override, no always-dark pages, no `localStorage` persistence, can't force dark for specific routes.
**Verdict:** Rejected. User control is essential for a SaaS app.

### B. CSS-only `[data-theme="dark"]` Attribute

**Pros:** Clean separation, no class toggling.
**Cons:** Tailwind v4 `dark:` variant requires class-based. Would need custom variant rewrite.
**Verdict:** Rejected. Fighting Tailwind is not KISS.

### C. Separate Stylesheets per Theme

**Pros:** Complete separation, easy to reason about.
**Cons:** Doubles CSS payload, cache invalidation on theme switch, maintenance nightmare with 29+ components.
**Verdict:** Rejected. Doesn't scale. Variable overrides are O(1) to add.

### D. CSS-in-JS / Svelte `style:` Directives

**Pros:** Co-located with components, type-safe.
**Cons:** Runtime overhead, no caching, breaks design system's CSS-only philosophy, makes Storybook harder.
**Verdict:** Rejected. CSS variables are faster, simpler, framework-agnostic.

### E. Tailwind `dark:` Everywhere (No CSS Variables)

**Pros:** Familiar, no custom variable system.
**Cons:** Glassmorphism requires computed `rgb(R G B / opacity%)` values that can't be expressed as Tailwind utilities. Every component would need 2x the class names. Not viable for 200+ variants.
**Verdict:** Rejected. Glassmorphism demands variable-driven opacity control.

---

## Consequences

### Positive

- **Single mechanism:** One `.dark` class controls everything — CSS variables, Tailwind `dark:`, Storybook theme switcher
- **Zero runtime overhead:** CSS variables are resolved by the browser, not JavaScript
- **FOUC-free:** Synchronous inline script resolves theme before first paint
- **Scalable:** Adding a new themed value = 2 lines (one per file), adding a new component = 0 theme work (just reference existing variables)
- **Storybook-compatible:** Same `.dark` class toggle works in Storybook's `withThemeByClassName`
- **Framework-agnostic:** CSS variables work with Svelte, React, or plain HTML — future migration path preserved
- **Glassmorphism preserved:** Inversion pattern maintains visual quality in both themes

### Negative

- **Two files to edit:** Every new themed value requires edits in both `variables-light.css` and `variables-dark.css`. Forgetting one file = broken theme. Mitigated by: keep them small, grep for missing counterparts in CI.
- **Legacy token debt:** ~20 legacy tokens (`--text-primary`, `--background-dark`, etc.) coexist with semantic tokens (`--color-text-primary`, `--color-background`). Must be cleaned up gradually.
- **No compile-time validation:** CSS variables are stringly-typed. A typo like `var(--colr-text-primary)` silently falls through. Mitigated by: Storybook visual QA, grep-based audits.
- **Always-dark duplication:** Each always-dark page must call `forceDark()` and update the FOUC script. Mitigated by: few such pages (3), documented pattern.

---

## File Map

```
app.html                    FOUC script (theme + always-dark paths)
app.css                     Import chain + @theme + @custom-variant dark
design-system/
  variables-light.css       :root — neutral tokens + light mode values
  variables-dark.css        html.dark — dark mode overrides only
  tokens/
    colors.css              Semantic color tokens (light/dark split)
    shadows.css             Shadow tokens (light/dark split)
    gradients.css           Gradient tokens (light/dark split)
    forms.css               Form tokens (light/dark split)
  primitives/               29 component directories (reference Tier 2 only)
lib/stores/
  theme.svelte.ts           Runtime toggle (runes, forceDark, restoreUserTheme)
lib/components/
  ThemeToggle.svelte        Visual sun/moon toggle with 3D track
routes/(app)/
  +layout.svelte            CSS-based logo switching, header, main content
  _lib/AppSidebar.svelte    Sidebar navigation, user info card
```

---

## References

- [LIGHTMODE-PLAN.md](../../LIGHTMODE-PLAN.md) — Step-by-step implementation log
- [Design System README](../../../frontend/src/design-system/README.md) — Component architecture
- [Tailwind v4 Dark Mode](https://tailwindcss.com/docs/dark-mode) — `@custom-variant` docs
- [Storybook Themes Addon](https://storybook.js.org/addons/@storybook/addon-themes) — `withThemeByClassName`
- [adr.github.io](https://adr.github.io/) — ADR methodology
