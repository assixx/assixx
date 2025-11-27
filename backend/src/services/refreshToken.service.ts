/**
 * Refresh Token Service
 *
 * Handles refresh token lifecycle with rotation and reuse detection.
 *
 * Security Features:
 * - Token Family tracking (detect stolen tokens via reuse)
 * - SHA-256 hashing (never store raw tokens)
 * - Automatic revocation on reuse detection
 *
 * @see docs/AUTH-TOKEN-REFACTOR-PLAN.md
 */
import crypto from 'crypto';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { execute } from '../utils/db.js';
import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

interface RefreshTokenRow extends RowDataPacket {
  id: number;
  user_id: number;
  tenant_id: number;
  token_hash: string;
  token_family: string;
  expires_at: Date;
  is_revoked: number;
  used_at: Date | null;
  replaced_by_hash: string | null;
  created_at: Date;
  ip_address: string | null;
  user_agent: string | null;
}

interface StoredRefreshToken {
  id: number;
  userId: number;
  tenantId: number;
  tokenHash: string;
  tokenFamily: string;
  expiresAt: Date;
  isRevoked: boolean;
  usedAt: Date | null;
  replacedByHash: string | null;
  createdAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert database row to camelCase object
 */
function rowToToken(row: RefreshTokenRow): StoredRefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    tokenHash: row.token_hash,
    tokenFamily: row.token_family,
    expiresAt: row.expires_at,
    isRevoked: row.is_revoked === 1,
    usedAt: row.used_at,
    replacedByHash: row.replaced_by_hash,
    createdAt: row.created_at,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
  };
}

// ============================================
// Core Functions
// ============================================

/**
 * Hash a token using SHA-256
 *
 * SECURITY: NEVER store raw tokens in the database!
 * Always hash them first.
 *
 * @param token - Raw refresh token
 * @returns SHA-256 hash as hex string (64 characters)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a new token family UUID
 *
 * Token families are used to track token chains for reuse detection.
 * All tokens in a family should be revoked together on suspicious activity.
 *
 * @returns UUID v4 string
 */
export function generateTokenFamily(): string {
  return crypto.randomUUID();
}

/**
 * Store a new refresh token in the database
 *
 * @param tokenHash - SHA-256 hash of the token
 * @param userId - User ID
 * @param tenantId - Tenant ID (for multi-tenant isolation)
 * @param tokenFamily - Token family UUID
 * @param expiresAt - Token expiration date
 * @param ipAddress - Client IP address (optional)
 * @param userAgent - Client user agent (optional)
 */
export async function storeRefreshToken(
  tokenHash: string,
  userId: number,
  tenantId: number,
  tokenFamily: string,
  expiresAt: Date,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await execute(
    `INSERT INTO refresh_tokens
     (token_hash, user_id, tenant_id, token_family, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tokenHash, userId, tenantId, tokenFamily, expiresAt, ipAddress ?? null, userAgent ?? null],
  );

  logger.debug(`[RefreshToken] Stored new token for user ${userId} in family ${tokenFamily}`);
}

/**
 * Find a valid refresh token by its hash
 *
 * Returns null if:
 * - Token not found
 * - Token is revoked
 * - Token is expired
 *
 * @param tokenHash - SHA-256 hash of the token
 * @returns Token data or null
 */
export async function findValidRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
  const [rows] = await execute<RefreshTokenRow[]>(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = ?
     AND is_revoked = 0
     AND expires_at > NOW()`,
    [tokenHash],
  );

  const row = rows[0];

  if (row === undefined) {
    return null;
  }

  return rowToToken(row);
}

/**
 * Check if a token was already used for refresh
 *
 * REUSE DETECTION: If a token is used twice, it means either:
 * 1. The token was stolen and both parties are using it
 * 2. A replay attack is happening
 *
 * In both cases, the entire token family should be revoked.
 *
 * @param tokenHash - SHA-256 hash of the token
 * @returns true if token was already used
 */
