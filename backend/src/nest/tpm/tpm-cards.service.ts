/**
 * TPM Cards Service
 *
 * CRUD operations for maintenance cards (Kamishibai cards).
 * Cards belong to a plan and have interval-based scheduling.
 *
 * Key invariants enforced here:
 *   - asset_id is auto-set from plan.asset_id (denormalization, never manual)
 *   - interval_order is auto-set from INTERVAL_ORDER_MAP
 *   - card_code is auto-generated: prefix (BT/IV) + sequential number per plan+role
 *   - sort_order is auto-incremented per plan
 */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateCardDto } from './dto/create-card.dto.js';
import type { UpdateCardDto } from './dto/update-card.dto.js';
import {
  type TpmCardJoinRow,
  buildCardUpdateFields,
  mapCardRowToApi,
} from './tpm-cards.helpers.js';
import { TpmSchedulingService } from './tpm-scheduling.service.js';
import type {
  TpmCard,
  TpmCardCategory,
  TpmCardRole,
  TpmCardRow,
  TpmCardStatus,
  TpmIntervalType,
} from './tpm.types.js';
import {
  CARD_CODE_PREFIX,
  INTERVAL_ORDER_MAP,
  MAX_CARDS_PER_PLAN_INTERVAL,
} from './tpm.types.js';

/** Filters for card list queries */
export interface CardListFilter {
  status?: TpmCardStatus;
  intervalType?: TpmIntervalType;
  cardRole?: TpmCardRole;
  cardCategory?: TpmCardCategory;
}

/** Paginated card list response */
export interface PaginatedCards {
  data: TpmCard[];
  total: number;
  page: number;
  pageSize: number;
}

/** Base SELECT for card reads with all JOINs */
const CARD_SELECT_SQL = `
  SELECT c.*,
    p.uuid AS plan_uuid,
    m.name AS asset_name,
    COALESCE(NULLIF(CONCAT(u_created.first_name, ' ', u_created.last_name), ' '), u_created.username) AS created_by_name,
    COALESCE(NULLIF(CONCAT(u_completed.first_name, ' ', u_completed.last_name), ' '), u_completed.username) AS last_completed_by_name
  FROM tpm_cards c
  LEFT JOIN tpm_maintenance_plans p ON c.plan_id = p.id
  LEFT JOIN assets m ON c.asset_id = m.id AND m.tenant_id = c.tenant_id
  LEFT JOIN users u_created ON c.created_by = u_created.id
  LEFT JOIN users u_completed ON c.last_completed_by = u_completed.id`;

