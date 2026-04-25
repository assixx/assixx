/**
 * Position Catalog Service
 *
 * CRUD operations for position_catalog table.
 * Lazy-seeds system positions (team_lead, area_lead, department_lead) per tenant.
 * System positions are protected from editing and deletion.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { getErrorMessage } from '../common/index.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreatePositionDto } from './dto/create-position.dto.js';
import type { UpdatePositionDto } from './dto/update-position.dto.js';
import {
  DEFAULT_POSITIONS,
  type PositionCatalogEntry,
  type PositionCatalogRow,
  type PositionRoleCategory,
  SYSTEM_POSITIONS,
  mapPositionRowToApi,
} from './position-catalog.types.js';

const ERROR_POSITION_NOT_FOUND = 'Position nicht gefunden';
const ERROR_SYSTEM_POSITION = 'System-Positionen können nicht bearbeitet werden';

@Injectable()
export class PositionCatalogService {
  private readonly logger = new Logger(PositionCatalogService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  async getAll(
    tenantId: number,
    roleCategory?: PositionRoleCategory,
  ): Promise<PositionCatalogEntry[]> {
    await this.ensureSystemPositions(tenantId);

    const params: (number | string)[] = [tenantId, IS_ACTIVE.ACTIVE];
    let query = `
      SELECT * FROM position_catalog
      WHERE tenant_id = $1 AND is_active = $2
    `;

    if (roleCategory !== undefined) {
      query += ' AND role_category = $3';
      params.push(roleCategory);
    }

    query += ' ORDER BY role_category, sort_order, name';

    const rows = await this.db.tenantQuery<PositionCatalogRow>(query, params);
    return rows.map(mapPositionRowToApi);
  }

  async create(tenantId: number, dto: CreatePositionDto): Promise<PositionCatalogEntry> {
    await this.assertNameUnique(tenantId, dto.name, dto.roleCategory);

    const uuid = uuidv7();
    const rows = await this.db.tenantQuery<PositionCatalogRow>(
      `INSERT INTO position_catalog (id, tenant_id, name, role_category, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [uuid, tenantId, dto.name, dto.roleCategory, dto.sortOrder],
    );

    if (rows[0] === undefined) {
      throw new Error('INSERT returned no rows');
    }

    this.logger.log(`Position "${dto.name}" created for tenant ${String(tenantId)}`);

    const userId = this.db.getUserId() ?? 0;
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'create',
      entityType: 'position_catalog',
      details: `Position "${dto.name}" (${dto.roleCategory}) erstellt [${uuid}]`,
    });

    return mapPositionRowToApi(rows[0]);
  }

  async update(
    tenantId: number,
    positionId: string,
    dto: UpdatePositionDto,
  ): Promise<PositionCatalogEntry> {
    const position = await this.findOneOrFail(tenantId, positionId);

    if (position.is_system) {
      throw new ForbiddenException(ERROR_SYSTEM_POSITION);
    }

    if (dto.name !== undefined) {
      await this.assertNameUnique(tenantId, dto.name, position.role_category, positionId);
    }

    const { setClauses, params } = this.buildUpdateParams(dto, [tenantId, positionId]);

    if (setClauses.length === 0) {
      return mapPositionRowToApi(position);
    }

    const rows = await this.db.tenantQuery<PositionCatalogRow>(
      `UPDATE position_catalog SET ${setClauses.join(', ')}
       WHERE tenant_id = $1 AND id = $2 AND is_active = ${String(IS_ACTIVE.ACTIVE)}
       RETURNING *`,
      params,
    );

    if (rows[0] === undefined) {
      throw new NotFoundException(ERROR_POSITION_NOT_FOUND);
    }

    this.logger.log(`Position "${rows[0].name}" updated for tenant ${String(tenantId)}`);

    const userId = this.db.getUserId() ?? 0;
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'update',
      entityType: 'position_catalog',
      details: `Position aktualisiert [${positionId}]`,
      oldValues: { name: position.name, sort_order: position.sort_order },
      newValues: { name: rows[0].name, sort_order: rows[0].sort_order },
    });

    return mapPositionRowToApi(rows[0]);
  }

  async delete(tenantId: number, positionId: string): Promise<void> {
    const position = await this.findOneOrFail(tenantId, positionId);

    if (position.is_system) {
      throw new ForbiddenException(ERROR_SYSTEM_POSITION);
    }

    try {
      await this.db.tenantQuery(
        `UPDATE position_catalog SET is_active = $1
         WHERE tenant_id = $2 AND id = $3 AND is_active = $4`,
        [IS_ACTIVE.DELETED, tenantId, positionId, IS_ACTIVE.ACTIVE],
      );
    } catch (error: unknown) {
      this.logger.error(`Failed to delete position ${positionId}: ${getErrorMessage(error)}`);
      throw error;
    }

    this.logger.log(`Position "${position.name}" soft-deleted for tenant ${String(tenantId)}`);

    const userId = this.db.getUserId() ?? 0;
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'delete',
      entityType: 'position_catalog',
      details: `Position "${position.name}" gelöscht [${positionId}]`,
    });
  }

  /**
   * Lazy-seeds system + default positions per tenant.
   * Uses ON CONFLICT with partial index predicate — mandatory for PG17.
   * Idempotent and atomic (no race conditions).
   */
  async ensureSystemPositions(tenantId: number): Promise<void> {
    for (const pos of SYSTEM_POSITIONS) {
      await this.db.tenantQuery(
        `INSERT INTO position_catalog (id, tenant_id, name, role_category, is_system)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (tenant_id, name, role_category) WHERE is_active = ${IS_ACTIVE.ACTIVE} DO NOTHING`,
        [uuidv7(), tenantId, pos.name, pos.roleCategory],
      );
    }

    for (const [idx, pos] of DEFAULT_POSITIONS.entries()) {
      await this.db.tenantQuery(
        `INSERT INTO position_catalog (id, tenant_id, name, role_category, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, name, role_category) WHERE is_active = ${IS_ACTIVE.ACTIVE} DO NOTHING`,
        [uuidv7(), tenantId, pos.name, pos.roleCategory, idx + 1],
      );
    }
  }

  private async assertNameUnique(
    tenantId: number,
    name: string,
    roleCategory: PositionRoleCategory,
    excludeId?: string,
  ): Promise<void> {
    const params: (number | string)[] = [tenantId, name, roleCategory, IS_ACTIVE.ACTIVE];
    let query = `SELECT id FROM position_catalog
      WHERE tenant_id = $1 AND name = $2 AND role_category = $3 AND is_active = $4`;

    if (excludeId !== undefined) {
      query += ' AND id != $5';
      params.push(excludeId);
    }

    const rows = await this.db.tenantQuery<PositionCatalogRow>(query, params);
    if (rows.length > 0) {
      throw new ConflictException(
        `Position "${name}" existiert bereits für Kategorie "${roleCategory}"`,
      );
    }
  }

  private buildUpdateParams(
    dto: UpdatePositionDto,
    baseParams: (string | number)[],
  ): { setClauses: string[]; params: (string | number)[] } {
    const setClauses: string[] = [];
    const params = [...baseParams];
    let idx = baseParams.length + 1;

    if (dto.name !== undefined) {
      setClauses.push(`name = $${String(idx)}`);
      params.push(dto.name);
      idx++;
    }

    if (dto.sortOrder !== undefined) {
      setClauses.push(`sort_order = $${String(idx)}`);
      params.push(dto.sortOrder);
    }

    return { setClauses, params };
  }

  private async findOneOrFail(tenantId: number, positionId: string): Promise<PositionCatalogRow> {
    const rows = await this.db.tenantQuery<PositionCatalogRow>(
      `SELECT * FROM position_catalog
       WHERE tenant_id = $1 AND id = $2 AND is_active = $3`,
      [tenantId, positionId, IS_ACTIVE.ACTIVE],
    );

    if (rows[0] === undefined) {
      throw new NotFoundException(ERROR_POSITION_NOT_FOUND);
    }

    return rows[0];
  }
}
