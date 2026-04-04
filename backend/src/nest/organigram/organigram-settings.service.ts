import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateHierarchyLabelsDto } from './dto/index.js';
import {
  DEFAULT_HIERARCHY_LABELS,
  DEFAULT_VIEWPORT,
  type HallOverride,
  type HierarchyLabels,
  type OrgViewport,
  type PerimeterAnchor,
} from './organigram.types.js';

interface TenantSettingsRow {
  settings: Record<string, unknown> | null;
}

interface OrgHierarchySettings {
  levels?: Partial<HierarchyLabels>;
}

const SELECT_SETTINGS = 'SELECT settings FROM tenants WHERE id = $1';

@Injectable()
export class OrganigramSettingsService {
  private readonly logger = new Logger(OrganigramSettingsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** Persist merged settings JSONB — single source for all organigramm writes */
  private async persistSettings(
    tenantId: number,
    mergedSettings: Record<string, unknown>,
  ): Promise<void> {
    await this.db.tenantTransaction(async (client: PoolClient) => {
      await client.query('UPDATE tenants SET settings = $1::jsonb WHERE id = $2', [
        JSON.stringify(mergedSettings),
        tenantId,
      ]);
    });
  }

  async getViewport(tenantId: number): Promise<OrgViewport> {
    const rows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    if (rows.length === 0 || rows[0] === undefined) {
      return { ...DEFAULT_VIEWPORT };
    }

    const settings = rows[0].settings;
    if (settings === null) {
      return { ...DEFAULT_VIEWPORT };
    }

    const stored = settings['orgViewport'] as Partial<OrgViewport> | undefined;
    if (stored === undefined) {
      return { ...DEFAULT_VIEWPORT };
    }

    return {
      zoom: stored.zoom ?? DEFAULT_VIEWPORT.zoom,
      panX: stored.panX ?? DEFAULT_VIEWPORT.panX,
      panY: stored.panY ?? DEFAULT_VIEWPORT.panY,
      fontSize: stored.fontSize ?? DEFAULT_VIEWPORT.fontSize,
      ...(stored.nodeWidth !== undefined && { nodeWidth: stored.nodeWidth }),
      ...(stored.nodeHeight !== undefined && { nodeHeight: stored.nodeHeight }),
    };
  }

  async getHallOverrides(tenantId: number): Promise<Record<string, HallOverride>> {
    const rows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const settings = rows[0]?.settings;
    if (settings === null || settings === undefined) return {};

    const stored = settings['orgHallOverrides'] as Record<string, HallOverride> | undefined;
    return stored ?? {};
  }

  async saveHallOverrides(
    tenantId: number,
    overrides: Record<string, HallOverride>,
  ): Promise<void> {
    const settingsRows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = {
      ...currentSettings,
      orgHallOverrides: overrides,
    };

    await this.persistSettings(tenantId, mergedSettings);
  }

  async getHallConnectionAnchors(tenantId: number): Promise<Record<string, PerimeterAnchor>> {
    const rows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const settings = rows[0]?.settings;
    if (settings === null || settings === undefined) return {};

    const stored = settings['orgHallConnectionAnchors'] as
      | Record<string, PerimeterAnchor>
      | undefined;
    return stored ?? {};
  }

  async saveHallConnectionAnchors(
    tenantId: number,
    anchors: Record<string, PerimeterAnchor>,
  ): Promise<void> {
    const settingsRows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = {
      ...currentSettings,
      orgHallConnectionAnchors: anchors,
    };

    await this.persistSettings(tenantId, mergedSettings);
  }

  async saveViewport(tenantId: number, viewport: OrgViewport): Promise<void> {
    const settingsRows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = {
      ...currentSettings,
      orgViewport: viewport,
    };

    await this.persistSettings(tenantId, mergedSettings);
  }

  async getCanvasBg(tenantId: number): Promise<string | null> {
    const rows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const settings = rows[0]?.settings;
    if (settings === null || settings === undefined) return null;

    const stored = settings['orgCanvasBg'] as string | undefined;
    return stored ?? null;
  }

  async saveCanvasBg(tenantId: number, canvasBg: string | null): Promise<void> {
    const settingsRows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = {
      ...currentSettings,
      orgCanvasBg: canvasBg,
    };

    await this.persistSettings(tenantId, mergedSettings);
  }

  async getHierarchyLabels(tenantId: number): Promise<HierarchyLabels> {
    const rows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    if (rows.length === 0 || rows[0] === undefined) {
      return { ...DEFAULT_HIERARCHY_LABELS };
    }

    const settings = rows[0].settings;
    if (settings === null) {
      return { ...DEFAULT_HIERARCHY_LABELS };
    }

    const orgHierarchy = settings['orgHierarchy'] as OrgHierarchySettings | undefined;
    if (orgHierarchy?.levels === undefined) {
      return { ...DEFAULT_HIERARCHY_LABELS };
    }

    return {
      hall: orgHierarchy.levels.hall ?? DEFAULT_HIERARCHY_LABELS.hall,
      area: orgHierarchy.levels.area ?? DEFAULT_HIERARCHY_LABELS.area,
      areaLeadPrefix: orgHierarchy.levels.areaLeadPrefix ?? DEFAULT_HIERARCHY_LABELS.areaLeadPrefix,
      department: orgHierarchy.levels.department ?? DEFAULT_HIERARCHY_LABELS.department,
      departmentLeadPrefix:
        orgHierarchy.levels.departmentLeadPrefix ?? DEFAULT_HIERARCHY_LABELS.departmentLeadPrefix,
      team: orgHierarchy.levels.team ?? DEFAULT_HIERARCHY_LABELS.team,
      teamLeadPrefix: orgHierarchy.levels.teamLeadPrefix ?? DEFAULT_HIERARCHY_LABELS.teamLeadPrefix,
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
      areaLeadPrefix: dto.levels.areaLeadPrefix ?? currentLabels.areaLeadPrefix,
      department: dto.levels.department ?? currentLabels.department,
      departmentLeadPrefix: dto.levels.departmentLeadPrefix ?? currentLabels.departmentLeadPrefix,
      team: dto.levels.team ?? currentLabels.team,
      teamLeadPrefix: dto.levels.teamLeadPrefix ?? currentLabels.teamLeadPrefix,
      asset: dto.levels.asset ?? currentLabels.asset,
    };

    // Read-Merge-Write: read current settings, deep merge, write back
    const settingsRows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);

    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = {
      ...currentSettings,
      orgHierarchy: { levels: mergedLabels },
    };

    await this.persistSettings(tenantId, mergedSettings);

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

  // ==========================================================================
  // Deputy Scope Toggle (ADR-039)
  // ==========================================================================

  /** Read the per-tenant flag: do deputies have equal scope rights as their leads? */
  async getDeputyHasLeadScope(tenantId: number): Promise<boolean> {
    const rows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);
    const settings = rows[0]?.settings;
    if (settings === null || settings === undefined) return false;
    return (settings['deputyHasLeadScope'] as boolean | undefined) ?? false;
  }

