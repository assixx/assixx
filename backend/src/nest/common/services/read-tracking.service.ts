/**
 * Read Tracking Service — Shared entity read-status tracking
 *
 * Generic UPSERT-based service for per-user read tracking.
 * Used by work orders; designed for reuse by documents, blackboard, KVP.
 *
 * Config defines which table/columns to operate on.
 * SQL injection safe: config values are compile-time constants, not user input.
 *
 * Fire-and-forget safe: DB errors are logged, never thrown (ADR-002).
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service.js';

export interface ReadTrackingConfig {
  /** Read-status table name (e.g. 'work_order_read_status') */
  tableName: string;
  /** FK column pointing to the entity (e.g. 'work_order_id') */
  entityColumn: string;
  /** Entity table name for UUID resolution (e.g. 'work_orders') */
  entityTable: string;
  /** UUID column name in entity table (e.g. 'uuid') */
  entityUuidColumn: string;
}

@Injectable()
export class ReadTrackingService {
  private readonly logger = new Logger(ReadTrackingService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Mark entity as read by user (idempotent UPSERT) */
  async markAsRead(
    config: ReadTrackingConfig,
    entityId: number,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO ${config.tableName} (${config.entityColumn}, user_id, tenant_id, read_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (${config.entityColumn}, user_id, tenant_id)
         DO UPDATE SET read_at = NOW()`,
        [entityId, userId, tenantId],
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to mark as read: ${config.tableName} entity=${String(entityId)} user=${String(userId)}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /** Resolve entity UUID to ID, then mark as read */
  async markAsReadByUuid(
    config: ReadTrackingConfig,
    entityUuid: string,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    const row = await this.db.queryOne<{ id: number }>(
      `SELECT id FROM ${config.entityTable}
       WHERE ${config.entityUuidColumn} = $1 AND tenant_id = $2`,
      [entityUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(
        `Entity not found: ${config.entityTable} uuid=${entityUuid}`,
      );
    }

    await this.markAsRead(config, row.id, userId, tenantId);
  }
}
