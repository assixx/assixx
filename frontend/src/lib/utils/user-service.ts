/**
 * Shared User Service
 * 1:1 like Legacy auth/index.ts pattern
 *
 * WHY: Prevents duplicate /users/me API calls across Layout and Pages
 * Uses: Cache + Promise Deduplication
 */

import { getApiClient } from './api-client';

// =============================================================================
// TYPES
// =============================================================================

/**
 * User data from /users/me API
 */
export interface CurrentUser {
  id: number;
  uuid: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  employeeNumber?: string;
  profilePicture?: string;
  position?: string;
  hasFullAccess?: boolean;
  // Feature access
  teamId?: number;
  departmentId?: number;
  areaId?: number;
}

/**
 * Tenant data from /users/me API
 * NOTE: API returns `name`, Layout expects `companyName` - we map it
 */
export interface CurrentTenant {
  id?: number;
  name?: string;
  companyName?: string; // Alias for Layout compatibility
  subdomain?: string;
}

/**
 * Combined response from /users/me
 */
export interface UserMeResponse {
  data?: CurrentUser;
  tenant?: CurrentTenant;
  // Direct fields (fallback)
  id?: number;
  uuid?: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role?: 'root' | 'admin' | 'employee';
}

// =============================================================================
// USER CACHE (1:1 like Legacy auth/index.ts)
// =============================================================================

/** User cache to prevent duplicate API calls */
const userCache: {
  data: CurrentUser | null;
  tenant: CurrentTenant | null;
  timestamp: number;
  promise: Promise<{ user: CurrentUser | null; tenant: CurrentTenant | null }> | null;
} = {
  data: null,
  tenant: null,
  timestamp: 0,
  promise: null,
};

/** Cache validity: 300 seconds (like Legacy) */
const USER_CACHE_TTL = 300 * 1000;

/** Check if user cache is still valid */
function isUserCacheValid(): boolean {
  return Date.now() - userCache.timestamp < USER_CACHE_TTL && userCache.data !== null;
}

/**
 * Clear user cache
 * Call this on logout or when user data changes
 */
export function clearUserCache(): void {
  userCache.data = null;
  userCache.tenant = null;
  userCache.timestamp = 0;
  userCache.promise = null;
}

// =============================================================================
// FETCH CURRENT USER (with caching + promise deduplication)
// =============================================================================

/**
 * Fetch current user data with caching
 * OPTIMIZATION: Uses cache and promise deduplication to prevent duplicate API calls
 * (1:1 like Legacy auth/index.ts pattern)
 *
 * @returns Current user and tenant data
 */
export async function fetchCurrentUser(): Promise<{
  user: CurrentUser | null;
  tenant: CurrentTenant | null;
}> {
  // 1. Return cached data if valid
  if (isUserCacheValid()) {
    console.info('[USER SERVICE] User data loaded from cache:', userCache.data?.username);
    return { user: userCache.data, tenant: userCache.tenant };
  }

  // 2. If a request is already in flight, wait for it (promise deduplication)
  if (userCache.promise !== null) {
    console.info('[USER SERVICE] Waiting for existing user request...');
    return await userCache.promise;
  }

  // 3. Make new request
  console.info('[USER SERVICE] Fetching user data...');
  const apiClient = getApiClient();

  const promise = (async () => {
    try {
      const result = await apiClient.get<UserMeResponse>('/users/me');

      // Extract user data (handle both response formats)
      const user: CurrentUser | null = result.data ?? (result as unknown as CurrentUser);

      // Extract tenant and map `name` to `companyName` for Layout compatibility
      const rawTenant = result.tenant ?? null;
      const tenant: CurrentTenant | null =
        rawTenant !== null ? { ...rawTenant, companyName: rawTenant.name } : null;

      console.info('[USER SERVICE] User data loaded:', user?.username);

      // Update cache
      userCache.data = user;
      userCache.tenant = tenant;
      userCache.timestamp = Date.now();

      return { user, tenant };
    } catch (err) {
      console.error('[USER SERVICE] Error fetching user:', err);
      return { user: null, tenant: null };
    } finally {
      userCache.promise = null;
    }
  })();

  userCache.promise = promise;
  return await promise;
}

/**
 * Get cached user (synchronous)
 * Returns null if not cached or cache expired
 */
export function getCachedUser(): CurrentUser | null {
  if (isUserCacheValid()) {
    return userCache.data;
  }
  return null;
}

/**
 * Get cached tenant (synchronous)
 * Returns null if not cached or cache expired
 */
export function getCachedTenant(): CurrentTenant | null {
  if (isUserCacheValid()) {
    return userCache.tenant;
  }
  return null;
}
