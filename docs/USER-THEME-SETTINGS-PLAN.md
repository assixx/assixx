# User Theme Settings — Implementation Plan

| Metadata    | Value                                        |
| ----------- | -------------------------------------------- |
| **Branch**  | `variables/lightmode`                        |
| **Created** | 2026-02-04                                   |
| **Status**  | Implemented                                  |
| **Depends** | ADR-017 (Design System Theming Architecture) |

---

## Problem

Theme preference (dark/light) is currently stored **only in localStorage**. That means:

- Switch browser → preference gone
- Clear cache → preference gone
- Login from another device → preference gone

We need to persist it per-user in the database.

---

## Analysis: What Already Exists

| Layer    | Status  | Detail                                                                                     |
| -------- | ------- | ------------------------------------------------------------------------------------------ |
| DB Table | EXISTS  | `user_settings` (id, user_id, tenant_id, setting_key, setting_value, value_type, category) |
| RLS      | EXISTS  | User can only read/write own settings                                                      |
| Backend  | EXISTS  | Full CRUD at `GET/POST/PUT/DELETE /api/v2/settings/user/:key`                              |
| Category | EXISTS  | `appearance` is a predefined category                                                      |
| Frontend | MISSING | No settings page, sidebar "Einstellungen" is `#settings` placeholder                       |

**Consequence: NO database migration needed. NO backend changes needed. This is pure frontend work.**

---

## Design Decision: Storage Strategy

```
localStorage  = primary   (instant, FOUC prevention, no latency)
user_settings = persistence (cross-device, cross-browser sync)
```

**On theme change:**

1. `localStorage.setItem('theme', value)` — synchronous, instant
2. `PUT /api/v2/settings/user/theme` — fire-and-forget, background

**On app load (authenticated):**

1. FOUC script reads localStorage (before paint — already works)
2. Layout fetches `GET /api/v2/settings/user/theme` once
3. If DB value exists AND differs from localStorage → update localStorage + apply theme

**Why this order:** localStorage is needed for FOUC prevention (ADR-017). The DB is the backup for persistence. localStorage always wins on page load for speed. DB wins on first login from a new device.

---

## Setting Schema

```
setting_key:   'theme'
setting_value: 'dark' | 'light'
value_type:    'string'
category:      'appearance'
```

**Why string, not boolean?** Future-proof for `'auto'` (OS preference) or custom themes. Still KISS — just one key, two values.

---

## Steps

### Step 1: Theme Store — Add API Sync

**File:** `frontend/src/lib/stores/theme.svelte.ts`

Changes:

- Add `syncThemeToApi(theme)` — fire-and-forget PUT call
- Add `loadThemeFromApi()` — one-time GET on app load
- Modify `setTheme()` to call `syncThemeToApi()` after localStorage write
- Export `loadThemeFromApi()` for layout to call

**Logic:**

```
setTheme(theme):
  1. currentTheme = theme
  2. Toggle .dark class on <html>
  3. localStorage.setItem('theme', theme)
  4. syncThemeToApi(theme)  ← NEW (fire-and-forget)

loadThemeFromApi():
  1. GET /api/v2/settings/user/theme
  2. If response has value AND value !== localStorage value:
     → setTheme(apiValue)  (updates localStorage + DOM)
  3. If 404 (no setting yet):
     → POST current localStorage value to API (initial sync)
```

### Step 2: Navigation Config — Wire Up "Einstellungen"

**File:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

Changes for **all 3 roles**:

**Admin** (currently `url: '#settings'`):

```
{ id: 'settings', icon: ICONS.settings, label: 'Einstellungen',
  submenu: [
    { id: 'design', label: 'Design', url: '/settings/design' }
  ]
}
```

**Employee** (currently no settings item):

```
{ id: 'settings', icon: ICONS.settings, label: 'Einstellungen',
  submenu: [
    { id: 'design', label: 'Design', url: '/settings/design' }
  ]
}
```

**Root** (currently "System" with only "Kontoeinstellungen"):

```
{ id: 'system', icon: ICONS.settings, label: 'System',
  submenu: [
    { id: 'design', label: 'Design', url: '/settings/design' },
    { id: 'account-settings', label: 'Kontoeinstellungen', url: '/account-settings' }
  ]
}
```

### Step 3: Frontend — New Page `/settings/design`

**Route:** `frontend/src/routes/(app)/(shared)/settings/design/`

**Files to create:**

```
settings/design/
  +page.svelte       ← Main page component
  _lib/
    api.ts           ← API calls (GET/PUT user theme setting)
    types.ts         ← TypeScript interfaces
```

**Page content (minimal v1):**

- Page title: "Design"
- Breadcrumb: Einstellungen > Design
- Single card: "Erscheinungsbild" (Appearance)
- Theme toggle: Reuse existing `ThemeToggle.svelte` component
- Label: "Dunkelmodus" with current state indicator
- Description text: "Wähle zwischen hell und dunkel. Die Einstellung wird auf allen Geräten synchronisiert."

**No other settings on this page yet.** KISS. One toggle, one purpose.

### Step 4: Layout — Trigger API Sync on Load

**File:** `frontend/src/routes/(app)/+layout.svelte` (or `+layout.server.ts`)

Changes:

- On authenticated layout mount: call `loadThemeFromApi()` once
- This ensures DB → localStorage sync on login from new device

---

## File Summary

| File                                           | Change                                        |
| ---------------------------------------------- | --------------------------------------------- |
| `lib/stores/theme.svelte.ts`                   | Add `syncThemeToApi()` + `loadThemeFromApi()` |
| `(app)/_lib/navigation-config.ts`              | "Einstellungen" submenu for all 3 roles       |
| `(app)/(shared)/settings/design/+page.svelte`  | NEW — Design settings page                    |
| `(app)/(shared)/settings/design/_lib/api.ts`   | NEW — API client for theme setting            |
| `(app)/(shared)/settings/design/_lib/types.ts` | NEW — TypeScript types                        |
| `(app)/+layout.svelte`                         | Call `loadThemeFromApi()` on mount            |

**Total: 2 modified files, 3 new files.**

---

## NOT in Scope

- Database migration (table exists)
- Backend changes (API exists)
- Tenant-level theme defaults (future: admin forces default for all users)
- Additional appearance settings (font size, accent color — future)
- `prefers-color-scheme` auto-detection (future: `'auto'` value)

---

## Risk Log

| Risk                                    | Mitigation                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| API call fails on theme change          | localStorage still works. User doesn't notice. Retry on next change.                             |
| Race condition: FOUC script vs API load | FOUC script reads localStorage (sync, before paint). API sync runs after hydration. No conflict. |
| First-time user has no DB setting       | `loadThemeFromApi()` handles 404 → creates initial setting from localStorage                     |
| Logout → localStorage persists          | Intentional. Theme is a device preference too. On next login, DB takes priority.                 |
