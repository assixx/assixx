/**
 * Blackboard Detail - Server-Side Data Loading
 * @module blackboard/[uuid]/+page.server
 *
 * SSR: Loads full entry with comments and attachments.
 */
import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { DetailEntry, Comment, Attachment, FullEntryResponse } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

export const load: PageServerLoad = async ({ cookies, fetch, params, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  const { uuid } = params;
  if (!uuid) {
    error(400, 'UUID fehlt');
  }

  // Fetch full entry with comments and attachments
  const response = await fetch(`${API_BASE}/blackboard/entries/${uuid}/full`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      error(404, 'Eintrag nicht gefunden');
    }
    console.error(`[SSR] API error ${response.status} for blackboard entry ${uuid}`);
    error(response.status, 'Fehler beim Laden des Eintrags');
  }

  const result: FullEntryResponse = await response.json();

  if (!result.success) {
    error(500, result.error?.message ?? 'Fehler beim Laden des Eintrags');
  }

  // Get user from parent layout (already loaded there)
  const parentData = await parent();

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] blackboard/${uuid} loaded in ${duration}ms`);

  return {
    entry: result.data.entry as DetailEntry,
    comments: (result.data.comments ?? []) as Comment[],
    attachments: (result.data.attachments ?? []) as Attachment[],
    currentUser: parentData.user
      ? {
          id: parentData.user.id,
          role: parentData.user.role,
          tenantId: parentData.user.tenantId,
        }
      : null,
  };
};
