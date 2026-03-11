import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateHierarchyLabelsDto } from './dto/index.js';
import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
} from './organigram.types.js';

interface TenantSettingsRow {
  settings: Record<string, unknown> | null;
}

interface OrgHierarchySettings {
  levels?: Partial<HierarchyLabels>;
}

@Injectable()
export class OrganigramSettingsService {
  private readonly logger = new Logger(OrganigramSettingsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  async getHierarchyLabels(tenantId: number): Promise<HierarchyLabels> {
    const rows = await this.db.query<TenantSettingsRow>(
      'SELECT settings FROM tenants WHERE id = $1',
      [tenantId],
    );

    if (rows.length === 0 || rows[0] === undefined) {
      return { ...DEFAULT_HIERARCHY_LABELS };
    }

    const settings = rows[0].settings;
    if (settings === null) {
      return { ...DEFAULT_HIERARCHY_LABELS };
    }

    const orgHierarchy = settings['orgHierarchy'] as
      | OrgHierarchySettings
      | undefined;
    if (orgHierarchy?.levels === undefined) {
      return { ...DEFAULT_HIERARCHY_LABELS };
    }

    return {
      hall: orgHierarchy.levels.hall ?? DEFAULT_HIERARCHY_LABELS.hall,
      area: orgHierarchy.levels.area ?? DEFAULT_HIERARCHY_LABELS.area,
      department:
        orgHierarchy.levels.department ?? DEFAULT_HIERARCHY_LABELS.department,
      team: orgHierarchy.levels.team ?? DEFAULT_HIERARCHY_LABELS.team,
      asset: orgHierarchy.levels.asset ?? DEFAULT_HIERARCHY_LABELS.asset,
    };
  }

  async updateHierarchyLabels(
    tenantId: number,
    dto: UpdateHierarchyLabelsDto,
  ): Promise<HierarchyLabels> {
    const currentLabels = await this.getHierarchyLabels(tenantId);

    const mergedLabels: HierarchyLabels = {
      hall: dto.levels.hall ?? currentLabels.hall,
      area: dto.levels.area ?? currentLabels.area,
      department: dto.levels.department ?? currentLabels.department,
      team: dto.levels.team ?? currentLabels.team,
      asset: dto.levels.asset ?? currentLabels.asset,
    };

    // Read-Merge-Write: read current settings, deep merge, write back
    const settingsRows = await this.db.query<TenantSettingsRow>(
      'SELECT settings FROM tenants WHERE id = $1',
      [tenantId],
    );

    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = {
      ...currentSettings,
      orgHierarchy: { levels: mergedLabels },
    };

    await this.db.tenantTransaction(async (client: PoolClient) => {
      await client.query(
        'UPDATE tenants SET settings = $1::jsonb WHERE id = $2',
        [JSON.stringify(mergedSettings), tenantId],
      );
    });

    this.logger.log(`Hierarchy labels updated for tenant ${String(tenantId)}`);

    const userId = this.db.getUserId() ?? 0;
    void this.activityLogger.logUpdate(
      tenantId,
      userId,
      'settings',
      tenantId,
      'Hierarchie-Ebenen-Labels aktualisiert',
      currentLabels as unknown as Record<string, unknown>,
      mergedLabels as unknown as Record<string, unknown>,
    );

    return mergedLabels;
  }
}
