/**
 * Rotation Pattern Service
 *
 * Handles CRUD operations for shift rotation patterns
 * and UUID-based pattern resolution.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { dbToApi } from '../../utils/fieldMapper.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateRotationPatternDto } from './dto/create-rotation-pattern.dto.js';
import type { UpdateRotationPatternDto } from './dto/update-rotation-pattern.dto.js';
import type {
  DbPatternRow,
  RotationPatternResponse,
} from './rotation.types.js';

@Injectable()
export class RotationPatternService {
  private readonly logger = new Logger(RotationPatternService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Parse pattern config from database (JSON string or object)
   */
  private parsePatternConfig(
    config: Record<string, unknown> | string,
  ): Record<string, unknown> {
    if (typeof config === 'string') {
      return JSON.parse(config) as Record<string, unknown>;
    }
    return config;
  }

  /**
   * Format date to ISO date string (YYYY-MM-DD)
   */
  private formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      return date.split('T')[0] ?? date;
    }
    return date.toISOString().split('T')[0] ?? '';
  }

  /**
   * Convert DB pattern row to API response
   */
  private patternRowToResponse(row: DbPatternRow): RotationPatternResponse {
    const apiData = dbToApi(row as unknown as Record<string, unknown>);
    return {
      ...apiData,
      patternConfig: this.parsePatternConfig(row.pattern_config),
      isActive: row.is_active === 1,
      startsAt: this.formatDate(row.starts_at),
      endsAt: row.ends_at === null ? null : this.formatDate(row.ends_at),
    } as RotationPatternResponse;
  }

  // ============================================================
  // PATTERN CRUD
  // ============================================================

  /**
   * Get all rotation patterns
   */
  async getRotationPatterns(
    tenantId: number,
    activeOnly: boolean = true,
  ): Promise<RotationPatternResponse[]> {
    this.logger.debug(`Getting rotation patterns for tenant ${tenantId}`);

    let query = `
      SELECT
        p.*,
        u.username as created_by_name
      FROM shift_rotation_patterns p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.tenant_id = $1
    `;

    const params: (number | string)[] = [tenantId];

    if (activeOnly) {
      query += ' AND p.is_active = 1';
    }

    query += ' ORDER BY p.created_at DESC';

    const rows = await this.databaseService.query<DbPatternRow>(query, params);
    return rows.map((row: DbPatternRow) => this.patternRowToResponse(row));
  }

  /**
   * Get single rotation pattern by ID
   */
  async getRotationPattern(
    patternId: number,
    tenantId: number,
  ): Promise<RotationPatternResponse> {
    this.logger.debug(
      `Getting rotation pattern ${patternId} for tenant ${tenantId}`,
    );

    const query = `
      SELECT
        p.*,
        u.username as created_by_name
      FROM shift_rotation_patterns p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1 AND p.tenant_id = $2
    `;

    const rows = await this.databaseService.query<DbPatternRow>(query, [
      patternId,
      tenantId,
    ]);

    if (rows.length === 0 || rows[0] === undefined) {
      throw new NotFoundException(`Rotation pattern ${patternId} not found`);
    }

    return this.patternRowToResponse(rows[0]);
  }

  /**
   * Ensures no active pattern with the same name exists
   */
  private async ensureUniquePatternName(
    name: string,
    tenantId: number,
  ): Promise<void> {
    const existing = await this.databaseService.query<{ id: number }>(
      'SELECT id FROM shift_rotation_patterns WHERE name = $1 AND tenant_id = $2 AND is_active = 1',
      [name, tenantId],
    );
    if (existing.length > 0 && existing[0] !== undefined) {
      throw new ConflictException(
        `Ein Rotationsmuster mit dem Namen "${name}" existiert bereits.`,
      );
    }
  }

  /**
   * Create rotation pattern
   */
  async createRotationPattern(
    dto: CreateRotationPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationPatternResponse> {
    this.logger.debug(`Creating rotation pattern for tenant ${tenantId}`);
    await this.ensureUniquePatternName(dto.name, tenantId);

    // is_active is SMALLINT: 0=inactive, 1=active
    const isActiveValue = dto.isActive ? 1 : 0;
    const patternUuid = uuidv7();

    const insertQuery = `
      INSERT INTO shift_rotation_patterns (
        tenant_id, team_id, name, description, pattern_type,
        pattern_config, cycle_length_weeks, starts_at,
        ends_at, is_active, created_by, uuid, uuid_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id
    `;

    const result = await this.databaseService.query<{ id: number }>(
      insertQuery,
      [
        tenantId,
        dto.teamId ?? null,
        dto.name,
        dto.description ?? null,
        dto.patternType,
        JSON.stringify(dto.patternConfig),
        dto.cycleLengthWeeks,
        dto.startsAt,
        dto.endsAt ?? null,
        isActiveValue,
        userId,
        patternUuid,
      ],
    );

    if (result[0] === undefined) {
      throw new InternalServerErrorException(
        'Failed to create rotation pattern',
      );
    }

    void this.activityLogger.logCreate(
      tenantId,
      userId,
      'rotation_pattern',
      result[0].id,
      `Rotationsmuster erstellt: ${dto.name}`,
      {
        name: dto.name,
        patternType: dto.patternType,
        cycleLengthWeeks: dto.cycleLengthWeeks,
      },
    );

    return await this.getRotationPattern(result[0].id, tenantId);
  }

  /**
   * Update rotation pattern
   */
  async updateRotationPattern(
    patternId: number,
    dto: UpdateRotationPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationPatternResponse> {
    this.logger.debug(
      `Updating rotation pattern ${patternId} for tenant ${tenantId}`,
    );

    // Check pattern exists
    await this.getRotationPattern(patternId, tenantId);

    // Build dynamic update query
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];

    const addField = (column: string, value: unknown): void => {
      if (value === undefined) return;
      const paramIndex = params.length + 1;
      updates.push(`${column} = $${paramIndex}`);
      params.push(value as string | number | boolean | null);
    };

    addField('name', dto.name);
    addField('description', dto.description ?? null);
    addField('team_id', dto.teamId ?? null);
    if (dto.patternConfig !== undefined) {
      addField('pattern_config', JSON.stringify(dto.patternConfig));
    }
    addField('cycle_length_weeks', dto.cycleLengthWeeks);
    addField('starts_at', dto.startsAt);
    addField('ends_at', dto.endsAt ?? null);
    if (dto.isActive !== undefined) {
      addField('is_active', dto.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const patternIdIndex = params.length + 1;
    const tenantIdIndex = params.length + 2;
    params.push(patternId, tenantId);

    await this.databaseService.query(
      `UPDATE shift_rotation_patterns SET ${updates.join(', ')} WHERE id = $${patternIdIndex} AND tenant_id = $${tenantIdIndex}`,
      params,
    );

    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'rotation_pattern',
      patternId,
      `Rotationsmuster aktualisiert: ${dto.name ?? patternId}`,
      undefined,
      {
        name: dto.name,
        patternType: dto.patternConfig === undefined ? undefined : 'updated',
      },
    );

    return await this.getRotationPattern(patternId, tenantId);
  }

  /**
   * Delete rotation pattern
   */
  async deleteRotationPattern(
    patternId: number,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    this.logger.debug(
      `Deleting rotation pattern ${patternId} for tenant ${tenantId}`,
    );

    // Check pattern exists (and get data for audit log)
    const pattern = await this.getRotationPattern(patternId, tenantId);

    // Delete pattern (cascade will handle assignments and history)
    await this.databaseService.query(
      'DELETE FROM shift_rotation_patterns WHERE id = $1 AND tenant_id = $2',
      [patternId, tenantId],
    );

    void this.activityLogger.logDelete(
      tenantId,
      userId,
      'rotation_pattern',
      patternId,
      `Rotationsmuster gelöscht: ${pattern.name}`,
      { name: pattern.name },
    );
  }

  // ============================================================
  // UUID METHODS
  // ============================================================

  /**
   * Resolve pattern UUID to internal ID
   */
  private async resolvePatternIdByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<number> {
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM shift_rotation_patterns WHERE uuid = $1 AND tenant_id = $2`,
      [uuid, tenantId],
    );
    if (result[0] === undefined) {
      throw new NotFoundException(
        `Rotation pattern with UUID ${uuid} not found`,
      );
    }
    return result[0].id;
  }

  /**
   * Get rotation pattern by UUID
   */
  async getRotationPatternByUuid(
    uuid: string,
    tenantId: number,
  ): Promise<RotationPatternResponse> {
    const patternId = await this.resolvePatternIdByUuid(uuid, tenantId);
    return await this.getRotationPattern(patternId, tenantId);
  }

  /**
   * Update rotation pattern by UUID
   */
  async updateRotationPatternByUuid(
    uuid: string,
    dto: UpdateRotationPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationPatternResponse> {
    const patternId = await this.resolvePatternIdByUuid(uuid, tenantId);
    return await this.updateRotationPattern(patternId, dto, tenantId, userId);
  }

  /**
   * Delete rotation pattern by UUID
   */
  async deleteRotationPatternByUuid(
    uuid: string,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    const patternId = await this.resolvePatternIdByUuid(uuid, tenantId);
    await this.deleteRotationPattern(patternId, tenantId, userId);
  }
}
