/**
 * Theme Store - Svelte 5 Runes
 *
 * Manages light/dark theme state.
 * Toggles .dark class on <html> and persists to localStorage + API.
 *
 * Storage strategy:
 * - localStorage = primary (instant, FOUC prevention, no latency)
 * - user_settings API = persistence (cross-device, cross-browser sync)
 *
 * Architecture:
 * - <html class="dark"> is the DEFAULT (set in app.html)
 * - FOUC prevention script in app.html reads localStorage before paint
 * - This store syncs the runtime state with the DOM class
 * - On theme change: localStorage (sync) + API (fire-and-forget)
 * - On login/mount: API value overrides localStorage (cross-device sync)
 */
import { browser } from '$app/environment';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('ThemeStore');
const STORAGE_KEY = 'theme';

/** Current theme: 'dark' or 'light' */
let currentTheme = $state<'dark' | 'light'>(getInitialTheme());

/** Read initial theme from DOM state (set by FOUC prevention script) */
function getInitialTheme(): 'dark' | 'light' {
  if (!browser) return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Whether dark mode is active */
export function isDark(): boolean {
  return currentTheme === 'dark';
}

/** Get current theme value */
export function getTheme(): 'dark' | 'light' {
  return currentTheme;
}

/** Toggle between dark and light */
export function toggleTheme(): void {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

/**
 * Apply theme to DOM + localStorage without API sync.
 * Used internally to avoid circular sync when loading from API.
 */
function applyTheme(theme: 'dark' | 'light'): void {
  currentTheme = theme;

  if (!browser) return;

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  localStorage.setItem(STORAGE_KEY, theme);
}

/** Set theme explicitly (persists to localStorage + API) */
export function setTheme(theme: 'dark' | 'light'): void {
  applyTheme(theme);
  void syncThemeToApi(theme);
}

/**
 * Force dark mode for always-dark pages (/, /login, /signup).
 * Updates reactive state + DOM class but does NOT persist to localStorage,
 * so the user's actual preference is preserved.
 */
export function forceDark(): void {
  currentTheme = 'dark';

  if (!browser) return;

  document.documentElement.classList.add('dark');
}

/**
 * Restore user's saved theme preference from localStorage.
 * Call when navigating away from an always-dark page.
 * Uses applyTheme (no API sync) to avoid unnecessary writes on navigation.
 */
export function restoreUserTheme(): void {
  if (!browser) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

// =============================================================================
// API SYNC — Persists theme preference to user_settings table (cross-device)
// =============================================================================

/**
 * Save theme preference to API (fire-and-forget).
 * Tries PUT first (update existing), falls back to POST (create new) on failure.
 * Silently catches errors — localStorage is the primary store.
 */
async function syncThemeToApi(theme: 'dark' | 'light'): Promise<void> {
  if (!browser) return;

  try {
    const api = getApiClient();
    await api.put('/settings/user/theme', {
      setting_value: theme,
      value_type: 'string',
      category: 'appearance',
    });
  } catch {
    // PUT failed (setting might not exist yet) — try POST to create
    try {
      const api = getApiClient();
      await api.post('/settings/user', {
        setting_key: 'theme',
        setting_value: theme,
        value_type: 'string',
        category: 'appearance',
      });
    } catch (createErr: unknown) {
      log.warn({ err: createErr }, 'Failed to sync theme to API');
    }
  }
}

/**
 * Load theme preference from API (call once on authenticated layout mount).
 * If DB has a different theme than localStorage, DB wins (cross-device sync).
 * If no DB setting exists, syncs current localStorage value to DB.
 */
export async function loadThemeFromApi(): Promise<void> {
  if (!browser) return;

  try {
    const api = getApiClient();
    const result = await api.get<{ settingValue: string }>(
      '/settings/user/theme',
      { skipCache: true, silent: true },
    );

    const apiTheme = result.settingValue;

    if (apiTheme === 'light' || apiTheme === 'dark') {
      const localTheme = localStorage.getItem(STORAGE_KEY);

      if (apiTheme !== localTheme) {
        // DB wins over localStorage (cross-device sync)
        applyTheme(apiTheme);
      }
    }
  } catch {
    // No DB setting yet — sync current localStorage value as initial
    const localTheme = localStorage.getItem(STORAGE_KEY);
    void syncThemeToApi(localTheme === 'light' ? 'light' : 'dark');
  }
}
