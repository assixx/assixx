/**
 * Shared Permission Data Loader
 * @module lib/server/load-permission-data
 *
 * Loads user data and permission tree from backend API.
 * Used by manage-employees and manage-admins permission pages.
 * Root users are excluded — they always have full access (DB trigger enforced).
 */
import { redirect } from '@sveltejs/kit';

import { API_BASE } from '$lib/server/api-fetch';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('PermissionDataLoader');

interface UserData {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface UserApiResponse {
  success: boolean;
  data: UserData;
}

interface PermissionModule {
  code: string;
  label: string;
  icon: string;
  allowedPermissions: ('canRead' | 'canWrite' | 'canDelete')[];
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

interface PermissionCategory {
  code: string;
  label: string;
  icon: string;
  modules: PermissionModule[];
}

interface PermissionsApiResponse {
  success: boolean;
  data: PermissionCategory[];
}

interface PermissionPageData {
  employee: {
    id: number;
    uuid: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  permissions: PermissionCategory[];
  error: string | null;
}

interface LoadParams {
  cookies: { get: (name: string) => string | undefined };
  fetch: typeof globalThis.fetch;
  params: { uuid: string };
}

/**
 * Load user data and permission tree for the permission settings page.
 * Shared across manage-employees and manage-admins routes.
 */
export async function loadPermissionData({
  cookies,
  fetch,
  params,
}: LoadParams): Promise<PermissionPageData> {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const { uuid } = params;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    // Fetch user data and permissions in parallel
    const [userResponse, permResponse] = await Promise.all([
      fetch(`${API_BASE}/users/uuid/${uuid}`, { headers }),
      fetch(`${API_BASE}/user-permissions/${uuid}`, { headers }),
    ]);

    if (!userResponse.ok) {
      log.error(
        { status: userResponse.status },
        'Failed to fetch user data for permission page',
      );
      return {
        employee: null,
        permissions: [],
        error: 'Fehler beim Laden der Benutzerdaten',
      };
    }

    const userJson = (await userResponse.json()) as UserApiResponse;

    // Permissions: graceful fallback if endpoint fails
    let permissions: PermissionCategory[] = [];
    if (permResponse.ok) {
      const permJson = (await permResponse.json()) as PermissionsApiResponse;
      permissions = permJson.data;
    } else {
      log.error(
        { status: permResponse.status },
        'Failed to fetch permissions — using empty defaults',
      );
    }

    return {
      employee: {
        id: userJson.data.id,
        uuid: userJson.data.uuid,
        firstName: userJson.data.firstName,
        lastName: userJson.data.lastName,
        email: userJson.data.email,
      },
      permissions,
      error: null,
    };
  } catch (err: unknown) {
    log.error({ err }, 'Error fetching data for permission page');
    return {
      employee: null,
      permissions: [],
      error: 'Verbindungsfehler',
    };
  }
}
