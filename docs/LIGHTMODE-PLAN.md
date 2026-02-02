# Light Mode Implementation Plan

| Metadata     | Value                                               |
| ------------ | --------------------------------------------------- |
| **Branch**   | `variables/lightmode`                               |
| **Created**  | 2026-02-02                                          |
| **Status**   | In Progress — Step 5k done, Visual QA next          |
| **Approach** | Class-based `.dark` on `<html>`, dark-first default |

---

## Architecture Decision

**Class-based toggling:** `.dark` class on `<html>` element.

- Tailwind v4 native via `@custom-variant dark`
- `dark:` utilities work automatically
- `app.html` already has `class="dark"`
- Dark = default. Remove `.dark` = light mode.

**File split:** `variables-light.css` (`:root` defaults) + `variables-dark.css` (`html.dark` overrides)

**Always-dark pages:** `/`, `/login`, `/signup` force dark mode via `forceDark()` / `restoreUserTheme()` + FOUC script path check.

**Layout split:** `(app)/+layout.svelte` was split for ESLint max-lines compliance. Sidebar navigation extracted into `(app)/_lib/AppSidebar.svelte` (owns submenu state, user info card, storage widget). Layout keeps header, main content area, logo switching.

---

## Steps

### Step 1: CSS Variable Architecture — DONE

- [x] **1a.** Split `variables-dark.css` into two files:
      `variables-light.css` (`:root` — neutral tokens + light values)
      `variables-dark.css` (`html.dark` — dark overrides only)
- [x] **1b.** Token files updated (`colors.css`, `shadows.css`, `gradients.css`, `forms.css`):
      `html.dark` overrides where tokens have dark-specific values.
- [x] **1c.** `base.css` updated: Theme-aware `color-scheme`, body bg via `--main-bg`,
      `body::after` gradient via `--main-bg-gradient`, scrollbar theming.
- [x] **1d.** Tailwind v4 dark variant in `app.css`:
      `@custom-variant dark (&:where(.dark, .dark *));`
- [ ] **1e.** Clean up dead `styles/design-system/variables-dark.css` (not imported anywhere).

### Step 2: Theme Store + Toggle — DONE

- [x] **2a.** Created `frontend/src/lib/stores/theme.svelte.ts` (Svelte 5 runes).
      Exports: `isDark()`, `getTheme()`, `toggleTheme()`, `setTheme()`, `forceDark()`, `restoreUserTheme()`.
- [x] **2b.** ThemeToggle wired to store (toggle, sun/moon icons, knob animation).
- [x] **2c.** FOUC prevention inline script in `app.html` (reads localStorage, skips always-dark pages).
- [x] **2d.** Light mode track: `var(--color-icon-primary)` background + inset box-shadow 3D effect.
- [x] **2e.** Light mode knob: uses default gradient (removed dark override).

### Step 3: Component CSS Fixes (161 → 32 hardcoded values) — DONE

Replaced hardcoded `rgb(255 255 255 / X%)` with CSS variable references across **32 component files**:

| Category         | Files fixed                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| **Cards**        | card-base, card-accent, card-stat                                             |
| **Modals**       | modal.base                                                                    |
| **Layout**       | container.base                                                                |
| **Forms**        | custom-dropdown, search-input                                                 |
| **Tables**       | table.base, table.striped, table.borderless                                   |
| **Feedback**     | progress, skeleton, alert.base, alert.variants, spinner, toast (prev session) |
| **Navigation**   | pagination, accordion, tabs, stepper, breadcrumb, collapse                    |
| **Toggles**      | toggle-switch, toggle-button-group                                            |
| **Pickers**      | time-picker, date-picker                                                      |
| **Choice Cards** | choice-card.base, choice-card.feature, choice-card.plan                       |
| **Data Display** | avatar, empty-state (×2), sticky-note                                         |
| **File Upload**  | file-upload-list, file-upload-zone                                            |
| **Buttons**      | button.secondary, button.action-icons, button.modal                           |
| **Other**        | tooltip                                                                       |

**Variable mapping used:**

- `rgb(255 255 255 / 2-3%)` → `var(--glass-bg)`
- `rgb(255 255 255 / 5%)` → `var(--glass-bg-hover)`
- `rgb(255 255 255 / 8-10%)` → `var(--glass-bg-active)`
- `rgb(255 255 255 / 10%)` border → `var(--color-glass-border)`
- `rgb(255 255 255 / 15-20%)` border → `var(--color-glass-border-hover)`
- Text colors → `var(--color-text-primary/secondary/muted)`

