/**
 * E2E Key Escrow Service
 *
 * Manages zero-knowledge encrypted private key backup for key recovery.
 * The server stores only an encrypted blob — it cannot decrypt it.
 *
 * All tenant-scoped queries use tenantTransaction() for RLS compliance (ADR-019).
 *
 * @see ADR-022 (E2E Key Escrow)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { Argon2Params, E2eEscrowResponse, E2eEscrowRow } from './e2e-escrow.types.js';

@Injectable()
export class E2eEscrowService {
  private readonly logger = new Logger(E2eEscrowService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Store a new escrow blob for the current user.
   * Returns 409 Conflict if an active escrow already exists.
   */
  async storeEscrow(
    tenantId: number,
    userId: number,
    encryptedBlob: string,
    argon2Salt: string,
    xchachaNonce: string,
    argon2Params: Argon2Params,
  ): Promise<E2eEscrowResponse> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<E2eEscrowResponse> => {
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM e2e_key_escrow
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
          [tenantId, userId],
        );

        if (existing.rows[0] !== undefined) {
          throw new ConflictException(
            'Active escrow already exists. Use PUT /e2e/escrow to update.',
          );
        }

        const id = uuidv7();
        const result = await client.query<E2eEscrowRow>(
          `INSERT INTO e2e_key_escrow
             (id, tenant_id, user_id, encrypted_blob, argon2_salt, xchacha_nonce, argon2_params, blob_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
           RETURNING encrypted_blob, argon2_salt, xchacha_nonce, argon2_params, blob_version`,
          [
            id,
            tenantId,
            userId,
            encryptedBlob,
            argon2Salt,
            xchachaNonce,
            JSON.stringify(argon2Params),
          ],
        );

        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('Failed to insert escrow — RETURNING yielded no rows');
        }

        this.logger.log(`Stored E2E escrow for user ${userId} in tenant ${tenantId}`);

        return this.mapRowToResponse(row);
      },
    );
  }

  /**
   * Retrieve the escrow blob for recovery.
   * Returns null if no active escrow exists.
   */
  async getEscrow(tenantId: number, userId: number): Promise<E2eEscrowResponse | null> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<E2eEscrowResponse | null> => {
        const result = await client.query<E2eEscrowRow>(
          `SELECT encrypted_blob, argon2_salt, xchacha_nonce, argon2_params, blob_version
           FROM e2e_key_escrow
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
          [tenantId, userId],
        );

        const row = result.rows[0];
        if (row === undefined) {
          return null;
        }

        return this.mapRowToResponse(row);
      },
    );
  }

  /**
   * Update the escrow blob (re-encrypt after password change).
   * Increments blob_version and updates the timestamp.
   * Returns null if no active escrow exists (nothing to update).
   */
  async updateEscrow(
    tenantId: number,
    userId: number,
    encryptedBlob: string,
    argon2Salt: string,
    xchachaNonce: string,
    argon2Params: Argon2Params,
  ): Promise<E2eEscrowResponse | null> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<E2eEscrowResponse | null> => {
        const result = await client.query<E2eEscrowRow>(
          `UPDATE e2e_key_escrow
           SET encrypted_blob = $3,
               argon2_salt = $4,
               xchacha_nonce = $5,
               argon2_params = $6,
               blob_version = blob_version + 1,
               updated_at = NOW()
           WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
           RETURNING encrypted_blob, argon2_salt, xchacha_nonce, argon2_params, blob_version`,
          [tenantId, userId, encryptedBlob, argon2Salt, xchachaNonce, JSON.stringify(argon2Params)],
        );

        const row = result.rows[0];
        if (row === undefined) {
          return null;
        }

        this.logger.log(
          `Updated E2E escrow for user ${userId} in tenant ${tenantId} (v${row.blob_version})`,
        );

        return this.mapRowToResponse(row);
      },
    );
  }

  /** Map a database row to the API response shape */
  private mapRowToResponse(row: E2eEscrowRow): E2eEscrowResponse {
    return {
      encryptedBlob: row.encrypted_blob,
      argon2Salt: row.argon2_salt,
      xchachaNonce: row.xchacha_nonce,
      argon2Params: row.argon2_params,
      blobVersion: row.blob_version,
    };
  }
}
