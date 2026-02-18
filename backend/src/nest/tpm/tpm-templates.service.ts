/**
 * TPM Templates Service
 *
 * Manages card templates that define default fields for card creation.
 * Templates can be tenant-specific or global defaults.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateTemplateDto } from './dto/create-template.dto.js';
import type { UpdateTemplateDto } from './dto/update-template.dto.js';
import type { TpmCardTemplate, TpmCardTemplateRow } from './tpm.types.js';

/** Map DB row to API response */
function mapTemplateRowToApi(row: TpmCardTemplateRow): TpmCardTemplate {
  return {
    uuid: row.uuid.trim(),
    name: row.name,
    description: row.description,
    defaultFields: row.default_fields,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdAt:
      typeof row.created_at === 'string' ?
        row.created_at
      : new Date(row.created_at).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string' ?
        row.updated_at
      : new Date(row.updated_at).toISOString(),
  };
}

@Injectable()
export class TpmTemplatesService {
  private readonly logger = new Logger(TpmTemplatesService.name);

  constructor(private readonly db: DatabaseService) {}

  /** List all active templates for a tenant */
  async listTemplates(tenantId: number): Promise<TpmCardTemplate[]> {
    const rows = await this.db.query<TpmCardTemplateRow>(
      `SELECT * FROM tpm_card_templates
       WHERE tenant_id = $1 AND is_active = 1
       ORDER BY is_default DESC, name ASC`,
      [tenantId],
    );

    return rows.map(mapTemplateRowToApi);
  }

  /** Get a single template by UUID */
  async getTemplate(
    tenantId: number,
    templateUuid: string,
  ): Promise<TpmCardTemplate> {
    const row = await this.db.queryOne<TpmCardTemplateRow>(
      `SELECT * FROM tpm_card_templates
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1`,
      [templateUuid, tenantId],
    );

    if (row === null) {
      throw new NotFoundException(
        `Kartenvorlage ${templateUuid} nicht gefunden`,
      );
    }

    return mapTemplateRowToApi(row);
  }

  /** Create a new card template */
  async createTemplate(
    tenantId: number,
    dto: CreateTemplateDto,
  ): Promise<TpmCardTemplate> {
    this.logger.debug(`Creating template "${dto.name}"`);

    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmCardTemplate> => {
        const result = await client.query<TpmCardTemplateRow>(
          `INSERT INTO tpm_card_templates
             (uuid, tenant_id, name, description, default_fields, is_default, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, 1)
           RETURNING *`,
          [
            uuidv7(),
            tenantId,
            dto.name,
            dto.description ?? null,
            JSON.stringify(dto.defaultFields),
            dto.isDefault,
          ],
        );

        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('INSERT into tpm_card_templates returned no rows');
        }

        return mapTemplateRowToApi(row);
      },
    );
  }

  /** Update an existing card template */
  async updateTemplate(
    tenantId: number,
    templateUuid: string,
    dto: UpdateTemplateDto,
  ): Promise<TpmCardTemplate> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmCardTemplate> => {
        // Verify existence + lock
        const existing = await client.query<TpmCardTemplateRow>(
          `SELECT * FROM tpm_card_templates
           WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
           FOR UPDATE`,
          [templateUuid, tenantId],
        );
        if (existing.rows[0] === undefined) {
          throw new NotFoundException(
            `Kartenvorlage ${templateUuid} nicht gefunden`,
          );
        }

        // Build dynamic SET
        const setClauses: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (dto.name !== undefined) {
          setClauses.push(`name = $${idx++}`);
          params.push(dto.name);
        }
        if (dto.description !== undefined) {
          setClauses.push(`description = $${idx++}`);
          params.push(dto.description);
        }
        if (dto.defaultFields !== undefined) {
          setClauses.push(`default_fields = $${idx++}`);
          params.push(JSON.stringify(dto.defaultFields));
        }
        if (dto.isDefault !== undefined) {
          setClauses.push(`is_default = $${idx++}`);
          params.push(dto.isDefault);
        }

        if (setClauses.length === 0) {
          return mapTemplateRowToApi(existing.rows[0]);
        }

        params.push(templateUuid, tenantId);
        const sql = `UPDATE tpm_card_templates
                     SET ${setClauses.join(', ')}, updated_at = NOW()
                     WHERE uuid = $${idx} AND tenant_id = $${idx + 1} AND is_active = 1
                     RETURNING *`;

        const result = await client.query<TpmCardTemplateRow>(sql, params);
        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('UPDATE tpm_card_templates returned no rows');
        }

        return mapTemplateRowToApi(row);
      },
    );
  }

  /** Soft-delete a template (is_active = 4) */
  async deleteTemplate(tenantId: number, templateUuid: string): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const result = await client.query<{ id: number }>(
          `UPDATE tpm_card_templates
         SET is_active = 4, updated_at = NOW()
         WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
         RETURNING id`,
          [templateUuid, tenantId],
        );

        if (result.rows[0] === undefined) {
          throw new NotFoundException(
            `Kartenvorlage ${templateUuid} nicht gefunden`,
          );
        }
      },
    );
  }
}