Remaining 32 values are **intentional** (white thumbs, stripes on colored bars, white text on colored backgrounds).

**Post-Step-3 fix:** `custom-dropdown.css` — `.dropdown__option:hover i` and `.dropdown__option:hover .material-symbols-outlined` changed from hardcoded `#fff` to `var(--color-text-primary)` (adapts to light/dark).

### Step 4: Always-Dark Pages + Logo Switching — DONE

- [x] **4a.** FOUC script in `app.html` skips light mode on `/`, `/login`, `/signup`.
- [x] **4b.** `forceDark()` on mount + `restoreUserTheme()` on cleanup for all 3 pages.
- [x] **4c.** App layout logo: CSS-based switching (`logo-dark`/`logo-light` classes + `html:not(.dark)` rules) — no JS hydration needed, no FOUC.
- [x] **4d.** Login/signup/landing logos still use `isDark()` (always-dark pages, so always correct).

### Step 5: Layout + Navigation Polish — DONE

- [x] **5a.** Header: `background` → `var(--glass-bg)`, sidebar toggle `color` → `var(--color-text-primary)`, `fill="white"` → `fill="currentColor"`.
- [x] **5b.** Dedicated main background variables: `--main-bg` + `--main-bg-gradient` (original dark values restored: `#000` + blue shimmer gradient).
- [x] **5c.** `--color-text-secondary` light mode → `#1a1a1a`.
- [x] **5d.** `--glass-bg` light mode → `rgb(0 0 0 / 6.2%)`.
- [x] **5e.** Sidebar: 19 hardcoded values in `unified-navigation.css` → CSS variables.
      New nav variables: `--nav-hover-bg`, `--nav-active-submenu-bg`, `--scrollbar-thumb-hover`,
      `--sidebar-fold-edge`, `--sidebar-fold-bg` (added to both theme files).
- [x] **5f.** User info card, scrollbar, session timer, employee number → themed variables.
- [x] **5g.** Page-specific CSS files tokenized (10 files, ~60 replacements):
      `admin-dashboard.css`, `employee-dashboard.css`, `logs.css`, `kvp.css`,
      `kvp-detail.css`, `shifts.css`, `chat.css`, `calendar.css`,
      `storage-upgrade.css`, `survey-employee.css`, `root-profile.css`.
      Skipped: `index.css`, `login.css`, `signup.css` (always-dark pages).
- [x] **5h.** Deep audit pass — searched for `background: rgb(255 255 255 / 2%)`,
      `color: rgb(255 255 255 / 50%)`, `color: var(--color-white)` across entire `frontend/src/`.
      **11 files fixed (~25 replacements):**

      | File                       | Edits                                                     |
      | -------------------------- | --------------------------------------------------------- |
      | `card/card.css`            | border ×2 + bg → `--color-glass-border`, `--glass-bg`     |
      | `calendar.css`             | 3× bg, 2× border-8%, 1× border-bottom-5%                 |
      | `chat.css`                 | 1× bg                                                     |
      | `documents-explorer.css`   | odd-row bg + even-row bg (2% → `--glass-bg`, 4% → hover) |
      | `tenant-deletion-status.css` | border + bg                                              |
      | `blackboard.css`           | scrollbar track/thumb + 3× border-10%                     |
      | `features.css`             | 2× bg, 2× border, hover border-color + bg, btn-hover bg  |
      | `CommentSection.svelte`    | `color: rgb(255 255 255 / 50%)` → `var(--text-muted)`     |
      | `EventDetailModal.svelte`  | 2× border-8% + 1× bg                                     |
      | `button.light.css`         | Bug fix: `color: var(--color-white)` → `var(--color-text-primary)` (comment said "dark text", code had white) |

      **Audit results — intentional / no change needed:**
      - `color: var(--color-white)` — 17/18 intentional (white text on colored buttons, tooltips, spinners)
      - `color: rgb(255 255 255 / 50%)` — 2/3 intentional (disabled state on colored buttons)
      - `background: rgb(255 255 255 / 2%)` — 8 remaining all in always-dark pages (index/login/signup)

