/**
 * Public Key Cache
 *
 * In-memory cache for other users' E2E public keys.
 * Avoids redundant API calls when encrypting/decrypting messages
 * for users we've already looked up in this session.
 *
 * Cache is cleared on page reload (intentional — forces fresh lookup).
 *
 * @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 7.4)
 */
import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('PublicKeyCache');

interface CachedPublicKey {
  publicKey: string;
  fingerprint: string;
  keyVersion: number;
}

/** userId → public key data */
const cache = new Map<number, CachedPublicKey>();

/** userId → in-flight fetch promise (prevents thundering herd) */
const inflight = new Map<number, Promise<CachedPublicKey | null>>();

/**
 * Get a user's public key (cached, or fetch from API).
 * Returns null if the user has no active E2E key.
 * Deduplicates concurrent requests for the same userId (thundering herd protection).
 */
export async function getPublicKey(
  userId: number,
): Promise<CachedPublicKey | null> {
  const cached = cache.get(userId);
  if (cached !== undefined) {
    log.debug({ userId }, 'Public key cache HIT');
    return cached;
  }

  // Deduplicate: if a fetch for this userId is already in-flight, wait for it
  const existing = inflight.get(userId);
  if (existing !== undefined) {
    log.debug({ userId }, 'Public key cache MISS — joining in-flight request');
    return await existing;
  }

  log.info({ userId }, 'Public key cache MISS — fetching from API');
  const fetchPromise = fetchAndCachePublicKey(userId);
  inflight.set(userId, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inflight.delete(userId);
  }
}

/** Fetch a user's public key from the API and cache it */
async function fetchAndCachePublicKey(
  userId: number,
): Promise<CachedPublicKey | null> {
  const apiClient = getApiClient();

  // apiClient.get() already unwraps { success, data } → returns data directly (ADR-007)
  const keyData = await apiClient.get<CachedPublicKey | null>(
    `/e2e/keys/${userId}`,
  );

  if (keyData === null) {
    log.warn({ userId }, 'API returned NULL — user has no E2E key on server');
    return null;
  }

  log.info(
    {
      userId,
      keyVersion: keyData.keyVersion,
      fingerprint: keyData.fingerprint.substring(0, 16) + '…',
    },
    'Public key fetched and cached',
  );
  cache.set(userId, keyData);
  return keyData;
}

/** Clear all cached keys (e.g., on logout) */
export function clearPublicKeyCache(): void {
  cache.clear();
}

/** Remove a specific user's cached key (e.g., after key reset notification) */
export function invalidatePublicKey(userId: number): void {
  cache.delete(userId);
}
