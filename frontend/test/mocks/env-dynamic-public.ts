/**
 * Mock for SvelteKit's `$env/dynamic/public` module.
 * Used by frontend-unit test project via resolve alias.
 *
 * Empty env → utilities fall back to their hardcoded defaults (e.g.
 * `buildApexUrl` defaults to `https://www.assixx.com` when
 * `PUBLIC_APP_URL` is absent). Tests that want to exercise a specific
 * env value pass `publicAppUrl` explicitly as a function parameter.
 *
 * @see vitest.config.ts — frontend-unit project aliases
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Amendment — Logout → Apex"
 */
export const env: Record<string, string | undefined> = {};
