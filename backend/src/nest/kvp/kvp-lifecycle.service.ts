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
    this.logger.log(
      `Sharing suggestion ${String(id)} at ${dto.orgLevel} level`,
    );

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

    // Add shared org to junction table (team/asset only)
    if (dto.orgLevel === 'team' || dto.orgLevel === 'asset') {
      await this.db.query(
        `INSERT INTO kvp_suggestion_organizations (suggestion_id, org_type, org_id, tenant_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (suggestion_id, org_type, org_id) DO NOTHING`,
        [suggestion.id, dto.orgLevel, dto.orgId, tenantId],
      );
    }

    return { message: 'Suggestion shared successfully' };
  }

  /** Unshare a suggestion (reset to team level) */
  async unshareSuggestion(
    id: number | string,
    tenantId: number,
    fallbackTeamId: number,
  ): Promise<{ message: string }> {
    this.logger.log(`Unsharing suggestion ${String(id)}`);

    const idColumn = isUuid(id) ? 'uuid' : 'id';

    // Get current share info to clean up junction table
    const rows = await this.db.query<{
      id: number;
      org_level: string;
      org_id: number;
    }>(
      `SELECT id, org_level, org_id FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    const suggestion = rows[0];
    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    // Remove shared org from junction table (team/asset only)
    if (suggestion.org_level === 'team' || suggestion.org_level === 'asset') {
      await this.db.query(
        `DELETE FROM kvp_suggestion_organizations
         WHERE suggestion_id = $1 AND org_type = $2 AND org_id = $3`,
        [suggestion.id, suggestion.org_level, suggestion.org_id],
      );
    }

    // Reset main record to original team level
    await this.db.query(
      `UPDATE kvp_suggestions
       SET org_level = 'team', org_id = $1, is_shared = FALSE, shared_by = NULL, shared_at = NULL, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [fallbackTeamId, suggestion.id, tenantId],
    );

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

    const { suggestion, idColumn } = await this.findSuggestionOrThrow(
      id,
      tenantId,
    );

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

    const { suggestion, idColumn } = await this.findSuggestionOrThrow(
      id,
      tenantId,
    );

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
    }>(
      `SELECT id, title, status FROM kvp_suggestions WHERE ${idColumn} = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    const suggestion = rows[0];
    if (suggestion === undefined) {
      throw new NotFoundException(ERROR_SUGGESTION_NOT_FOUND);
    }

    return { suggestion, idColumn };
  }
}