  /** Update the per-tenant deputy scope toggle */
  async updateDeputyHasLeadScope(tenantId: number, enabled: boolean): Promise<boolean> {
    const settingsRows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);
    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = { ...currentSettings, deputyHasLeadScope: enabled };
    await this.persistSettings(tenantId, mergedSettings);

    this.logger.log(`Deputy scope toggle set to ${String(enabled)} for tenant ${String(tenantId)}`);
    return enabled;
  }

  // ==========================================================================
  // Swap Requests Toggle (shift_planning addon)
  // ==========================================================================

  /** Read the per-tenant flag: are shift swap requests enabled? */
  async getSwapRequestsEnabled(tenantId: number): Promise<boolean> {
    const rows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);
    const settings = rows[0]?.settings;
    if (settings === null || settings === undefined) return false;
    return (settings['swapRequestsEnabled'] as boolean | undefined) ?? false;
  }

  /** Update the per-tenant swap requests toggle */
  async updateSwapRequestsEnabled(tenantId: number, enabled: boolean): Promise<boolean> {
    const settingsRows = await this.db.query<TenantSettingsRow>(SELECT_SETTINGS, [tenantId]);
    const currentSettings =
      settingsRows.length > 0 && settingsRows[0] !== undefined ?
        (settingsRows[0].settings ?? {})
      : {};

    const mergedSettings = { ...currentSettings, swapRequestsEnabled: enabled };
    await this.persistSettings(tenantId, mergedSettings);

    this.logger.log(
      `Swap requests toggle set to ${String(enabled)} for tenant ${String(tenantId)}`,
    );
    return enabled;
  }
}
