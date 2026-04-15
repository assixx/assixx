/**
 * Blackboard Detail - Server-Side Data Loading
 * @module blackboard/[uuid]/+page.server
 *
 * SSR: Loads full entry with comments and attachments.
 */
import { redirect, error } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { BlackboardMyPermissions } from '../_lib/types';
import type { FullEntryResponse, PaginatedComments } from './_lib/types';

const log = createLogger('BlackboardDetail');

/** Fail-closed default when /blackboard/my-permissions fails (ADR-045 Layer 2). */
const DEFAULT_MY_PERMISSIONS: BlackboardMyPermissions = {
  posts: { canRead: false, canWrite: false, canDelete: false },
  comments: { canRead: false, canWrite: false, canDelete: false },
  archive: { canRead: false, canWrite: false },
};

interface ParentUser {
  id: number;
  role: string;
  tenantId: number;
  hasFullAccess?: boolean;
}

/** Inner data shape returned by /blackboard/entries/:uuid/full */
interface FullEntryData {
  entry: FullEntryResponse['data']['entry'];
  comments?: PaginatedComments;
  attachments?: FullEntryResponse['data']['attachments'];
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

export const load: PageServerLoad = async ({ cookies, fetch, params, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { uuid } = params;
  if (!uuid) {
    error(400, 'UUID fehlt');
  }

  const [result, myPermissions] = await Promise.all([
    apiFetchWithPermission<FullEntryData>(`/blackboard/entries/${uuid}/full`, token, fetch),
    apiFetch<BlackboardMyPermissions>('/blackboard/my-permissions', token, fetch),
  ]);

  if (result.permissionDenied) {
    const parentData = await parent();
    requireAddon(parentData.activeAddons, 'blackboard');
    return {
      permissionDenied: true as const,
      entry: null,
      comments: { comments: [], total: 0, hasMore: false } as PaginatedComments,
      attachments: [],
      currentUser: null,
      orgScope: parentData.orgScope,
      myPermissions: myPermissions ?? DEFAULT_MY_PERMISSIONS,
    };
  }

  if (result.data === null) {
    log.error({ uuid }, 'Failed to load blackboard entry');
    error(404, 'Eintrag nicht gefunden');
  }

  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'blackboard');

  const defaultComments: PaginatedComments = {
    comments: [],
    total: 0,
    hasMore: false,
  };

  return {
    permissionDenied: false as const,
    entry: result.data.entry,
    comments: result.data.comments ?? defaultComments,
    attachments: result.data.attachments ?? [],
    currentUser: mapCurrentUser(parentData.user as ParentUser | null | undefined),
    orgScope: parentData.orgScope,
    myPermissions: myPermissions ?? DEFAULT_MY_PERMISSIONS,
  };
};
