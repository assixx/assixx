/**
 * Blackboard Confirmations Service
 *
 * Handles read confirmations for blackboard entries.
 * Tracks which users have confirmed reading entries.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { dbToApi } from '../../utils/fieldMapper.js';
import { DatabaseService } from '../database/database.service.js';
import { ERROR_ENTRY_NOT_FOUND } from './blackboard.constants.js';
import type { DbConfirmationUser } from './blackboard.types.js';

@Injectable()
export class BlackboardConfirmationsService {
  private readonly logger = new Logger(BlackboardConfirmationsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Confirm reading a blackboard entry.
   * Uses UPSERT: first_seen_at is set only on first confirmation (never reset).
   */
  async confirmEntry(
    id: number | string,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Confirming entry ${String(id)} for user ${userId}`);

    // SECURITY: Get user's tenant - only for ACTIVE users (is_active = 1)
    const users = await this.db.query<{ tenant_id: number }>(
      'SELECT tenant_id FROM users WHERE id = $1 AND is_active = 1',
      [userId],
    );
    if (users[0] === undefined) {
      throw new BadRequestException('User not found or inactive');
    }
    const tenantId = users[0].tenant_id;

    // Get numeric entry ID
    const numericId = await this.resolveEntryId(id, tenantId);

    // UPSERT: Insert if not exists, otherwise update is_confirmed
    // first_seen_at is only set on INSERT (never reset on re-confirm)
    await this.db.query(
      `INSERT INTO blackboard_confirmations
         (tenant_id, entry_id, user_id, confirmed_at, first_seen_at, is_confirmed)
       VALUES ($1, $2, $3, NOW(), NOW(), true)
       ON CONFLICT (entry_id, user_id, tenant_id)
       DO UPDATE SET is_confirmed = true, confirmed_at = NOW()`,
      [tenantId, numericId, userId],
    );

    return { message: 'Entry confirmed successfully' };
  }

  /**
   * Remove confirmation (mark as unread).
   * Sets is_confirmed = false instead of deleting to preserve first_seen_at.
   */
  async unconfirmEntry(
    id: number | string,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Unconfirming entry ${String(id)} for user ${userId}`);

    // SECURITY: Get user's tenant - only for ACTIVE users (is_active = 1)
    const users = await this.db.query<{ tenant_id: number }>(
      'SELECT tenant_id FROM users WHERE id = $1 AND is_active = 1',
      [userId],
    );
    if (users[0] === undefined) {
      throw new BadRequestException('User not found or inactive');
    }
    const tenantId = users[0].tenant_id;

    // Get numeric entry ID
    const numericId = await this.resolveEntryId(id, tenantId);

    // Set is_confirmed = false (preserve first_seen_at for "Neu" badge logic)
    await this.db.query(
      `UPDATE blackboard_confirmations
       SET is_confirmed = false, confirmed_at = NULL
       WHERE entry_id = $1 AND user_id = $2`,
      [numericId, userId],
    );

    return { message: 'Entry marked as unread successfully' };
  }

  /**
   * Get confirmation status for an entry.
   * Returns list of users with their confirmation status.
   */
  async getConfirmationStatus(
    id: number | string,
    tenantId: number,
  ): Promise<Record<string, unknown>[]> {
    this.logger.debug(`Getting confirmation status for entry ${String(id)}`);

    // Get entry info
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const entries = await this.db.query<{
      id: number;
      org_level: string;
      org_id: number;
    }>(
      `SELECT id, org_level, org_id FROM blackboard_entries WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (entries[0] === undefined) {
      return [];
    }
    const entry = entries[0];
    const numericId = entry.id;

    let usersQuery = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name,
             CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as confirmed,
             c.confirmed_at
      FROM users u
      LEFT JOIN blackboard_confirmations c ON u.id = c.user_id AND c.entry_id = $1
      WHERE u.tenant_id = $2
    `;
    const queryParams: unknown[] = [numericId, tenantId];

    if (entry.org_level === 'department') {
      usersQuery += ` AND u.id IN (SELECT ud.user_id FROM user_departments ud WHERE ud.department_id = $3 AND ud.tenant_id = u.tenant_id)`;
      queryParams.push(entry.org_id);
    } else if (entry.org_level === 'team') {
      usersQuery += ` AND u.id IN (SELECT ut.user_id FROM user_teams ut WHERE ut.team_id = $3 AND ut.tenant_id = u.tenant_id)`;
      queryParams.push(entry.org_id);
    }

    const users = await this.db.query<DbConfirmationUser>(
      usersQuery,
      queryParams,
    );
    return users.map((user: DbConfirmationUser) =>
      dbToApi(user as unknown as Record<string, unknown>),
    );
  }

  /**
   * Get count of unconfirmed entries for a user.
   * Used for notification badge in sidebar.
   */
  async getUnconfirmedCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    // Get user info for visibility filtering
    const users = await this.db.query<{
      role: string;
      department_id: number | null;
      team_id: number | null;
    }>(
      `SELECT u.role, ud.department_id, ut.team_id
       FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
       LEFT JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [userId, tenantId],
    );

    if (users[0] === undefined) {
      return { count: 0 };
    }

    const { role, department_id: departmentId, team_id: teamId } = users[0];

    // Count active entries visible to user that they haven't confirmed
    // is_active = 1 means active
    let query = `
      SELECT COUNT(DISTINCT e.id) as count
      FROM blackboard_entries e
      LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = $1
      WHERE e.tenant_id = $2
        AND e.is_active = 1
        AND c.id IS NULL
    `;
    const params: unknown[] = [userId, tenantId];

    // Apply visibility filter based on role
    if (role !== 'root' && role !== 'admin') {
      // Employees can only see entries targeting them
      query += ` AND (
        e.org_level = 'company'
        OR (e.org_level = 'department' AND e.org_id = $3)
        OR (e.org_level = 'team' AND e.org_id = $4)
      )`;
      params.push(departmentId ?? 0, teamId ?? 0);
    }

    const result = await this.db.query<{ count: string }>(query, params);
    const count = Number.parseInt(result[0]?.count ?? '0', 10);

    return { count };
  }

  /**
   * Resolve entry ID (UUID or numeric) to numeric ID.
   */
  private async resolveEntryId(
    id: number | string,
    tenantId: number,
  ): Promise<number> {
    const idColumn = typeof id === 'string' ? 'uuid' : 'id';
    const entries = await this.db.query<{ id: number }>(
      `SELECT id FROM blackboard_entries WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (entries[0] === undefined) {
      throw new NotFoundException(ERROR_ENTRY_NOT_FOUND);
    }
    return entries[0].id;
  }
}
