/**
 * Tenant Domains — Server-Side Data Loading
 *
 * Root-only: RBAC enforced by the `(root)` route group layout (ADR-012).
 * SSR-loads `GET /api/v2/domains` so the page renders with the list already
 * populated — no client-side initial fetch flash.
 *
 * On API failure (network, 5xx) `apiFetch` returns null. We surface that as
 * `loadError: true` + an empty list rather than throwing — the page can
 * render the "Add domain" CTA even when the load fails, and the user can
 * retry by re-clicking the menu link.
 *
 * @see masterplan §5.1
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { TenantDomain } from './_lib/types.js';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const domains = await apiFetch<TenantDomain[]>('/domains', token, fetch);

  return {
    domains: domains ?? [],
    loadError: domains === null,
  };
};
