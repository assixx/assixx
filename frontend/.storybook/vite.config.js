/**
 * Storybook-specific Vite config.
 *
 * When configDir is frontend/.storybook/, Storybook resolves the
 * "project root" as frontend/ and auto-loads frontend/vite.config.ts.
 * That config includes sveltekit() + sentrySvelteKit() which override
 * Vite's root and break path resolution.
 *
 * This minimal config prevents that — Storybook uses THIS file
 * instead of the SvelteKit one. All Storybook-specific Vite
 * configuration lives in main.js viteFinal().
 */
export default {};