export async function isTokenAlreadyUsed(tokenHash: string): Promise<boolean> {
  const [rows] = await execute<RefreshTokenRow[]>(
    `SELECT used_at FROM refresh_tokens WHERE token_hash = ?`,
    [tokenHash],
  );

  const token = rows[0];
  // eslint-disable-next-line security/detect-possible-timing-attacks -- False positive: checking array bounds (undefined), not comparing secret values. Token hash comparison happens in SQL WHERE clause.
  if (token === undefined) {
    // Token not found = not used (but also invalid)
    return false;
  }

  return token.used_at !== null;
}

/**
 * Mark a token as used and link to its replacement
 *
 * Called after successful token rotation.
 *
 * @param tokenHash - Hash of the token being retired
 * @param replacementHash - Hash of the new token
 */
export async function markTokenAsUsed(tokenHash: string, replacementHash: string): Promise<void> {
  await execute(
    `UPDATE refresh_tokens
     SET used_at = NOW(), replaced_by_hash = ?
     WHERE token_hash = ?`,
    [replacementHash, tokenHash],
  );

  logger.debug(
    `[RefreshToken] Marked token as used, replaced by ${replacementHash.slice(0, 8)}...`,
  );
}

/**
 * Revoke ALL tokens in a family
 *
 * SECURITY: Called when reuse is detected.
 * This invalidates the entire token chain, forcing re-login.
 *
 * @param tokenFamily - Token family UUID
 * @returns Number of tokens revoked
 */
export async function revokeTokenFamily(tokenFamily: string): Promise<number> {
  const [result] = await execute<ResultSetHeader>(
    `UPDATE refresh_tokens
     SET is_revoked = 1
     WHERE token_family = ?`,
    [tokenFamily],
  );

  const count = result.affectedRows;
  logger.warn(`[RefreshToken] SECURITY: Revoked ${count} tokens in family ${tokenFamily}`);
  return count;
}

/**
 * Revoke all tokens for a user
 *
 * Called on:
 * - Logout
 * - Password change
 * - Account security events
 *
 * @param userId - User ID
 * @param tenantId - Tenant ID
 * @returns Number of tokens revoked
 */
export async function revokeAllUserTokens(userId: number, tenantId: number): Promise<number> {
  const [result] = await execute<ResultSetHeader>(
    `UPDATE refresh_tokens
     SET is_revoked = 1
     WHERE user_id = ? AND tenant_id = ?`,
    [userId, tenantId],
  );

  const count = result.affectedRows;
  logger.info(`[RefreshToken] Revoked ${count} tokens for user ${userId}`);
  return count;
}

/**
 * Cleanup expired and revoked tokens
 *
 * Should be called periodically (e.g., daily cron job).
 * Only deletes tokens older than the specified days to maintain audit trail.
 *
 * @param olderThanDays - Only delete tokens created more than X days ago
 * @returns Number of tokens deleted
 */
export async function cleanupExpiredTokens(olderThanDays: number = 30): Promise<number> {
  const [result] = await execute<ResultSetHeader>(
    `DELETE FROM refresh_tokens
     WHERE (expires_at < NOW() OR is_revoked = 1)
     AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [olderThanDays],
  );

  const count = result.affectedRows;
  if (count > 0) {
    logger.info(`[RefreshToken] Cleanup: Deleted ${count} expired/revoked tokens`);
  }
  return count;
}

/**
 * Get token statistics for a user
 *
 * Useful for security dashboards and debugging.
 *
 * @param userId - User ID
 * @param tenantId - Tenant ID
 */
export async function getUserTokenStats(
  userId: number,
  tenantId: number,
): Promise<{
  total: number;
  active: number;
  revoked: number;
  expired: number;
}> {
  const [rows] = await execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN is_revoked = 0 AND expires_at > NOW() THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN is_revoked = 1 THEN 1 ELSE 0 END) as revoked,
       SUM(CASE WHEN expires_at <= NOW() AND is_revoked = 0 THEN 1 ELSE 0 END) as expired
     FROM refresh_tokens
     WHERE user_id = ? AND tenant_id = ?`,
    [userId, tenantId],
  );

  const stats = rows[0] ?? { total: 0, active: 0, revoked: 0, expired: 0 };
  return {
    total: Number(stats.total),
    active: Number(stats.active),
    revoked: Number(stats.revoked),
    expired: Number(stats.expired),
  };
}
