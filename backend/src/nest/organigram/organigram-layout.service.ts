import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { UpsertPositionsDto } from './dto/index.js';
import type { OrgChartPosition, OrgChartPositionRow } from './organigram.types.js';

@Injectable()
export class OrganigramLayoutService {
  private readonly logger = new Logger(OrganigramLayoutService.name);

  constructor(private readonly db: DatabaseService) {}

  async getPositions(tenantId: number): Promise<OrgChartPosition[]> {
    const rows = await this.db.query<OrgChartPositionRow>(
      `SELECT uuid, entity_type, entity_uuid,
              position_x, position_y, width, height
       FROM org_chart_positions
       WHERE tenant_id = $1 AND is_active = 1`,
      [tenantId],
    );

    return rows.map((row: OrgChartPositionRow) => this.mapToPosition(row));
  }

  async upsertPositions(tenantId: number, dto: UpsertPositionsDto): Promise<void> {
    await this.db.tenantTransaction(async (client: PoolClient) => {
      for (const pos of dto.positions) {
        const posUuid = uuidv7();
        await client.query(
          `INSERT INTO org_chart_positions
             (uuid, tenant_id, entity_type, entity_uuid,
              position_x, position_y, width, height,
              is_active, uuid_created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())
           ON CONFLICT (tenant_id, entity_type, entity_uuid)
           DO UPDATE SET
             position_x = EXCLUDED.position_x,
             position_y = EXCLUDED.position_y,
             width = EXCLUDED.width,
             height = EXCLUDED.height,
             updated_at = NOW()`,
          [
            posUuid,
            tenantId,
            pos.entityType,
            pos.entityUuid,
            pos.positionX,
            pos.positionY,
            pos.width,
            pos.height,
          ],
        );
      }
    });

    this.logger.log(
      `Upserted ${String(dto.positions.length)} positions for tenant ${String(tenantId)}`,
    );
  }

  async deletePosition(tenantId: number, entityType: string, entityUuid: string): Promise<void> {
    await this.db.tenantTransaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE org_chart_positions
         SET is_active = 4, updated_at = NOW()
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_uuid = $3`,
        [tenantId, entityType, entityUuid],
      );
    });
  }

  private mapToPosition(row: OrgChartPositionRow): OrgChartPosition {
    return {
      uuid: row.uuid.trim(),
      entityType: row.entity_type,
      entityUuid: row.entity_uuid.trim(),
      positionX: Number(row.position_x),
      positionY: Number(row.position_y),
      width: Number(row.width),
      height: Number(row.height),
    };
  }
}
