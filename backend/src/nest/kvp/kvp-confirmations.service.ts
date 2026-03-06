/**
 * KVP Confirmations Sub-Service
 *
 * Manages read confirmations (Pattern 2: Individual Decrement/Increment)
 * for KVP suggestions. Own bounded context with kvp_confirmations table.
 * Called by KvpService facade — never directly by the controller.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ERROR_SUGGESTION_NOT_FOUND } from './kvp.constants.js';
import { buildVisibilityClause } from './kvp.helpers.js';
import type { ExtendedUserOrgInfo } from './kvp.types.js';

@Injectable()
export class KvpConfirmationsService {
  private readonly logger = new Logger(KvpConfirmationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /**
   * Get count of unconfirmed KVP suggestions for notification badge.
   * Counts suggestions visible to user that haven't been marked as read.
   */
  async getUnconfirmedCount(
    userId: number,
    tenantId: number,
    orgInfo: ExtendedUserOrgInfo,
  ): Promise<{ count: number }> {
    this.logger.debug(
      `Getting unconfirmed count for user ${userId}, tenant ${tenantId}`,
    );

    // Base query: count suggestions without confirmation (or is_confirmed = false)
    let query = `
      SELECT COUNT(*)::integer as count
      FROM kvp_suggestions s
      LEFT JOIN kvp_confirmations kc ON s.id = kc.suggestion_id AND kc.user_id = $1 AND kc.tenant_id = s.tenant_id
      WHERE s.tenant_id = $2
        AND (kc.id IS NULL OR kc.is_confirmed = false)
    `;
    const params: unknown[] = [userId, tenantId];

    // Apply visibility restrictions for ALL users (not just employees!)
    // Only users with has_full_access=TRUE bypass this
    const visibility = buildVisibilityClause(
      orgInfo,
      userId,
      params.length + 1,
    );
    query += visibility.clause;
    params.push(...visibility.params);

    const rows = await this.db.query<{ count: number }>(query, params);
    return { count: rows[0]?.count ?? 0 };
  }

  /**
   * Mark a suggestion as read (confirmed) by the user.
   * Uses UPSERT: first_seen_at is set only on first confirmation (never reset).
   */
  async confirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    this.logger.log(`User ${userId} confirming suggestion ${uuid}`);

    // Get suggestion ID
    const suggestionRows = await this.db.query<{ id: number }>(
      'SELECT id FROM kvp_suggestions WHERE uuid = $1 AND tenant_id = $2',
      [uuid, tenantId],
    );
    const suggestion = suggestionRows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // UPSERT: Insert if not exists, otherwise update is_confirmed
    // first_seen_at is only set on INSERT (never reset on re-confirm)
    await this.db.query(
      `INSERT INTO kvp_confirmations
         (tenant_id, suggestion_id, user_id, confirmed_at, first_seen_at, is_confirmed)
       VALUES ($1, $2, $3, NOW(), NOW(), true)
       ON CONFLICT (tenant_id, suggestion_id, user_id)
       DO UPDATE SET is_confirmed = true, confirmed_at = NOW()`,
      [tenantId, suggestion.id, userId],
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'kvp',
      suggestion.id,
      `KVP-Vorschlag bestätigt: ${uuid}`,
    );

    return { success: true };
  }

  /**
   * Mark a suggestion as unread (remove confirmation) by the user.
   * Sets is_confirmed = false instead of deleting to preserve first_seen_at.
   */
  async unconfirmSuggestion(
    uuid: string,
    userId: number,
    tenantId: number,
  ): Promise<{ success: boolean }> {
    this.logger.log(`User ${userId} unconfirming suggestion ${uuid}`);

    // Get suggestion ID
    const suggestionRows = await this.db.query<{ id: number }>(
      'SELECT id FROM kvp_suggestions WHERE uuid = $1 AND tenant_id = $2',
      [uuid, tenantId],
    );
    const suggestion = suggestionRows[0];

    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // Set is_confirmed = false (preserve first_seen_at for "Neu" badge logic)
    await this.db.query(
      `UPDATE kvp_confirmations
       SET is_confirmed = false, confirmed_at = NULL
       WHERE tenant_id = $1 AND suggestion_id = $2 AND user_id = $3`,
      [tenantId, suggestion.id, userId],
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'kvp',
      suggestion.id,
      `KVP-Vorschlag als ungelesen markiert: ${uuid}`,
    );

    return { success: true };
  }
}
