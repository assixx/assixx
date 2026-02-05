/**
 * Mock for SvelteKit's $app/environment module.
 * Used by frontend-unit test project via resolve alias.
 *
 * browser: false → SSR mode (no DOMPurify, no browser-only APIs)
 * window/localStorage mocked separately in vitest.frontend-setup.ts
 */
export const browser = false;
export const building = false;
export const dev = true;
export const version = 'test';