@Injectable()
export class TpmCardsService {
  private readonly logger = new Logger(TpmCardsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly schedulingService: TpmSchedulingService,
  ) {}

  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /** Get a single card by UUID with full JOIN data */
  async getCard(tenantId: number, cardUuid: string): Promise<TpmCard> {
    const row = await this.db.queryOne<TpmCardJoinRow>(
      `${CARD_SELECT_SQL}
       WHERE c.uuid = $1 AND c.tenant_id = $2 AND c.is_active = 1`,
      [cardUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(`TPM-Karte ${cardUuid} nicht gefunden`);
    }

    return mapCardRowToApi(row);
  }

  /** List all cards for a asset (by asset UUID) with filters */
  async listCardsForAsset(
    tenantId: number,
    assetUuid: string,
    page: number = 1,
    pageSize: number = 50,
    filters: CardListFilter = {},
  ): Promise<PaginatedCards> {
    const { whereClauses, params } = buildFilterClauses(filters, 3);
    const baseWhere = `c.tenant_id = $1 AND c.is_active = 1 AND m.uuid = $2`;
    const fullWhere = [baseWhere, ...whereClauses].join(' AND ');

    return await this.executePaginatedQuery(
      fullWhere,
      [tenantId, assetUuid, ...params],
      page,
      pageSize,
    );
  }

  /** List all cards for a plan (by plan UUID) with filters */
  async listCardsForPlan(
    tenantId: number,
    planUuid: string,
    page: number = 1,
    pageSize: number = 50,
    filters: CardListFilter = {},
  ): Promise<PaginatedCards> {
    const { whereClauses, params } = buildFilterClauses(filters, 3);
    const baseWhere = `c.tenant_id = $1 AND c.is_active = 1 AND p.uuid = $2`;
    const fullWhere = [baseWhere, ...whereClauses].join(' AND ');

    return await this.executePaginatedQuery(
      fullWhere,
      [tenantId, planUuid, ...params],
      page,
      pageSize,
    );
  }

  /** List cards by status (for dashboard widgets) */
  async getCardsByStatus(
    tenantId: number,
    status: TpmCardStatus,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedCards> {
    const fullWhere = `c.tenant_id = $1 AND c.is_active = 1 AND c.status = $2`;

    return await this.executePaginatedQuery(
      fullWhere,
      [tenantId, status],
      page,
      pageSize,
    );
  }

  // ============================================================================
  // WRITE OPERATIONS
  // ============================================================================

  /** Create a new maintenance card */
  async createCard(
    tenantId: number,
    dto: CreateCardDto,
    createdBy: number,
  ): Promise<TpmCard> {
    this.logger.debug(`Creating card "${dto.title}" for plan ${dto.planUuid}`);

    const card = await this.db.tenantTransaction(
      (client: PoolClient): Promise<TpmCard> =>
        this.runCreateTransaction(client, tenantId, dto, createdBy),
    );

    void this.activityLogger.logCreate(
      tenantId,
      createdBy,
      'tpm_card',
      card.assetId,
      `TPM-Karte erstellt: ${card.cardCode} — ${card.title}`,
      { cardUuid: card.uuid, cardCode: card.cardCode },
    );

    return card;
  }

  /** Update an existing card */
  async updateCard(
    tenantId: number,
    userId: number,
    cardUuid: string,
    dto: UpdateCardDto,
  ): Promise<TpmCard> {
    const card = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmCard> => {
        const existing = await this.lockCardByUuid(client, tenantId, cardUuid);

        const { setClauses, params, nextParamIndex } = buildCardUpdateFields(
          dto as Record<string, unknown>,
        );

        // Recalculate interval_order when intervalType changes
        let paramIdx = nextParamIndex;
        if (
          dto.intervalType !== undefined &&
          dto.intervalType !== existing.interval_type
        ) {
          setClauses.push(`interval_order = $${paramIdx}`);
          params.push(INTERVAL_ORDER_MAP[dto.intervalType]);
          paramIdx++;
        }

        if (setClauses.length === 0) {
          return mapCardRowToApi(existing as TpmCardJoinRow);
        }

        params.push(cardUuid, tenantId);
        const sql = `UPDATE tpm_cards
                     SET ${setClauses.join(', ')}, updated_at = NOW()
                     WHERE uuid = $${paramIdx} AND tenant_id = $${paramIdx + 1} AND is_active = 1
                     RETURNING *`;

        const result = await client.query<TpmCardJoinRow>(sql, params);
        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('UPDATE tpm_cards returned no rows');
        }

        return mapCardRowToApi(row);
      },
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'tpm_card',
      card.assetId,
      `TPM-Karte aktualisiert: ${card.cardCode} — ${card.title}`,
      { cardUuid },
      dto as Record<string, unknown>,
    );

    return card;
  }

