/**
 * TPM Executions Service
 *
 * Handles the lifecycle of card execution records (Durchführungen).
 * When an employee completes a maintenance card, an execution record
 * is created and the card status transitions accordingly.
 *
 * Photo management is also handled here (max 5 per execution, max 5 per defect).
 *
 * Dependencies: TpmCardStatusService (status transitions), DatabaseService
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  Injectable,
  Logger,
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
  mapDefectPhotoRowToApi,
  mapDefectRowToApi,
  mapExecutionRowToApi,
  mapPhotoRowToApi,
  toIsoString,
} from './tpm-executions.helpers.js';
import type { TpmNotificationCard } from './tpm-notification.service.js';
import { TpmNotificationService } from './tpm-notification.service.js';
import { TpmSchedulingService } from './tpm-scheduling.service.js';
import type {
  EligibleParticipant,
  TpmApprovalStatus,
  TpmCardExecution,
  TpmCardExecutionPhotoRow,
  TpmCardExecutionRow,
  TpmCardRow,
  TpmDefectPhoto,
  TpmDefectPhotoRow,
  TpmExecutionDefect,
  TpmExecutionDefectRow,
  TpmExecutionParticipant,
  TpmExecutionPhoto,
} from './tpm.types.js';
import {
  MAX_PHOTOS_PER_DEFECT,
  MAX_PHOTOS_PER_EXECUTION,
} from './tpm.types.js';

/** Base SELECT for execution reads with JOINs */
const EXECUTION_SELECT = `
  SELECT e.*,
    c.uuid AS card_uuid,
    COALESCE(NULLIF(CONCAT(u_exec.first_name, ' ', u_exec.last_name), ' '), u_exec.username) AS executed_by_name,
    COALESCE(NULLIF(CONCAT(u_appr.first_name, ' ', u_appr.last_name), ' '), u_appr.username) AS approved_by_name,
    (SELECT COUNT(*)::int FROM tpm_card_execution_photos p WHERE p.execution_id = e.id) AS photo_count,
    (SELECT COUNT(*)::int FROM tpm_execution_defects d WHERE d.execution_id = e.id AND d.is_active = ${IS_ACTIVE.ACTIVE}) AS defect_count,
    COALESCE(
      (SELECT json_agg(json_build_object(
        'uuid', TRIM(u_part.uuid),
        'firstName', u_part.first_name,
        'lastName', u_part.last_name
      ) ORDER BY part.created_at)
      FROM tpm_execution_participants part
      JOIN users u_part ON part.user_id = u_part.id
      WHERE part.execution_id = e.id),
      '[]'::json
    ) AS participants
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

/** Defect with execution context (for Mängelliste page) */
export interface DefectWithContext {
  uuid: string;
  title: string;
  description: string | null;
  positionNumber: number;
  executionUuid: string;
  executionDate: string;
  executedByName: string | null;
  approvalStatus: TpmApprovalStatus;
  photoCount: number;
  createdAt: string;
  /** Work order UUID if a work order was created from this defect */
  workOrderUuid: string | null;
  /** Work order status (open, in_progress, completed, verified) */
  workOrderStatus: string | null;
  /** Work order priority (low, medium, high) */
  workOrderPriority: string | null;
  /** Names of assigned employees */
  workOrderAssigneeNames: string[];
  /** When the work order was created */
  workOrderCreatedAt: string | null;
}

/** Paginated defect list response */
export interface PaginatedDefects {
  data: DefectWithContext[];
  total: number;
  page: number;
  pageSize: number;
}

/** DB row type for defect with execution context JOIN */
interface DefectWithContextRow extends TpmExecutionDefectRow {
  execution_uuid: string;
  execution_date: string;
  executed_by_name: string | null;
  approval_status: TpmApprovalStatus;
  photo_count: number;
  work_order_uuid: string | null;
  work_order_status: string | null;
  work_order_priority: string | null;
  work_order_assignee_names: string | null;
  work_order_created_at: string | null;
}

/** SQL for fetching defects with execution context + work order info */
const DEFECT_WITH_CONTEXT_SELECT = `
  SELECT d.*,
    e.uuid AS execution_uuid,
    e.execution_date,
    COALESCE(
      NULLIF(CONCAT(u.first_name, ' ', u.last_name), ' '),
      u.username
    ) AS executed_by_name,
    e.approval_status,
    (SELECT COUNT(*)::int FROM tpm_defect_photos dp WHERE dp.defect_id = d.id) AS photo_count,
    TRIM(wo.uuid) AS work_order_uuid,
    wo.status::text AS work_order_status,
    wo.priority::text AS work_order_priority,
    wo.created_at AS work_order_created_at,
    (
      SELECT string_agg(
        COALESCE(NULLIF(CONCAT(ua.first_name, ' ', ua.last_name), ' '), ua.username),
        ', ' ORDER BY ua.last_name, ua.first_name
      )
      FROM work_order_assignees woa
      JOIN users ua ON woa.user_id = ua.id
      WHERE woa.work_order_id = wo.id
    ) AS work_order_assignee_names
  FROM tpm_execution_defects d
  JOIN tpm_card_executions e ON d.execution_id = e.id
  JOIN tpm_cards c ON e.card_id = c.id
  LEFT JOIN users u ON e.executed_by = u.id
  LEFT JOIN LATERAL (
    SELECT wo_inner.id, wo_inner.uuid, wo_inner.status, wo_inner.priority, wo_inner.created_at
    FROM work_orders wo_inner
    WHERE wo_inner.source_type = 'tpm_defect'
      AND wo_inner.source_uuid = d.uuid
      AND wo_inner.tenant_id = d.tenant_id
      AND wo_inner.is_active = ${IS_ACTIVE.ACTIVE}
    ORDER BY wo_inner.created_at DESC
    LIMIT 1
  ) wo ON true
