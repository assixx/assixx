/**
 * E2E Keys Service
 *
 * Manages X25519 public key registration, lookup, and reset
 * for end-to-end encrypted 1:1 messaging.
 *
 * All tenant-scoped queries use tenantTransaction() for RLS compliance (ADR-019).
 * Fingerprints are computed server-side as SHA-256 hex of the raw public key bytes.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { E2eKeyResponse, E2ePublicKeyResponse, E2eUserKeyRow } from './e2e-keys.types.js';

@Injectable()
export class E2eKeysService {
  private readonly logger = new Logger(E2eKeysService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Register a new public key for the current user.
   * Returns 409 Conflict if an active key already exists (multi-tab race protection).
   */
  async registerKeys(publicKey: string, tenantId: number, userId: number): Promise<E2eKeyResponse> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<E2eKeyResponse> => {
      // Check if an active key already exists
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM e2e_user_keys
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [tenantId, userId],
      );

      if (existing.rows[0] !== undefined) {
        throw new ConflictException(
          'Active E2E key already exists. Use GET /e2e/keys/me to retrieve it.',
        );
      }

      const id = uuidv7();
      const fingerprint = this.computeFingerprint(publicKey);

      const result = await client.query<E2eUserKeyRow>(
        `INSERT INTO e2e_user_keys (id, tenant_id, user_id, public_key, fingerprint, key_version, is_active)
           VALUES ($1, $2, $3, $4, $5, 1, 1)
           RETURNING id, public_key, fingerprint, key_version, created_at`,
        [id, tenantId, userId, publicKey, fingerprint],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Failed to insert E2E key — RETURNING yielded no rows');
      }

      this.logger.log(
        `Registered E2E key for user ${userId} in tenant ${tenantId} (fingerprint: ${fingerprint.slice(0, 16)}...)`,
      );

      return {
        id: row.id,
        publicKey: row.public_key,
        fingerprint: row.fingerprint,
        keyVersion: row.key_version,
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  /**
   * Get the current user's own active key data.
   * Returns null if no active key exists.
   */
  async getOwnKeys(tenantId: number, userId: number): Promise<E2eKeyResponse | null> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<E2eKeyResponse | null> => {
        const result = await client.query<E2eUserKeyRow>(
          `SELECT id, public_key, fingerprint, key_version, created_at
           FROM e2e_user_keys
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
          [tenantId, userId],
        );

        const row = result.rows[0];
        if (row === undefined) {
          return null;
        }

        return {
          id: row.id,
          publicKey: row.public_key,
          fingerprint: row.fingerprint,
          keyVersion: row.key_version,
          createdAt: row.created_at.toISOString(),
        };
      },
    );
  }

  /**
   * Get another user's public key (for encryption).
   * Returns null if the user has no active key.
   */
  async getPublicKey(tenantId: number, userId: number): Promise<E2ePublicKeyResponse | null> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<E2ePublicKeyResponse | null> => {
        const result = await client.query<E2eUserKeyRow>(
          `SELECT public_key, fingerprint, key_version
           FROM e2e_user_keys
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
          [tenantId, userId],
        );

        const row = result.rows[0];
        if (row === undefined) {
          return null;
        }

        return {
          publicKey: row.public_key,
          fingerprint: row.fingerprint,
          keyVersion: row.key_version,
        };
      },
    );
  }

  /**
   * Check if a user has an active E2E key.
   */
  async hasKeys(tenantId: number, userId: number): Promise<boolean> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<boolean> => {
      const result = await client.query<{ exists: boolean }>(
        `SELECT EXISTS(
             SELECT 1 FROM e2e_user_keys
             WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
           ) AS exists`,
        [tenantId, userId],
      );

      return result.rows[0]?.exists ?? false;
    });
  }

  /**
   * Validate that a claimed key version matches the server's record.
   * Used before accepting encrypted messages to prevent decryption failures.
   */
  async validateKeyVersion(
    tenantId: number,
    userId: number,
    claimedVersion: number,
  ): Promise<boolean> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<boolean> => {
      const result = await client.query<{ key_version: number }>(
        `SELECT key_version FROM e2e_user_keys
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [tenantId, userId],
      );

      const row = result.rows[0];
      if (row === undefined) {
        return false;
      }

      return row.key_version === claimedVersion;
    });
  }

  /**
   * Rotate the current user's key: deactivate old key (is_active=0) and register the new one.
   * Used when client detects a key mismatch (e.g., container browser cleared IndexedDB).
   * Atomic: both operations happen in a single transaction.
   */
  async rotateOwnKey(publicKey: string, tenantId: number, userId: number): Promise<E2eKeyResponse> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<E2eKeyResponse> => {
      // Deactivate any existing active key
      await client.query(
        `UPDATE e2e_user_keys
           SET is_active = ${IS_ACTIVE.INACTIVE}
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [tenantId, userId],
      );

      const id = uuidv7();
      const fingerprint = this.computeFingerprint(publicKey);
      const nextVersion = await this.getNextKeyVersion(client, tenantId, userId);

      const result = await client.query<E2eUserKeyRow>(
        `INSERT INTO e2e_user_keys (id, tenant_id, user_id, public_key, fingerprint, key_version, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, 1)
           RETURNING id, public_key, fingerprint, key_version, created_at`,
        [id, tenantId, userId, publicKey, fingerprint, nextVersion],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Failed to insert rotated E2E key — RETURNING yielded no rows');
      }

      this.logger.warn(
        `User ${userId} rotated E2E key in tenant ${tenantId} (v${nextVersion}, fingerprint: ${fingerprint.slice(0, 16)}...)`,
      );

      return {
        id: row.id,
        publicKey: row.public_key,
        fingerprint: row.fingerprint,
        keyVersion: row.key_version,
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  /**
   * Admin-only: Reset a user's key by marking the active key row as deleted
   * (is_active=4) AND cascading the deletion to the escrow blob in the same
   * transaction.
   *
   * Why the cascade is mandatory (ADR-022 §Motivation, 2026-04-23 incident):
   * the escrow blob encrypts the private key that pairs with the revoked
   * public key. Leaving the escrow active after reset produces an "orphan"
   * blob that still resolves to the revoked private key. Any subsequent
   * login with the user's password would successfully recover that private
   * key from escrow — but the public half is gone from the server, so the
   * recovered device's fingerprint no longer matches the (freshly registered)
   * server key on other devices. This silently reintroduces the exact
   * multi-device divergence class of bug that the admin reset is supposed
   * to cure (symptom: "delete key in DB, error comes back on next load").
   *
   * Atomic via single tenantTransaction — if either UPDATE fails the whole
   * reset aborts; no half-reset state can be observed.
   *
   * User must regenerate keys on next login. Old escrow blob is no longer
   * recoverable (is_active=4), forcing a clean re-seed.
   */
  async resetKeys(tenantId: number, userId: number, adminId: number): Promise<void> {
    await this.db.tenantTransaction(async (client: PoolClient): Promise<void> => {
      const keyResult = await client.query(
        `UPDATE e2e_user_keys
           SET is_active = ${IS_ACTIVE.DELETED}
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [tenantId, userId],
      );

      if (keyResult.rowCount === 0) {
        throw new NotFoundException(`No active E2E key found for user ${userId}`);
      }

      // Cascade to escrow blob — orphan escrow = silent divergence (see JSDoc).
      const escrowResult = await client.query(
        `UPDATE e2e_key_escrow
           SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
        [tenantId, userId],
      );

      const escrowCascaded = escrowResult.rowCount ?? 0;
      this.logger.warn(
        `Admin ${adminId} reset E2E key for user ${userId} in tenant ${tenantId} ` +
          `(escrow cascaded: ${escrowCascaded} row${escrowCascaded === 1 ? '' : 's'})`,
      );
    });
  }

  /**
   * Get the next key_version for a user (max existing + 1, or 1 if none).
   */
  private async getNextKeyVersion(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<number> {
    const result = await client.query<{ max_version: number | null }>(
      `SELECT MAX(key_version) AS max_version FROM e2e_user_keys
       WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId],
    );
    return (result.rows[0]?.max_version ?? 0) + 1;
  }

  /**
   * Compute SHA-256 hex fingerprint of a base64-encoded public key.
   * Deterministic: same key always produces the same fingerprint.
   */
  private computeFingerprint(publicKeyBase64: string): string {
    const keyBytes = Buffer.from(publicKeyBase64, 'base64');
    return createHash('sha256').update(keyBytes).digest('hex');
  }
}