  /** Soft-delete a card (is_active = 4) */
  async deleteCard(
    tenantId: number,
    userId: number,
    cardUuid: string,
  ): Promise<void> {
    const card = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmCard> => {
        const existing = await this.lockCardByUuid(client, tenantId, cardUuid);

        await client.query(
          `UPDATE tpm_cards
           SET is_active = 4, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2`,
          [cardUuid, tenantId],
        );

        return mapCardRowToApi(existing as TpmCardJoinRow);
      },
    );

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'tpm_card',
      card.assetId,
      `TPM-Karte gelöscht: ${card.cardCode} — ${card.title}`,
      { cardUuid, cardCode: card.cardCode },
    );
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /** Transactional body for card creation (context, code, insert, schedule) */
  private async runCreateTransaction(
    client: PoolClient,
    tenantId: number,
    dto: CreateCardDto,
    createdBy: number,
  ): Promise<TpmCard> {
    const planCtx = await this.resolvePlanContext(
      client,
      tenantId,
      dto.planUuid,
    );

    await this.assertCardLimitNotReached(
      client,
      tenantId,
      planCtx.planId,
      dto.intervalType,
    );

    const cardCode = await this.generateCardCode(
      client,
      tenantId,
      planCtx.planId,
      dto.cardRole,
    );
    const sortOrder = await this.getNextSortOrder(
      client,
      tenantId,
      planCtx.planId,
    );

    const insertData = buildCardInsertData(dto, planCtx, {
      tenantId,
      cardCode,
      sortOrder,
      createdBy,
    });
    const { id: cardId, card } = await this.executeCardInsert(
      client,
      insertData,
    );

    const effectiveWeekday =
      dto.intervalType === 'weekly' && dto.weekdayOverride != null ?
        dto.weekdayOverride
      : planCtx.baseWeekday;

    await this.schedulingService.initializeCardSchedule(
      client,
      tenantId,
      cardId,
      dto.intervalType,
      {
        baseWeekday: effectiveWeekday,
        baseRepeatEvery: planCtx.baseRepeatEvery,
      },
      dto.customIntervalDays ?? null,
    );

    return card;
  }

  /** Resolve plan UUID → plan ID + asset ID + scheduling config */
  private async resolvePlanContext(
    client: PoolClient,
    tenantId: number,
    planUuid: string,
  ): Promise<{
    planId: number;
    assetId: number;
    baseWeekday: number;
    baseRepeatEvery: number;
  }> {
    const result = await client.query<{
      id: number;
      asset_id: number;
      base_weekday: number;
      base_repeat_every: number;
    }>(
      `SELECT id, asset_id, base_weekday, base_repeat_every
       FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [planUuid, tenantId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }
    return {
      planId: row.id,
      assetId: row.asset_id,
      baseWeekday: row.base_weekday,
      baseRepeatEvery: row.base_repeat_every,
    };
  }

  /** Generate the next card code (e.g., "BT3", "IV7") — counts ALL cards including deleted */
  private async generateCardCode(
    client: PoolClient,
    tenantId: number,
    planId: number,
    cardRole: TpmCardRole,
  ): Promise<string> {
    const prefix = CARD_CODE_PREFIX[cardRole];
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tpm_cards
       WHERE plan_id = $1 AND card_role = $2 AND tenant_id = $3`,
      [planId, cardRole, tenantId],
    );
    const count = Number.parseInt(result.rows[0]?.count ?? '0', 10);
    return `${prefix}${count + 1}`;
  }

  /** Execute the INSERT query for a new card — returns internal id + mapped API card */
  private async executeCardInsert(
    client: PoolClient,
    data: {
      tenantId: number;
      planId: number;
      assetId: number;
      cardCode: string;
      sortOrder: number;
      createdBy: number;
      cardRole: TpmCardRole;
      intervalType: TpmIntervalType;
      intervalOrder: number;
      title: string;
      description: string | null;
      locationDescription: string | null;
      requiresApproval: boolean;
      customIntervalDays: number | null;
      weekdayOverride: number | null;
      estimatedExecutionMinutes: number | null;
      cardCategories: TpmCardCategory[];
    },
  ): Promise<{ id: number; card: TpmCard }> {
    const uuid = uuidv7();
    const result = await client.query<TpmCardJoinRow>(
      `INSERT INTO tpm_cards
         (uuid, tenant_id, plan_id, asset_id, card_code, card_role,
          interval_type, interval_order, title, description,
          location_description, requires_approval, sort_order,
          custom_interval_days, weekday_override,
          estimated_execution_minutes, card_categories, created_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,1)
       RETURNING *`,
      [
        uuid,
        data.tenantId,
        data.planId,
        data.assetId,
        data.cardCode,
        data.cardRole,
        data.intervalType,
        data.intervalOrder,
        data.title,
        data.description,
        data.locationDescription,
        data.requiresApproval,
        data.sortOrder,
        data.customIntervalDays,
        data.weekdayOverride,
        data.estimatedExecutionMinutes,
        data.cardCategories,
        data.createdBy,
      ],
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('INSERT into tpm_cards returned no rows');
    }

    return { id: row.id, card: mapCardRowToApi(row) };
  }

  /** Get next sort_order for a plan's active cards */
  private async getNextSortOrder(
    client: PoolClient,
    tenantId: number,
    planId: number,
  ): Promise<number> {
    const result = await client.query<{ max_sort: string | null }>(
      `SELECT MAX(sort_order) AS max_sort FROM tpm_cards
       WHERE plan_id = $1 AND tenant_id = $2 AND is_active = 1`,
      [planId, tenantId],
    );
    const maxSort = Number.parseInt(result.rows[0]?.max_sort ?? '0', 10);
    return maxSort + 1;
  }

  /** Guard: max cards per interval type per plan (spam protection) */
  private async assertCardLimitNotReached(
    client: PoolClient,
    tenantId: number,
    planId: number,
    intervalType: TpmIntervalType,
  ): Promise<void> {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tpm_cards
       WHERE plan_id = $1 AND tenant_id = $2
         AND interval_type = $3 AND is_active = 1`,
      [planId, tenantId, intervalType],
    );
    const count = Number.parseInt(result.rows[0]?.count ?? '0', 10);

    if (count >= MAX_CARDS_PER_PLAN_INTERVAL) {
      throw new ConflictException(
        `Maximale Kartenanzahl (${MAX_CARDS_PER_PLAN_INTERVAL}) für dieses Intervall erreicht. ` +
          'Bitte kontaktieren Sie Ihren Admin.',
      );
    }
  }

  /** Lock a card row by UUID (SELECT ... FOR UPDATE) */
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

  /** Execute a paginated card query with dynamic WHERE clause */
  private async executePaginatedQuery(
    whereClause: string,
    baseParams: unknown[],
    page: number,
    pageSize: number,
  ): Promise<PaginatedCards> {
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tpm_cards c
       LEFT JOIN tpm_maintenance_plans p ON c.plan_id = p.id
       LEFT JOIN assets m ON c.asset_id = m.id AND m.tenant_id = c.tenant_id
       WHERE ${whereClause}`,
      baseParams,
    );
    const total = Number.parseInt(countResult?.count ?? '0', 10);

    const limitIdx = baseParams.length + 1;
    const offsetIdx = baseParams.length + 2;
    const rows = await this.db.query<TpmCardJoinRow>(
      `${CARD_SELECT_SQL}
       WHERE ${whereClause}
       ORDER BY c.interval_order ASC, c.sort_order ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...baseParams, pageSize, offset],
    );

    return {
      data: rows.map(mapCardRowToApi),
      total,
      page,
      pageSize,
    };
  }
}

/** Map DTO + plan context → INSERT data object (pure function) */
function buildCardInsertData(
  dto: CreateCardDto,
  planCtx: { planId: number; assetId: number },
  meta: {
    tenantId: number;
    cardCode: string;
    sortOrder: number;
    createdBy: number;
  },
): Parameters<TpmCardsService['executeCardInsert']>[1] {
  return {
    tenantId: meta.tenantId,
    planId: planCtx.planId,
    assetId: planCtx.assetId,
    cardCode: meta.cardCode,
    sortOrder: meta.sortOrder,
    createdBy: meta.createdBy,
    cardRole: dto.cardRole,
    intervalType: dto.intervalType,
    intervalOrder: INTERVAL_ORDER_MAP[dto.intervalType],
    title: dto.title,
    description: dto.description ?? null,
    locationDescription: dto.locationDescription ?? null,
    requiresApproval: dto.requiresApproval,
    customIntervalDays: dto.customIntervalDays ?? null,
    weekdayOverride: dto.weekdayOverride ?? null,
    estimatedExecutionMinutes: dto.estimatedExecutionMinutes ?? null,
    cardCategories: dto.cardCategories,
  };
}

/** Build dynamic WHERE clauses from filters (pure function) */
function buildFilterClauses(
  filters: CardListFilter,
  startIndex: number,
): { whereClauses: string[]; params: unknown[] } {
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;

  const addFilter = (column: string, value: unknown): void => {
    whereClauses.push(`${column} = $${idx}`);
    params.push(value);
    idx++;
  };

  if (filters.status !== undefined) addFilter('c.status', filters.status);
  if (filters.intervalType !== undefined) {
    addFilter('c.interval_type', filters.intervalType);
  }
  if (filters.cardRole !== undefined)
    addFilter('c.card_role', filters.cardRole);
  if (filters.cardCategory !== undefined) {
    whereClauses.push(
      `c.card_categories @> ARRAY[$${idx}]::tpm_card_category[]`,
    );
    params.push(filters.cardCategory);
    idx++;
  }

  return { whereClauses, params };
}