- [x] **5i.** Button text color audit — 7 buttons with semi-transparent backgrounds
      had `color: var(--color-white)` (invisible in light mode):
      `btn-success`, `btn-warning`, `btn-info`, `btn-edit`, `btn-manage`,
      `btn-light`, `btn-primary-first` → all changed to `var(--color-text-primary)`.
      Loading spinners on `btn-info`, `btn-edit`, `btn-manage` also fixed.
      **Reverse fix:** `btn-modal` had `var(--color-text-primary)` on opaque dark bg
      (Step 3 error) → restored to `var(--color-white)`.
      **Rule:** Opaque dark bg → `--color-white` | Semi-transparent bg → `--color-text-primary`.
- [x] **5j.** `custom-dropdown.css` — hover text `#fff` → `var(--color-text-primary)`
      (2 instances: option text + option-secondary text). Icons were already fixed in Step 3.
- [x] **5k.** Toggle switch (`toggle-switch.css`) — OFF track invisible in light mode.
      Added `border: 1px solid var(--color-glass-border)`, bg `--glass-bg-hover` → `--glass-bg-active`.
      Thumb shadow: white inset highlight → subtle `rgb(0 0 0 / 6%)` ring (works both themes).
- [x] **5l.** Light mode `--main-bg-gradient` improved: plain white → visible blue shimmer
      (`5% → 8%` blue stops at 30%/60%, `gray-100` bottom).

      **Remaining hardcoded values (low priority):**
      - `blackboard.css` decorative patterns (`#ffffff57`, `#ffffffb2`, chalk textures)
      - Svelte inline styles in various components
      - Tailwind RGBA utility classes in templates

### Step 6: Visual QA — TODO (MUST before merge)

- [ ] **6a.** Start app (`pnpm run dev:svelte`), switch to light mode.
- [ ] **6b.** Walk through every page, screenshot issues.
- [ ] **6c.** Fix discovered issues.
- [ ] **6d.** Verify dark mode is NOT broken (regression check).

### Step 7: Storybook Integration — NICE-TO-HAVE

- [ ] **7a.** Install `@storybook/addon-themes`.
- [ ] **7b.** Configure `withThemeByClassName` in `.storybook/preview.js`.
- [ ] **7c.** Visual QA all 25 stories in both modes.

### Step 8: Cleanup — TODO

- [ ] **8a.** Remove dead `styles/design-system/variables-dark.css`.
- [ ] **8b.** Remove unused `--gradient-body-bg` from `gradients.css` (replaced by `--main-bg-gradient`).
- [ ] **8c.** Final audit: grep for remaining hardcoded dark-only values.

---

## Key Files

| File                           | Role                                        |
| ------------------------------ | ------------------------------------------- |
| `variables-light.css`          | `:root` — neutral tokens + light mode       |
| `variables-dark.css`           | `html.dark` — dark mode overrides           |
| `tokens/colors.css`            | Semantic color tokens (light/dark split)    |
| `tokens/shadows.css`           | Shadow tokens (light/dark split)            |
| `tokens/gradients.css`         | Gradient tokens (light/dark split)          |
| `tokens/forms.css`             | Form tokens (light/dark split)              |
| `base.css`                     | Body bg, scrollbar, color-scheme            |
| `app.css`                      | `@custom-variant dark`, import chain        |
| `app.html`                     | FOUC prevention script + always-dark paths  |
| `theme.svelte.ts`              | Theme store (runes, forceDark, restore)     |
| `ThemeToggle.svelte`           | Visual toggle with 3D track                 |
| `unified-navigation.css`       | Header/sidebar/logo styles                  |
| `(app)/+layout.svelte`         | CSS-based logo switching, header, main      |
| `(app)/_lib/AppSidebar.svelte` | Sidebar nav, user info card, storage widget |

## Risk Log

| Issue                         | Resolution                                                  |
| ----------------------------- | ----------------------------------------------------------- |
| Dark mode body bg changed     | Fixed: dedicated `--main-bg` / `--main-bg-gradient`         |
| Logo wrong after cache clear  | Fixed: CSS-based switching (no JS hydration needed)         |
| Always-dark pages flash light | Fixed: FOUC script path check + `forceDark()`               |
| Glass effects wrong in light  | Fixed: variable mapping with inverted overlays              |
| btn-light white text on white | Fixed: `var(--color-white)` → `var(--color-text-primary)`   |
| 7 btns white text on glass    | Fixed: semi-transparent bg buttons → `--color-text-primary` |
| btn-modal dark text on dark   | Fixed: Step 3 error, restored `var(--color-white)`          |
| dropdown hover #fff invisible | Fixed: option text + secondary → `--color-text-primary`     |
| toggle track invisible light  | Fixed: added border + stronger bg, thumb shadow adapted     |
