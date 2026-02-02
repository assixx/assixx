/**
 * Theme Store - Svelte 5 Runes
 *
 * Manages light/dark theme state.
 * Toggles .dark class on <html> and persists choice to localStorage.
 *
 * Architecture:
 * - <html class="dark"> is the DEFAULT (set in app.html)
 * - FOUC prevention script in app.html reads localStorage before paint
 * - This store syncs the runtime state with the DOM class
 */
import { browser } from '$app/environment';

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

/** Set theme explicitly */
export function setTheme(theme: 'dark' | 'light'): void {
  currentTheme = theme;

  if (!browser) return;

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  localStorage.setItem(STORAGE_KEY, theme);
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
 */
export function restoreUserTheme(): void {
  if (!browser) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  setTheme(saved === 'light' ? 'light' : 'dark');
}
