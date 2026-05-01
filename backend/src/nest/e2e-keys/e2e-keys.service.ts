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
import type {
  Argon2Params,
  E2eEscrowResponse,
  E2eEscrowRow,
} from '../e2e-escrow/e2e-escrow.types.js';
import type { E2eKeyResponse, E2ePublicKeyResponse, E2eUserKeyRow } from './e2e-keys.types.js';

/**
 * Combined response for the atomic key+escrow registration endpoint.
 * Returns both rows so the client can update its local state in one
 * round-trip (the alternative — issuing a follow-up GET — re-introduces
 * the race window the atomic endpoint exists to close).
 */
export interface E2eKeyWithEscrowResponse {
  key: E2eKeyResponse;
  escrow: E2eEscrowResponse;
}

/** Escrow envelope payload for atomic registration */
export interface EscrowEnvelopeInput {
  encryptedBlob: string;
  argon2Salt: string;
  xchachaNonce: string;
  argon2Params: Argon2Params;
}

@Injectable()
export class E2eKeysService {
  private readonly logger = new Logger(E2eKeysService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Atomically register a new public key AND store its escrow envelope in
   * a single `tenantTransaction()`.
   *
   * Rationale (ADR-022, post-mortem 2026-05-01):
   * The legacy two-call pattern (`POST /e2e/keys` then `POST /e2e/escrow`)
   * left a race window — if the second call dropped (network blip,
   * transient DB error, browser crashed mid-flow), the user landed in
   * `(key=present, escrow=missing)`. That state is irrecoverable without
   * an admin reset because:
   *   1. Same-origin retries hit `409` on `POST /e2e/keys`.
   *   2. Cross-origin handoffs trip the "Skip" branch in
   *      `escrow-handoff.ts:mintUnlockTicketOrFallback` and the subdomain
   *      fail-closes with `recoveryRequired: true`.
   * Atomicity here closes the window by construction — PostgreSQL either
   * commits both rows or rolls both back. No retry, no compensating action,
   * no half-state ever observable on disk.
   *
   * Conflict semantics: rejects with 409 if EITHER an active key OR an
   * active escrow already exists for this user. Caller is expected to
   * route to retrieval endpoints in those cases.
   *
   * @returns Both the key row and the escrow row so the client updates
   *          local state in one round-trip (a follow-up GET would
   *          reintroduce a small race window for a multi-tab/multi-device
   *          login race).
   */
  async registerKeysWithEscrow(
    publicKey: string,
    escrow: EscrowEnvelopeInput,
    tenantId: number,
    userId: number,
  ): Promise<E2eKeyWithEscrowResponse> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<E2eKeyWithEscrowResponse> => {
        await this.assertNoActiveKeyOrEscrow(client, tenantId, userId);

        const keyRow = await this.insertKeyRow(client, tenantId, userId, publicKey);
        const escrowRow = await this.insertEscrowRow(client, tenantId, userId, escrow);

        this.logger.log(
          `Atomic register: E2E key + escrow for user ${userId} in tenant ${tenantId} ` +
            `(fingerprint: ${keyRow.fingerprint.slice(0, 16)}...)`,
        );

        return {
          key: this.mapKeyRowToResponse(keyRow),
          escrow: this.mapEscrowRowToResponse(escrowRow),
        };
      },
    );
  }

  /** Conflict pre-check: refuse if either an active key OR escrow exists. */
  private async assertNoActiveKeyOrEscrow(
    client: PoolClient,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const existingKey = await client.query<{ id: string }>(
      `SELECT id FROM e2e_user_keys
         WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId, userId],
    );
    if (existingKey.rows[0] !== undefined) {
      throw new ConflictException(
        'Active E2E key already exists. Use GET /e2e/keys/me to retrieve it.',
      );
    }

    const existingEscrow = await client.query<{ id: string }>(
      `SELECT id FROM e2e_key_escrow
         WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId, userId],
    );
    if (existingEscrow.rows[0] !== undefined) {
      throw new ConflictException('Active escrow already exists. Use PUT /e2e/escrow to update.');
    }
  }

  /** Insert key row inside a caller-managed transaction. */
  private async insertKeyRow(
    client: PoolClient,
    tenantId: number,
    userId: number,
    publicKey: string,
  ): Promise<E2eUserKeyRow> {
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
    return row;
  }

  /** Insert escrow row inside a caller-managed transaction. */
  private async insertEscrowRow(
    client: PoolClient,
    tenantId: number,
    userId: number,
    escrow: EscrowEnvelopeInput,
  ): Promise<E2eEscrowRow> {
    const id = uuidv7();
    const result = await client.query<E2eEscrowRow>(
      `INSERT INTO e2e_key_escrow
         (id, tenant_id, user_id, encrypted_blob, argon2_salt, xchacha_nonce, argon2_params, blob_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
         RETURNING id, tenant_id, user_id, encrypted_blob, argon2_salt, xchacha_nonce,
                   argon2_params, blob_version, created_at, updated_at, is_active`,
      [
        id,
        tenantId,
        userId,
        escrow.encryptedBlob,
        escrow.argon2Salt,
        escrow.xchachaNonce,
        JSON.stringify(escrow.argon2Params),
      ],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('Failed to insert E2E escrow — RETURNING yielded no rows');
    }
    return row;
  }

  /** Map key DB row to API response shape. */
  private mapKeyRowToResponse(row: E2eUserKeyRow): E2eKeyResponse {
    return {
      id: row.id,
      publicKey: row.public_key,
      fingerprint: row.fingerprint,
      keyVersion: row.key_version,
      createdAt: row.created_at.toISOString(),
    };
  }

  /** Map escrow DB row to API response shape. */
  private mapEscrowRowToResponse(row: E2eEscrowRow): E2eEscrowResponse {
    return {
      encryptedBlob: row.encrypted_blob,
      argon2Salt: row.argon2_salt,
      xchachaNonce: row.xchacha_nonce,
      argon2Params: row.argon2_params,
      blobVersion: row.blob_version,
    };
  }

  /**
   * Register a new public key for the current user (key-only path).
   * Returns 409 Conflict if an active key already exists (multi-tab race protection).
   *
   * Prefer `registerKeysWithEscrow()` for first-time registration — the
   * two-call sequence (this + `POST /e2e/escrow`) used historically left a
   * race window that produced irrecoverable `(key, no escrow)` state
   * (post-mortem 2026-05-01). This entry point is retained for admin-reset
   * followup paths where the escrow is created on a subsequent same-origin
   * backfill (`tryCreateEscrowIfMissing` on the next login).
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
