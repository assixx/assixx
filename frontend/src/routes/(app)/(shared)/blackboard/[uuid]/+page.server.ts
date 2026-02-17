/**
 * Blackboard Detail - Server-Side Data Loading
 * @module blackboard/[uuid]/+page.server
 *
 * SSR: Loads full entry with comments and attachments.
 */
import { redirect, error } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { FullEntryResponse, PaginatedComments } from './_lib/types';

const log = createLogger('BlackboardDetail');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ParentUser {
  id: number;
  role: string;
  tenantId: number;
  hasFullAccess?: boolean;
}

/** Handle API response errors */
function handleApiError(response: Response, uuid: string): never {
  if (response.status === 404) {
    error(404, 'Eintrag nicht gefunden');
  }
  log.error(
    { status: response.status, uuid },
    'API error for blackboard entry',
  );
  error(response.status, 'Fehler beim Laden des Eintrags');
}

/** Map parent user to current user format */
function mapCurrentUser(user: ParentUser | null | undefined) {
  if (user === null || user === undefined) return null;
  return {
    id: user.id,
    role: user.role,
    tenantId: user.tenantId,
    hasFullAccess: user.hasFullAccess ?? false,
  };
}

export const load: PageServerLoad = async ({
  cookies,
  fetch,
  params,
  parent,
}) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { uuid } = params;
  if (!uuid) {
    error(400, 'UUID fehlt');
  }

  const response = await fetch(`${API_BASE}/blackboard/entries/${uuid}/full`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    handleApiError(response, uuid);
  }

  const result = (await response.json()) as FullEntryResponse;

  if (!result.success) {
    error(500, result.error?.message ?? 'Fehler beim Laden des Eintrags');
  }

  const parentData = await parent();
  requireFeature(parentData.activeFeatures, 'blackboard');

  const defaultComments: PaginatedComments = {
    comments: [],
    total: 0,
    hasMore: false,
  };

  return {
    entry: result.data.entry,
    comments: result.data.comments ?? defaultComments,
    attachments: result.data.attachments ?? [],
    currentUser: mapCurrentUser(
      parentData.user as ParentUser | null | undefined,
    ),
  };
};
