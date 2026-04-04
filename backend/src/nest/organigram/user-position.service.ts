/**
 * User Position Service
 *
 * Manages N:M assignments between users and position_catalog entries.
 * Assign is idempotent (ON CONFLICT DO NOTHING on the unique constraint).
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  type UserPositionDetailRow,
  type UserPositionEntry,
  mapUserPositionRowToApi,
} from './position-catalog.types.js';

interface UserWithPositionRow {
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
}

@Injectable()
export class UserPositionService {
  private readonly logger = new Logger(UserPositionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  async getByUser(tenantId: number, userId: number): Promise<UserPositionEntry[]> {
    const rows = await this.db.tenantQuery<UserPositionDetailRow>(
      `SELECT up.*, pc.name AS position_name, pc.role_category
       FROM user_positions up
       INNER JOIN position_catalog pc ON pc.id = up.position_id
       WHERE up.tenant_id = $1 AND up.user_id = $2
         AND pc.is_active = $3
       ORDER BY pc.role_category, pc.sort_order, pc.name`,
      [tenantId, userId, IS_ACTIVE.ACTIVE],
    );

    return rows.map(mapUserPositionRowToApi);
  }

  async getByPosition(tenantId: number, positionId: string): Promise<UserWithPositionRow[]> {
    return await this.db.tenantQuery<UserWithPositionRow>(
      `SELECT u.id AS user_id, u.first_name, u.last_name, u.username
       FROM user_positions up
       INNER JOIN users u ON u.id = up.user_id AND u.is_active = $1
       WHERE up.tenant_id = $2 AND up.position_id = $3
       ORDER BY u.last_name, u.first_name`,
      [IS_ACTIVE.ACTIVE, tenantId, positionId],
    );
  }

  /**
   * Replace all user positions atomically.
   * Runs inside an existing transaction (receives PoolClient).
   * Also syncs users.position VARCHAR for display backward compat.
   */
  async syncPositions(
    client: PoolClient,
    userId: number,
    tenantId: number,
    positionIds: string[],
  ): Promise<void> {
    await client.query('DELETE FROM user_positions WHERE user_id = $1 AND tenant_id = $2', [
      userId,
      tenantId,
    ]);

    for (const positionId of positionIds) {
      await client.query(
        `INSERT INTO user_positions (id, tenant_id, user_id, position_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, user_id, position_id) DO NOTHING`,
        [uuidv7(), tenantId, userId, positionId],
      );
    }

    if (positionIds.length > 0) {
      await client.query(
        `UPDATE users SET position = (
          SELECT pc.name FROM position_catalog pc WHERE pc.id = $1 AND pc.tenant_id = $2
        ) WHERE id = $3 AND tenant_id = $2`,
        [positionIds[0], tenantId, userId],
      );
    } else {
      await client.query('UPDATE users SET position = NULL WHERE id = $1 AND tenant_id = $2', [
        userId,
        tenantId,
      ]);
    }
  }

  async assign(tenantId: number, userId: number, positionId: string): Promise<void> {
    await this.assertPositionExists(tenantId, positionId);

    await this.db.tenantQuery(
      `INSERT INTO user_positions (id, tenant_id, user_id, position_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id, position_id) DO NOTHING`,
      [uuidv7(), tenantId, userId, positionId],
    );

    this.logger.log(`Position ${positionId} assigned to user ${String(userId)}`);

    const actingUserId = this.db.getUserId() ?? 0;
    void this.activityLogger.log({
      tenantId,
      userId: actingUserId,
      action: 'create',
      entityType: 'position_catalog',
      details: `Position zugewiesen: user=${String(userId)}, position=${positionId}`,
    });
  }

  async unassign(tenantId: number, userId: number, positionId: string): Promise<void> {
    const result = await this.db.tenantQuery(
      `DELETE FROM user_positions
       WHERE tenant_id = $1 AND user_id = $2 AND position_id = $3`,
      [tenantId, userId, positionId],
    );

    if (result.length === 0) {
      this.logger.warn(`No assignment found: user=${String(userId)}, position=${positionId}`);
    }

    this.logger.log(`Position ${positionId} unassigned from user ${String(userId)}`);

    const actingUserId = this.db.getUserId() ?? 0;
    void this.activityLogger.log({
      tenantId,
      userId: actingUserId,
      action: 'delete',
      entityType: 'position_catalog',
      details: `Position entfernt: user=${String(userId)}, position=${positionId}`,
    });
  }

  async hasPosition(tenantId: number, userId: number, positionId: string): Promise<boolean> {
    const rows = await this.db.tenantQuery<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM user_positions
        WHERE tenant_id = $1 AND user_id = $2 AND position_id = $3
      ) AS exists`,
      [tenantId, userId, positionId],
    );

    return rows[0]?.exists === true;
  }

  private async assertPositionExists(tenantId: number, positionId: string): Promise<void> {
    const rows = await this.db.tenantQuery<{ id: string }>(
      `SELECT id FROM position_catalog
       WHERE tenant_id = $1 AND id = $2 AND is_active = $3`,
      [tenantId, positionId, IS_ACTIVE.ACTIVE],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Position nicht gefunden');
    }
  }
}
