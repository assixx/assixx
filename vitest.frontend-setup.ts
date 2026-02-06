/**
 * Vitest Setup for frontend-unit tests
 *
 * Provides minimal browser environment mocks (localStorage, window)
 * so auth.ts and other browser-dependent utils can be tested in Node.
 *
 * NOTE: Does NOT install happy-dom or jsdom — lightweight Map-based mock.
 */
import { beforeEach } from 'vitest';

// ============================================================================
// localStorage mock (Map-based, no DOM library needed)
// ============================================================================

const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string): string | null => storage.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
  clear: (): void => {
    storage.clear();
  },
  get length(): number {
    return storage.size;
  },
  key: (index: number): string | null => [...storage.keys()][index] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// ============================================================================
// window mock (makes isBrowser() return true in auth.ts)
// ============================================================================

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    writable: true,
    configurable: true,
  });
}

// ============================================================================
// Clear state between tests
// ============================================================================

beforeEach(() => {
  storage.clear();
});
