/**
 * KVP Lifecycle Sub-Service
 *
 * Handles suggestion lifecycle state transitions:
 * - Share / Unshare (org-level visibility changes)
 * - Archive / Unarchive (archival lifecycle)
 *
 * Called by KvpService facade — never directly by the controller.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { ShareSuggestionDto } from './dto/share-suggestion.dto.js';
import { ERROR_SUGGESTION_NOT_FOUND } from './kvp.constants.js';
import { isUuid } from './kvp.helpers.js';

@Injectable()
export class KvpLifecycleService {
  private readonly logger = new Logger(KvpLifecycleService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ==========================================================================
  // SHARE / UNSHARE
  // ==========================================================================

  /** Share a suggestion at org level */
  async shareSuggestion(
    id: number | string,
    dto: ShareSuggestionDto,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Sharing suggestion ${String(id)} at ${dto.orgLevel} level`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';
    const rows = await this.db.query<{ id: number }>(
      `UPDATE kvp_suggestions
       SET org_level = $1, org_id = $2, is_shared = TRUE, shared_by = $3, shared_at = NOW(), updated_at = NOW()
       WHERE ${idColumn} = $4 AND tenant_id = $5
       RETURNING id`,
      [dto.orgLevel, dto.orgId, userId, id, tenantId],
    );

    const suggestion = rows[0];
    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    return { message: 'Suggestion shared successfully' };
  }

  /** Unshare a suggestion (reset to team level — uses team_id from creation) */
  async unshareSuggestion(id: number | string, tenantId: number): Promise<{ message: string }> {
    this.logger.log(`Unsharing suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';

    // Reset to original team level (team_id is preserved from creation)
    const rows = await this.db.query<{ id: number }>(
      `UPDATE kvp_suggestions
       SET org_level = 'team', org_id = team_id, is_shared = FALSE, shared_by = NULL, shared_at = NULL, updated_at = NOW()
       WHERE ${idColumn} = $1 AND tenant_id = $2
       RETURNING id`,
      [id, tenantId],
    );

    if (rows[0] === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    return { message: 'Suggestion unshared successfully' };
  }

  // ==========================================================================
  // ARCHIVE / UNARCHIVE
  // ==========================================================================

  /** Archive a suggestion (set status to 'archived') */
  async archiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Archiving suggestion ${String(id)}`);

    const { suggestion, idColumn } = await this.findSuggestionOrThrow(id, tenantId);

    await this.db.query(
      `UPDATE kvp_suggestions SET status = 'archived', updated_at = NOW() WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'kvp',
      suggestion.id,
      `KVP-Vorschlag archiviert: ${suggestion.title}`,
      { status: suggestion.status },
      { status: 'archived' },
    );

    return { message: 'Suggestion archived successfully' };
  }

  /** Unarchive a suggestion (set status to 'restored') */
  async unarchiveSuggestion(
    id: number | string,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Unarchiving suggestion ${String(id)}`);

    const { suggestion, idColumn } = await this.findSuggestionOrThrow(id, tenantId);

    await this.db.query(
      `UPDATE kvp_suggestions SET status = 'restored', updated_at = NOW() WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    await this.activityLogger.logUpdate(
      tenantId,
      userId,
      'kvp',
      suggestion.id,
      `KVP-Vorschlag wiederhergestellt: ${suggestion.title}`,
      { status: suggestion.status },
      { status: 'restored' },
    );

    return { message: 'Suggestion restored successfully' };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /** Find suggestion by numeric ID or UUID, throw if not found */
  private async findSuggestionOrThrow(
    id: number | string,
    tenantId: number,
  ): Promise<{
    suggestion: { id: number; title: string; status: string };
    idColumn: string;
  }> {
    const idColumn = isUuid(id) ? 'uuid' : 'id';

    const rows = await this.db.query<{
      id: number;
      title: string;
      status: string;
    }>(`SELECT id, title, status FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`, [
      id,
      tenantId,
    ]);

    const suggestion = rows[0];
    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    return { suggestion, idColumn };
  }
}
