/**
 * TPM Locations Service
 *
 * Manages structured location descriptions per TPM maintenance plan.
 * Each location has a position number (1-200), title, description, and optional photo.
 * Replaces the free-text locationDescription on cards with reusable, photo-documented references.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateLocationDto } from './dto/create-location.dto.js';
import type { UpdateLocationDto } from './dto/update-location.dto.js';
import type { TpmLocation, TpmLocationRow } from './tpm.types.js';

/** File metadata for photo uploads */
export interface LocationPhotoData {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/** Map DB row → API response */
function mapLocationRowToApi(
  row: TpmLocationRow & { plan_uuid?: string; created_by_name?: string },
): TpmLocation {
  const location: TpmLocation = {
    uuid: row.uuid.trim(),
    positionNumber: row.position_number,
    title: row.title,
    description: row.description,
    photoPath: row.photo_path,
    photoFileName: row.photo_file_name,
    photoFileSize: row.photo_file_size,
    photoMimeType: row.photo_mime_type,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt:
      typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString(),
  };

  if (row.plan_uuid !== undefined) {
    location.planUuid = row.plan_uuid.trim();
  }
  if (row.created_by_name !== undefined) {
    location.createdByName = row.created_by_name;
  }

  return location;
}

@Injectable()
export class TpmLocationsService {
  private readonly logger = new Logger(TpmLocationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** List all active locations for a plan, ordered by position_number */
  async listLocations(tenantId: number, planUuid: string): Promise<TpmLocation[]> {
    type JoinRow = TpmLocationRow & {
      plan_uuid: string;
      created_by_name: string;
    };
    const rows = await this.db.tenantQuery<JoinRow>(
      `SELECT l.*, p.uuid AS plan_uuid,
              COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ' '), u.username) AS created_by_name
       FROM tpm_locations l
       JOIN tpm_maintenance_plans p ON l.plan_id = p.id
       LEFT JOIN users u ON l.created_by = u.id
       WHERE p.uuid = $1 AND l.tenant_id = $2 AND l.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY l.position_number ASC`,
      [planUuid, tenantId],
    );

    return rows.map(mapLocationRowToApi);
  }

  /** Get a single location by UUID */
  async getLocation(tenantId: number, locationUuid: string): Promise<TpmLocation> {
    type JoinRow = TpmLocationRow & {
      plan_uuid: string;
      created_by_name: string;
    };
    const row = await this.db.tenantQueryOne<JoinRow>(
      `SELECT l.*, p.uuid AS plan_uuid,
              COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ' '), u.username) AS created_by_name
       FROM tpm_locations l
       JOIN tpm_maintenance_plans p ON l.plan_id = p.id
       LEFT JOIN users u ON l.created_by = u.id
       WHERE l.uuid = $1 AND l.tenant_id = $2 AND l.is_active = ${IS_ACTIVE.ACTIVE}`,
      [locationUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(`Standort ${locationUuid} nicht gefunden`);
    }

    return mapLocationRowToApi(row);
  }

  /** Create a new location */
  async createLocation(
    tenantId: number,
    userId: number,
    dto: CreateLocationDto,
  ): Promise<TpmLocation> {
    this.logger.debug(`Creating location #${dto.positionNumber} for plan ${dto.planUuid}`);

    return await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmLocation> => {
      const planId = await this.resolvePlanId(client, tenantId, dto.planUuid);

      const result = await client.query<TpmLocationRow>(
        `INSERT INTO tpm_locations
             (uuid, tenant_id, plan_id, position_number, title, description, is_active, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
           RETURNING *`,
        [
          uuidv7(),
          tenantId,
          planId,
          dto.positionNumber,
          dto.title,
          dto.description ?? null,
          userId,
        ],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('INSERT into tpm_locations returned no rows');
      }

      void this.activityLogger.logCreate(
        tenantId,
        userId,
        'asset',
        0,
        `TPM-Standort erstellt: #${dto.positionNumber} ${dto.title}`,
        { uuid: row.uuid.trim(), positionNumber: dto.positionNumber },
      );

      return mapLocationRowToApi(row);
    });
  }

  /** Update an existing location */
  async updateLocation(
    tenantId: number,
    userId: number,
    locationUuid: string,
    dto: UpdateLocationDto,
  ): Promise<TpmLocation> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmLocation> => {
      const existing = await this.lockLocationByUuid(client, tenantId, locationUuid);

      const setClauses: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (dto.positionNumber !== undefined) {
        setClauses.push(`position_number = $${idx++}`);
        params.push(dto.positionNumber);
      }
      if (dto.title !== undefined) {
        setClauses.push(`title = $${idx++}`);
        params.push(dto.title);
      }
      if (dto.description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        params.push(dto.description);
      }

      if (setClauses.length === 0) {
        return mapLocationRowToApi(existing);
      }

      params.push(locationUuid, tenantId);
      const sql = `UPDATE tpm_locations
                     SET ${setClauses.join(', ')}, updated_at = NOW()
                     WHERE uuid = $${idx} AND tenant_id = $${idx + 1} AND is_active = ${IS_ACTIVE.ACTIVE}
                     RETURNING *`;

      const result = await client.query<TpmLocationRow>(sql, params);
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('UPDATE tpm_locations returned no rows');
      }

      void this.activityLogger.logUpdate(
        tenantId,
        userId,
        'asset',
        0,
        `TPM-Standort aktualisiert: ${locationUuid}`,
        undefined,
        {
          uuid: locationUuid,
          positionNumber: dto.positionNumber,
          title: dto.title,
          description: dto.description,
        },
      );

      return mapLocationRowToApi(row);
    });
  }

  /** Soft-delete a location (is_active = 4) */
  async deleteLocation(tenantId: number, userId: number, locationUuid: string): Promise<void> {
    await this.db.tenantTransaction(async (client: PoolClient): Promise<void> => {
      const result = await client.query<{ id: number }>(
        `UPDATE tpm_locations
           SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
           RETURNING id`,
        [locationUuid, tenantId],
      );

      if (result.rows[0] === undefined) {
        throw new NotFoundException(`Standort ${locationUuid} nicht gefunden`);
      }

      void this.activityLogger.logDelete(
        tenantId,
        userId,
        'asset',
        0,
        `TPM-Standort gelöscht: ${locationUuid}`,
        { uuid: locationUuid },
      );
    });
  }

  /** Set photo metadata on a location */
  async setPhoto(
    tenantId: number,
    userId: number,
    locationUuid: string,
    photo: LocationPhotoData,
  ): Promise<TpmLocation> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmLocation> => {
      await this.lockLocationByUuid(client, tenantId, locationUuid);

      const result = await client.query<TpmLocationRow>(
        `UPDATE tpm_locations
           SET photo_path = $1, photo_file_name = $2, photo_file_size = $3,
               photo_mime_type = $4, updated_at = NOW()
           WHERE uuid = $5 AND tenant_id = $6 AND is_active = ${IS_ACTIVE.ACTIVE}
           RETURNING *`,
        [photo.filePath, photo.fileName, photo.fileSize, photo.mimeType, locationUuid, tenantId],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new NotFoundException(`Standort ${locationUuid} nicht gefunden`);
      }

      void this.activityLogger.logUpdate(
        tenantId,
        userId,
        'asset',
        0,
        `TPM-Standort Foto aktualisiert: ${locationUuid}`,
        undefined,
        { uuid: locationUuid, fileName: photo.fileName },
      );

      return mapLocationRowToApi(row);
    });
  }

  /** Remove photo from a location */
  async removePhoto(tenantId: number, userId: number, locationUuid: string): Promise<TpmLocation> {
    return await this.db.tenantTransaction(async (client: PoolClient): Promise<TpmLocation> => {
      await this.lockLocationByUuid(client, tenantId, locationUuid);

      const result = await client.query<TpmLocationRow>(
        `UPDATE tpm_locations
           SET photo_path = NULL, photo_file_name = NULL, photo_file_size = NULL,
               photo_mime_type = NULL, updated_at = NOW()
           WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
           RETURNING *`,
        [locationUuid, tenantId],
      );

      const row = result.rows[0];
      if (row === undefined) {
        throw new NotFoundException(`Standort ${locationUuid} nicht gefunden`);
      }

      void this.activityLogger.logUpdate(
        tenantId,
        userId,
        'asset',
        0,
        `TPM-Standort Foto entfernt: ${locationUuid}`,
        undefined,
        { uuid: locationUuid },
      );

      return mapLocationRowToApi(row);
    });
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /** Resolve plan UUID → ID with existence check */
  private async resolvePlanId(
    client: PoolClient,
    tenantId: number,
    planUuid: string,
  ): Promise<number> {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM tpm_maintenance_plans
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [planUuid, tenantId],
    );

    if (result.rows[0] === undefined) {
      throw new NotFoundException(`Wartungsplan ${planUuid} nicht gefunden`);
    }

    return result.rows[0].id;
  }

  /** Lock a location row for update, throw if not found */
  private async lockLocationByUuid(
    client: PoolClient,
    tenantId: number,
    locationUuid: string,
  ): Promise<TpmLocationRow> {
    const result = await client.query<TpmLocationRow>(
      `SELECT * FROM tpm_locations
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
       FOR UPDATE`,
      [locationUuid, tenantId],
    );

    if (result.rows[0] === undefined) {
      throw new NotFoundException(`Standort ${locationUuid} nicht gefunden`);
    }

    return result.rows[0];
  }
}
