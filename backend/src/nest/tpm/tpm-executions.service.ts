/**
 * TPM Executions Service
 *
 * Handles the lifecycle of card execution records (Durchführungen).
 * When an employee completes a maintenance card, an execution record
 * is created and the card status transitions accordingly.
 *
 * Photo management is also handled here (max 5 per execution).
 *
 * Dependencies: TpmCardStatusService (status transitions), DatabaseService
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CompleteCardDto } from './dto/complete-card.dto.js';
import { TpmCardStatusService } from './tpm-card-status.service.js';
import {
  type TpmExecutionJoinRow,
  mapExecutionRowToApi,
  mapPhotoRowToApi,
} from './tpm-executions.helpers.js';
import type { TpmNotificationCard } from './tpm-notification.service.js';
import { TpmNotificationService } from './tpm-notification.service.js';
import { TpmSchedulingService } from './tpm-scheduling.service.js';
import type {
  TpmCardExecution,
  TpmCardExecutionPhotoRow,
  TpmCardExecutionRow,
  TpmCardRow,
  TpmExecutionPhoto,
} from './tpm.types.js';
import { MAX_PHOTOS_PER_EXECUTION } from './tpm.types.js';

/** Base SELECT for execution reads with JOINs */
const EXECUTION_SELECT = `
  SELECT e.*,
    c.uuid AS card_uuid,
    COALESCE(NULLIF(CONCAT(u_exec.first_name, ' ', u_exec.last_name), ' '), u_exec.username) AS executed_by_name,
    COALESCE(NULLIF(CONCAT(u_appr.first_name, ' ', u_appr.last_name), ' '), u_appr.username) AS approved_by_name,
    (SELECT COUNT(*)::int FROM tpm_card_execution_photos p WHERE p.execution_id = e.id) AS photo_count
  FROM tpm_card_executions e
  LEFT JOIN tpm_cards c ON e.card_id = c.id
  LEFT JOIN users u_exec ON e.executed_by = u_exec.id
  LEFT JOIN users u_appr ON e.approved_by = u_appr.id
` as const;

/** Paginated execution list response */
export interface PaginatedExecutions {
  data: TpmCardExecution[];
  total: number;
  page: number;
  pageSize: number;
}