` as const;

/** Photo file data for addPhoto / addDefectPhoto */
export interface PhotoFileData {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

@Injectable()
export class TpmExecutionsService {
  private readonly logger = new Logger(TpmExecutionsService.name);

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
    this.logger.debug(
      `Creating execution for card ${cardUuid} by user ${userId}`,
    );

    const { execution, card } = await this.db.tenantTransaction(
      async (client: PoolClient) => {
        const lockedCard = await this.lockCardByUuid(
          client,
          tenantId,
          cardUuid,
        );

        this.validateDocumentation(
          lockedCard,
          dto.documentation,
          dto.noIssuesFound,
        );

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
      card.asset_id,
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

  // ============================================================================
  // EXECUTION PHOTOS
  // ============================================================================

  /** Add a photo to an execution (max 5 per execution) */
  async addPhoto(
    tenantId: number,
    executionUuid: string,
    userId: number,
    fileData: PhotoFileData,
  ): Promise<TpmExecutionPhoto> {
    this.logger.debug(
      `Adding photo to execution ${executionUuid}: ${fileData.fileName}`,
    );

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

      void this.activityLogger.logCreate(
        tenantId,
        userId,
        'tpm_execution',
        0,
        `TPM-Foto hinzugefügt: Durchführung ${executionUuid}`,
        { executionUuid, fileName: fileData.fileName },
      );

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
  // DEFECT PHOTOS
  // ============================================================================

  /** Add a photo to a defect (max 5 per defect) */
  async addDefectPhoto(
    tenantId: number,
    defectUuid: string,
    userId: number,
    fileData: PhotoFileData,
  ): Promise<TpmDefectPhoto> {
    this.logger.debug(
      `Adding photo to defect ${defectUuid}: ${fileData.fileName}`,
    );

    return await this.db.tenantTransaction(async (client: PoolClient) => {
      const defect = await this.lockDefectByUuid(client, tenantId, defectUuid);

      const photoCount = await this.getDefectPhotoCount(
        client,
        tenantId,
        defect.id,
      );
      if (photoCount >= MAX_PHOTOS_PER_DEFECT) {
        throw new BadRequestException(
          `Maximal ${MAX_PHOTOS_PER_DEFECT} Fotos pro Mangel erlaubt`,
        );
      }

      const photoUuid = uuidv7();

      const result = await client.query<TpmDefectPhotoRow>(
        `INSERT INTO tpm_defect_photos
           (uuid, tenant_id, defect_id, file_path, file_name,
            file_size, mime_type, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          photoUuid,
          tenantId,
          defect.id,
          fileData.filePath,
          fileData.fileName,
          fileData.fileSize,
          fileData.mimeType,
          photoCount,
        ],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Defect photo INSERT returned no rows');
      }

      void this.activityLogger.logCreate(
        tenantId,
        userId,
        'tpm_execution',
        0,
        `TPM-Mängelfoto hinzugefügt: Mangel ${defectUuid}`,
        { defectUuid, fileName: fileData.fileName },
      );

      return mapDefectPhotoRowToApi(row);
    });
  }

  /** Get all photos for a defect, ordered by sort_order */
  async getDefectPhotos(
    tenantId: number,
    defectUuid: string,
  ): Promise<TpmDefectPhoto[]> {
    const rows = await this.db.query<TpmDefectPhotoRow>(
      `SELECT dp.*
       FROM tpm_defect_photos dp
       JOIN tpm_execution_defects d ON dp.defect_id = d.id
       WHERE d.uuid = $1 AND dp.tenant_id = $2
       ORDER BY dp.sort_order ASC`,
      [defectUuid, tenantId],
    );

    return rows.map(mapDefectPhotoRowToApi);
  }

  // ============================================================================
  // DEFECTS
  // ============================================================================

  /** Fetch defects for a single execution */
  async fetchDefectsForExecution(
    tenantId: number,
    executionUuid: string,
  ): Promise<TpmExecutionDefect[]> {
    const rows = await this.db.query<TpmExecutionDefectRow>(
      `SELECT d.*
       FROM tpm_execution_defects d
       JOIN tpm_card_executions e ON d.execution_id = e.id
       WHERE e.uuid = $1 AND d.tenant_id = $2 AND d.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY d.position_number ASC`,
      [executionUuid, tenantId],
    );

    return rows.map((row: TpmExecutionDefectRow) => mapDefectRowToApi(row));
  }

  /** List all defects for a card across all executions (for Mängelliste page) */
  async listDefectsForCard(
    tenantId: number,
    cardUuid: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedDefects> {
    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_execution_defects d
       JOIN tpm_card_executions e ON d.execution_id = e.id
       JOIN tpm_cards c ON e.card_id = c.id
       WHERE c.uuid = $1 AND d.tenant_id = $2 AND d.is_active = ${IS_ACTIVE.ACTIVE}`,
      [cardUuid, tenantId],
    );

    const total = Number.parseInt(countResult?.count ?? '0', 10);
    const offset = (page - 1) * pageSize;

    const rows = await this.db.query<DefectWithContextRow>(
      `${DEFECT_WITH_CONTEXT_SELECT}
       WHERE c.uuid = $1 AND d.tenant_id = $2 AND d.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY e.execution_date DESC, d.position_number ASC
       LIMIT $3 OFFSET $4`,
      [cardUuid, tenantId, pageSize, offset],
    );

    return {
      data: rows.map(mapDefectWithContextToApi),
      total,
      page,
      pageSize,
    };
  }

  /** Update a defect's title and/or description (admin action) */
  async updateDefect(
    tenantId: number,
    defectUuid: string,
    userId: number,
    fields: {
      title?: string | undefined;
      description?: string | null | undefined;
    },
  ): Promise<TpmExecutionDefect> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.title !== undefined) {
      setClauses.push(`title = $${idx}`);
      values.push(fields.title);
      idx++;
    }
    if (fields.description !== undefined) {
      setClauses.push(`description = $${idx}`);
      values.push(fields.description);
      idx++;
    }

    setClauses.push(`updated_at = NOW()`);

    values.push(defectUuid, tenantId);

    const row = await this.db.queryOne<TpmExecutionDefectRow>(
      `UPDATE tpm_execution_defects
       SET ${setClauses.join(', ')}
       WHERE uuid = $${idx} AND tenant_id = $${idx + 1} AND is_active = ${IS_ACTIVE.ACTIVE}
       RETURNING *`,
      values,
    );

    if (row === null) {
      throw new NotFoundException(`Mangel ${defectUuid} nicht gefunden`);
    }

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_defect',
      0,
      `TPM-Mangel bearbeitet: ${row.title}`,
      { defectUuid, updatedFields: Object.keys(fields) },
    );

    return mapDefectRowToApi(row);
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
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
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

  /** Lock a defect by UUID and return the full row */
  private async lockDefectByUuid(
    client: PoolClient,
    tenantId: number,
    defectUuid: string,
  ): Promise<TpmExecutionDefectRow> {
    const result = await client.query<TpmExecutionDefectRow>(
      `SELECT * FROM tpm_execution_defects
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
       FOR UPDATE`,
      [defectUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Mangel ${defectUuid} nicht gefunden`);
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

  /** Get photo count for a defect (within transaction) */
  private async getDefectPhotoCount(
    client: PoolClient,
    tenantId: number,
    defectId: number,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM tpm_defect_photos
       WHERE defect_id = $1 AND tenant_id = $2`,
      [defectId, tenantId],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Validate documentation requirement.
   * Documentation is mandatory when:
   *   - Card requires approval AND noIssuesFound is false
   *     (something noteworthy happened → must be documented)
   */
  private validateDocumentation(
    card: TpmCardRow,
    documentation: string | null | undefined,
    noIssuesFound: boolean,
  ): void {
    if (card.requires_approval && !noIssuesFound) {
      const hasDocumentation =
        documentation !== undefined &&
        documentation !== null &&
        documentation.trim().length > 0;

      if (!hasDocumentation) {
        throw new BadRequestException(
          'Dokumentation ist erforderlich wenn Beanstandungen vorliegen',
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
    const executionDate =
      dto.executionDate ?? new Date().toISOString().slice(0, 10);

    const result = await client.query<TpmExecutionJoinRow>(
      `INSERT INTO tpm_card_executions
         (uuid, tenant_id, card_id, executed_by, execution_date,
          documentation, approval_status, custom_data,
          no_issues_found, actual_duration_minutes, actual_staff_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        dto.noIssuesFound,
        dto.actualDurationMinutes ?? null,
        dto.actualStaffCount ?? null,
      ],
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('Execution INSERT returned no rows');
    }

    const execution = mapExecutionRowToApi(row);

    const participantUuids = dto.participantUuids;
    if (participantUuids !== undefined && participantUuids.length > 0) {
      execution.participants = await this.insertParticipants(
        client,
        tenantId,
        row.id,
        participantUuids,
      );
    }

    const defects = dto.defects;
    if (defects.length > 0) {
      execution.defects = await this.insertDefects(
        client,
        tenantId,
        row.id,
        defects,
      );
      execution.defectCount = defects.length;
    }

    return execution;
  }

  /** Resolve participant UUIDs → user rows, INSERT into junction table */
  private async insertParticipants(
    client: PoolClient,
    tenantId: number,
    executionId: number,
    participantUuids: string[],
  ): Promise<TpmExecutionParticipant[]> {
    const usersResult = await client.query<{
      id: number;
      uuid: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT id, uuid, first_name, last_name FROM users
       WHERE uuid = ANY($1) AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [participantUuids, tenantId],
    );

    if (usersResult.rows.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const user of usersResult.rows) {
      placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
      values.push(uuidv7(), tenantId, executionId, user.id);
      idx += 4;
    }

    await client.query(
      `INSERT INTO tpm_execution_participants (uuid, tenant_id, execution_id, user_id)
       VALUES ${placeholders.join(', ')}`,
      values,
    );

    return usersResult.rows.map(
      (u: { uuid: string; first_name: string; last_name: string }) => ({
        uuid: u.uuid.trim(),
        firstName: u.first_name,
        lastName: u.last_name,
      }),
    );
  }

  /** Insert defect entries for an execution within transaction */
  private async insertDefects(
    client: PoolClient,
    tenantId: number,
    executionId: number,
    defects: readonly {
      title: string;
      description?: string | null | undefined;
    }[],
  ): Promise<TpmExecutionDefect[]> {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const [pos, entry] of defects.entries()) {
      placeholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`,
      );
      values.push(
        uuidv7(),
        tenantId,
        executionId,
        entry.title,
        entry.description ?? null,
        pos + 1,
      );
      idx += 6;
    }

    const rows = await client.query<TpmExecutionDefectRow>(
      `INSERT INTO tpm_execution_defects
         (uuid, tenant_id, execution_id, title, description, position_number)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values,
    );

    return rows.rows.map((row: TpmExecutionDefectRow) =>
      mapDefectRowToApi(row),
    );
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
          card.asset_id,
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
    } catch (error: unknown) {
      this.logger.warn(
        { err: error, cardUuid: card.uuid },
        'Non-critical: notification after execution failed',
      );
    }
  }

  /** List active employees eligible as execution participants */
  async getEligibleParticipants(
    tenantId: number,
  ): Promise<EligibleParticipant[]> {
    const rows = await this.db.query<{
      id: number;
      uuid: string;
      first_name: string;
      last_name: string;
      email: string;
      employee_number: string | null;
      position: string | null;
    }>(
      `SELECT id, uuid, first_name, last_name, email, employee_number, position
       FROM users
       WHERE tenant_id = $1 AND is_active = ${IS_ACTIVE.ACTIVE} AND role = 'employee'
       ORDER BY last_name, first_name`,
      [tenantId],
    );

    return rows.map(
      (r: (typeof rows)[number]): EligibleParticipant => ({
        id: r.id,
        uuid: r.uuid.trim(),
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        employeeNumber: r.employee_number,
        position: r.position,
      }),
    );
  }

  /** Resolve team leads + admins who can approve for a asset */
  private async resolveApproverIds(
    tenantId: number,
    assetId: number,
  ): Promise<number[]> {
    const rows = await this.db.query<{ user_id: number }>(
      `SELECT DISTINCT t.team_lead_id AS user_id
       FROM teams t
       JOIN asset_teams mt ON t.id = mt.team_id AND mt.tenant_id = t.tenant_id
       WHERE mt.asset_id = $1 AND mt.tenant_id = $2
         AND t.team_lead_id IS NOT NULL AND t.is_active = ${IS_ACTIVE.ACTIVE}
       UNION
       SELECT id AS user_id FROM users
       WHERE tenant_id = $2 AND has_full_access = true AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [assetId, tenantId],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }
}

/** Map defect-with-context DB row to API response (module-level helper) */
function mapDefectWithContextToApi(
  row: DefectWithContextRow,
): DefectWithContext {
  const assigneeNamesRaw = row.work_order_assignee_names;
  const assigneeNames =
    assigneeNamesRaw !== null && assigneeNamesRaw !== '' ?
      assigneeNamesRaw.split(', ')
    : [];

  return {
    uuid: row.uuid.trim(),
    title: row.title,
    description: row.description,
    positionNumber: row.position_number,
    executionUuid: row.execution_uuid.trim(),
    executionDate: toIsoString(row.execution_date),
    executedByName: row.executed_by_name,
    approvalStatus: row.approval_status,
    photoCount: row.photo_count,
    createdAt: toIsoString(row.created_at),
    workOrderUuid: row.work_order_uuid,
    workOrderStatus: row.work_order_status,
    workOrderPriority: row.work_order_priority,
    workOrderAssigneeNames: assigneeNames,
    workOrderCreatedAt:
      row.work_order_created_at !== null ?
        toIsoString(row.work_order_created_at)
      : null,
  };
}

/** Convert a TpmCardRow to TpmNotificationCard (module-level helper) */
function cardRowToNotification(card: TpmCardRow): TpmNotificationCard {
  return {
    uuid: card.uuid,
    cardCode: card.card_code,
    title: card.title,
    assetId: card.asset_id,
    intervalType: card.interval_type,
    status: card.status,
  };
}
