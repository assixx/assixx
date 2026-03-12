/**
 * KVP Categories Admin - Server-Side Data Loading
 *
 * SSR: Loads customizable categories for admin view.
 * Route group: (admin) - requires admin/root role (enforced by layout).
 */
import { redirect } from '@sveltejs/kit';

import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { CustomizableCategoriesData } from './_lib/types';

const log = createLogger('KvpCategoriesPage');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

interface CategoryResult {
  categories: CustomizableCategoriesData | null;
  error: string | null;
}

/** Fetch customizable categories from backend API */
async function fetchCategories(
  fetchFn: typeof fetch,
  token: string,
): Promise<CategoryResult> {
  try {
    const response = await fetchFn(`${API_BASE}/kvp/categories/customizable`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'API error loading categories');
      return { categories: null, error: 'Fehler beim Laden der Kategorien' };
    }

    const json =
      (await response.json()) as ApiResponse<CustomizableCategoriesData>;
    const data =
      json.success === true && json.data !== undefined ?
        json.data
      : (json as unknown as CustomizableCategoriesData);

    return { categories: data, error: null };
  } catch (err: unknown) {
    log.error({ err }, 'Fetch error');
    return {
      categories: null,
      error: 'Netzwerkfehler beim Laden der Kategorien',
    };
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Permission: root always, admin needs has_full_access
  const { user, activeAddons } = await parent();
  requireAddon(activeAddons, 'kvp');
  if (user !== null && user.role !== 'root' && !user.hasFullAccess) {
    log.warn(
      { role: user.role },
      'RBAC: Admin without has_full_access denied access to KVP categories',
    );
    redirect(302, '/permission-denied');
  }

  return await fetchCategories(fetch, token);
};