/** Photo file data for addPhoto */
export interface PhotoFileData {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

@Injectable()
export class TpmExecutionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cardStatusService: TpmCardStatusService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly notificationService: TpmNotificationService,
    private readonly schedulingService: TpmSchedulingService,
  ) {}

  /**
   * Create an execution record for a card (employee marks card as done).
   *
   * Transaction flow:
   *   1. Resolve card by UUID → lock card
   *   2. Validate card is completable (status check in cardStatusService)
   *   3. Validate documentation requirement (if requires_approval)
   *   4. Insert execution record
   *   5. Transition card status via cardStatusService
   *   6. Set approval_status based on completion result
   */
  async createExecution(
    tenantId: number,
    cardUuid: string,
    userId: number,
    dto: CompleteCardDto,
  ): Promise<TpmCardExecution> {
    const { execution, card } = await this.db.tenantTransaction(
      async (client: PoolClient) => {
        const lockedCard = await this.lockCardByUuid(
          client,
          tenantId,
          cardUuid,
        );

        this.validateDocumentation(lockedCard, dto.documentation);

        const completionResult = await this.cardStatusService.markCardCompleted(
          client,
          tenantId,
          lockedCard.id,
          userId,
        );

        // Flow A (no approval): card is green → advance to next scheduled date
        if (!completionResult.requiresApproval) {
          await this.schedulingService.advanceSchedule(
            client,
            tenantId,
            lockedCard.id,
          );
        }

        const approvalStatus =
          completionResult.requiresApproval ? 'pending' : 'none';

        const result = await this.insertExecution(
          client,
          tenantId,
          lockedCard.id,
          userId,
          dto,
          approvalStatus,
        );

        return { execution: result, card: lockedCard };
      },
    );

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'tpm_execution',
      card.machine_id,
      `TPM-Durchführung erstellt: Karte ${cardUuid}`,
      { executionUuid: execution.uuid, cardUuid },
    );

    void this.notifyAfterExecution(tenantId, userId, card, execution);

    return execution;
  }

  /** Get a single execution by UUID */
  async getExecution(
    tenantId: number,
    executionUuid: string,
  ): Promise<TpmCardExecution> {
    const row = await this.db.queryOne<TpmExecutionJoinRow>(
      `${EXECUTION_SELECT}
       WHERE e.uuid = $1 AND e.tenant_id = $2`,
      [executionUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(
        `Durchführung ${executionUuid} nicht gefunden`,
      );
    }

    return mapExecutionRowToApi(row);
  }

  /** List executions for a specific card (history), paginated */
  async listExecutionsForCard(
    tenantId: number,
    cardUuid: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedExecutions> {
    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_card_executions e
       JOIN tpm_cards c ON e.card_id = c.id
       WHERE c.uuid = $1 AND e.tenant_id = $2`,
      [cardUuid, tenantId],
    );

    const total = Number.parseInt(countResult?.count ?? '0', 10);
    const offset = (page - 1) * pageSize;

    const rows = await this.db.query<TpmExecutionJoinRow>(
      `${EXECUTION_SELECT}
       WHERE c.uuid = $1 AND e.tenant_id = $2
       ORDER BY e.execution_date DESC, e.created_at DESC
       LIMIT $3 OFFSET $4`,
      [cardUuid, tenantId, pageSize, offset],
    );

    return {
      data: rows.map(mapExecutionRowToApi),
      total,
      page,
      pageSize,
    };
  }

  /** List all executions with pending approval status for a tenant */
  async listPendingApprovals(
    tenantId: number,
    page: number,
    pageSize: number,
  ): Promise<PaginatedExecutions> {
    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_card_executions
       WHERE tenant_id = $1 AND approval_status = 'pending'`,
      [tenantId],
    );

    const total = Number.parseInt(countResult?.count ?? '0', 10);
    const offset = (page - 1) * pageSize;

    const rows = await this.db.query<TpmExecutionJoinRow>(
      `${EXECUTION_SELECT}
       WHERE e.tenant_id = $1 AND e.approval_status = 'pending'
       ORDER BY e.created_at ASC
       LIMIT $2 OFFSET $3`,
      [tenantId, pageSize, offset],
    );

    return {
      data: rows.map(mapExecutionRowToApi),
      total,
      page,
      pageSize,
    };
  }

  /** Add a photo to an execution (max 5 per execution) */
  async addPhoto(
    tenantId: number,
    executionUuid: string,
    fileData: PhotoFileData,
  ): Promise<TpmExecutionPhoto> {
    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const execution = await this.lockExecutionByUuid(
        client,
        tenantId,
        executionUuid,
      );

      const photoCount = await this.getPhotoCount(
        client,
        tenantId,
        execution.id,
      );
      if (photoCount >= MAX_PHOTOS_PER_EXECUTION) {
        throw new BadRequestException(
          `Maximal ${MAX_PHOTOS_PER_EXECUTION} Fotos pro Durchführung erlaubt`,
        );
      }

      const photoUuid = uuidv7();
      const nextSortOrder = photoCount;

      const result = await client.query<TpmCardExecutionPhotoRow>(
        `INSERT INTO tpm_card_execution_photos
           (uuid, tenant_id, execution_id, file_path, file_name,
            file_size, mime_type, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          photoUuid,
          tenantId,
          execution.id,
          fileData.filePath,
          fileData.fileName,
          fileData.fileSize,
          fileData.mimeType,
          nextSortOrder,
        ],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Photo INSERT returned no rows');
      }
      return mapPhotoRowToApi(row);
    });
  }

  /** Get all photos for an execution, ordered by sort_order */
  async getPhotos(
    tenantId: number,
    executionUuid: string,
  ): Promise<TpmExecutionPhoto[]> {
    const rows = await this.db.query<TpmCardExecutionPhotoRow>(
      `SELECT p.*
       FROM tpm_card_execution_photos p
       JOIN tpm_card_executions e ON p.execution_id = e.id
       WHERE e.uuid = $1 AND p.tenant_id = $2
       ORDER BY p.sort_order ASC`,
      [executionUuid, tenantId],
    );

    return rows.map(mapPhotoRowToApi);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /** Lock a card by UUID and return the full row */
  private async lockCardByUuid(
    client: PoolClient,
    tenantId: number,
    cardUuid: string,
  ): Promise<TpmCardRow> {
    const result = await client.query<TpmCardRow>(
      `SELECT * FROM tpm_cards
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
       FOR UPDATE`,
      [cardUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`TPM-Karte ${cardUuid} nicht gefunden`);
    }
    return row;
  }

  /** Lock an execution by UUID and return the full row */
  private async lockExecutionByUuid(
    client: PoolClient,
    tenantId: number,
    executionUuid: string,
  ): Promise<TpmCardExecutionRow> {
    const result = await client.query<TpmCardExecutionRow>(
      `SELECT * FROM tpm_card_executions
       WHERE uuid = $1 AND tenant_id = $2
       FOR UPDATE`,
      [executionUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(
        `Durchführung ${executionUuid} nicht gefunden`,
      );
    }
    return row;
  }

  /** Get photo count for an execution (within transaction) */
  private async getPhotoCount(
    client: PoolClient,
    tenantId: number,
    executionId: number,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_card_execution_photos
       WHERE execution_id = $1 AND tenant_id = $2`,
      [executionId, tenantId],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /** Validate documentation requirement for approval cards */
  private validateDocumentation(
    card: TpmCardRow,
    documentation: string | null | undefined,
  ): void {
    if (card.requires_approval) {
      const hasDocumentation =
        documentation !== undefined &&
        documentation !== null &&
        documentation.trim().length > 0;

      if (!hasDocumentation) {
        throw new BadRequestException(
          'Dokumentation ist bei Karten mit Freigabepflicht erforderlich',
        );
      }
    }
  }

  /** Insert execution record and return mapped API response */
  private async insertExecution(
    client: PoolClient,
    tenantId: number,
    cardId: number,
    userId: number,
    dto: CompleteCardDto,
    approvalStatus: string,
  ): Promise<TpmCardExecution> {
    const executionUuid = uuidv7();
    const executionDate = new Date().toISOString().slice(0, 10);

    const result = await client.query<TpmExecutionJoinRow>(
      `INSERT INTO tpm_card_executions
         (uuid, tenant_id, card_id, executed_by, execution_date,
          documentation, approval_status, custom_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *,
         (SELECT uuid FROM tpm_cards WHERE id = $3) AS card_uuid,
         (SELECT username FROM users WHERE id = $4) AS executed_by_name`,
      [
        executionUuid,
        tenantId,
        cardId,
        userId,
        executionDate,
        dto.documentation ?? null,
        approvalStatus,
        JSON.stringify(dto.customData),
      ],
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('Execution INSERT returned no rows');
    }
    return mapExecutionRowToApi(row);
  }

  /**
   * Fire-and-forget notification after execution creation.
   * If approval required → notify approvers. Otherwise → notify completion.
   */
  private async notifyAfterExecution(
    tenantId: number,
    userId: number,
    card: TpmCardRow,
    execution: TpmCardExecution,
  ): Promise<void> {
    try {
      const notificationCard = cardRowToNotification(card);

      if (execution.approvalStatus === 'pending') {
        const approverIds = await this.resolveApproverIds(
          tenantId,
          card.machine_id,
        );
        this.notificationService.notifyApprovalRequired(
          tenantId,
          notificationCard,
          execution.uuid,
          approverIds,
        );
      } else {
        this.notificationService.notifyMaintenanceCompleted(
          tenantId,
          notificationCard,
          userId,
        );
      }
    } catch {
      // Non-critical — notification failure should not affect execution creation
    }
  }

  /** Resolve team leads + admins who can approve for a machine */
  private async resolveApproverIds(
    tenantId: number,
    machineId: number,
  ): Promise<number[]> {
    const rows = await this.db.query<{ user_id: number }>(
      `SELECT DISTINCT t.team_lead_id AS user_id
       FROM teams t
       JOIN machine_teams mt ON t.id = mt.team_id AND mt.tenant_id = t.tenant_id
       WHERE mt.machine_id = $1 AND mt.tenant_id = $2
         AND t.team_lead_id IS NOT NULL AND t.is_active = 1
       UNION
       SELECT id AS user_id FROM users
       WHERE tenant_id = $2 AND has_full_access = true AND is_active = 1`,
      [machineId, tenantId],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }
}

/** Convert a TpmCardRow to TpmNotificationCard (module-level helper) */
function cardRowToNotification(card: TpmCardRow): TpmNotificationCard {
  return {
    uuid: card.uuid,
    cardCode: card.card_code,
    title: card.title,
    machineId: card.machine_id,
    intervalType: card.interval_type,
    status: card.status,
  };
}
