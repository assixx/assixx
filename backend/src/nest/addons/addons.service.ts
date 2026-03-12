/**
 * Addons Service (ADR-033)
 *
 * Business logic for addon management.
 * Replaces FeaturesService with addon-aware logic:
 *   - Core addons (is_core=true) → always accessible, no subscription needed
 *   - Purchasable addons → managed via tenant_addons with trial/status lifecycle
 *   - Deactivation preserves user permissions (unlike old FeaturesService)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

type TenantAddonStatus = 'trial' | 'active' | 'expired' | 'cancelled';

interface DbAddonRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_monthly: string | number | null;
  is_active: number;
  requires_setup: boolean;
  icon: string | null;
  sort_order: number;
  is_core: boolean;
  trial_days: number | null;
  created_at: Date;
  updated_at: Date;
}

interface DbTenantAddonJoinRow {
  addon_id: number;
  addon_code: string;
  addon_name: string;
  addon_description: string | null;
  is_core: boolean;
  price_monthly: string | number | null;
  trial_days: number | null;
  ta_id: string | null;
  tenant_id: number | null;
  status: TenantAddonStatus | null;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  activated_at: Date | null;
  deactivated_at: Date | null;
  custom_price: string | number | null;
  ta_is_active: number | null;
}

interface DbUsageStatsRow {
  date: Date;
  usage_count: number;
  unique_users: number;
}

interface DbTenantRow {
  id: number;
  subdomain: string;
  company_name: string;
  status: string;
}

export interface Addon {
  id: number;
  code: string;
  name: string;
  description?: string;
  priceMonthly?: number;
  isActive: boolean;
  isCore: boolean;
  trialDays?: number;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AddonWithTenantStatus extends Addon {
  tenantStatus?: {
    status: TenantAddonStatus | 'not_activated';
    isActive: boolean;
    trialEndsAt?: string;
    activatedAt?: string;
  };
}

export interface AddonStatus {
  addonCode: string;
  isCore: boolean;
  status: TenantAddonStatus | 'not_activated' | 'core_always_active';
  trialEndsAt?: string;
  activatedAt?: string;
  daysRemaining?: number;
}

export interface UsageStats {
  date: string;
  addonCode: string;
  usageCount: number;
  uniqueUsers: number;
}

export interface TenantAddonsSummary {
  tenantId: number;
  coreAddons: number;
  activeAddons: number;
  trialAddons: number;
  cancelledAddons: number;
  monthlyCost: number;
}

export interface TenantWithAddons {
  id: number;
  subdomain: string;
  companyName: string;
  status: string;
  addonSummary: {
    coreAddons: number;
    activeAddons: number;
    trialAddons: number;
    cancelledAddons: number;
    monthlyCost: number;
  };
}

@Injectable()
export class AddonsService {
  private readonly logger = new Logger(AddonsService.name);

  constructor(private readonly db: DatabaseService) {}

  private mapDbAddonToApi(row: DbAddonRow): Addon {
    const addon: Addon = {
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active === IS_ACTIVE.ACTIVE,
      isCore: row.is_core,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };

    if (row.description !== null) {
      addon.description = row.description;
    }
    if (row.price_monthly !== null) {
      addon.priceMonthly = Number.parseFloat(String(row.price_monthly));
    }
    if (row.trial_days !== null) {
      addon.trialDays = row.trial_days;
    }
    if (row.icon !== null) {
      addon.icon = row.icon;
    }

    return addon;
  }

  private mapJoinRowToAddonWithStatus(
    row: DbTenantAddonJoinRow,
  ): AddonWithTenantStatus {
    const addon: AddonWithTenantStatus = {
      id: row.addon_id,
      code: row.addon_code,
      name: row.addon_name,
      isActive: true,
      isCore: row.is_core,
      sortOrder: 0,
      createdAt: '',
      updatedAt: '',
    };

    if (row.addon_description !== null) {
      addon.description = row.addon_description;
    }
    if (row.price_monthly !== null) {
      addon.priceMonthly = Number.parseFloat(String(row.price_monthly));
    }
    if (row.trial_days !== null) {
      addon.trialDays = row.trial_days;
    }

    addon.tenantStatus = this.buildTenantStatus(row);
    return addon;
  }

  private buildTenantStatus(
    row: DbTenantAddonJoinRow,
  ): NonNullable<AddonWithTenantStatus['tenantStatus']> {
    if (row.is_core) {
      return { status: 'active', isActive: true };
    }

    if (row.ta_id === null) {
      return { status: 'not_activated', isActive: false };
    }

    const result: NonNullable<AddonWithTenantStatus['tenantStatus']> = {
      status: row.status ?? 'not_activated',
      isActive: Number(row.ta_is_active) === IS_ACTIVE.ACTIVE,
    };

    if (row.trial_ends_at !== null) {
      result.trialEndsAt = new Date(row.trial_ends_at).toISOString();
    }
    if (row.activated_at !== null) {
      result.activatedAt = new Date(row.activated_at).toISOString();
    }

    return result;
  }

  async getAllAddons(includeInactive: boolean = false): Promise<Addon[]> {
    this.logger.debug(
      `Getting all addons (includeInactive: ${includeInactive})`,
    );

    const whereClause: string =
      includeInactive ? '' : `WHERE is_active = ${IS_ACTIVE.ACTIVE}`;

    const rows = await this.db.query<DbAddonRow>(
      `SELECT * FROM addons ${whereClause} ORDER BY sort_order, name`,
    );

    return rows.map((row: DbAddonRow) => this.mapDbAddonToApi(row));
  }

  async getAddonByCode(code: string): Promise<Addon | null> {
    this.logger.debug(`Getting addon by code: ${code}`);

    const row = await this.db.queryOne<DbAddonRow>(
      'SELECT * FROM addons WHERE code = $1',
      [code],
    );

    return row !== null ? this.mapDbAddonToApi(row) : null;
  }

  /** All addons with per-tenant status (for addon store UI). */
  async getAvailableAddons(tenantId: number): Promise<AddonWithTenantStatus[]> {
    this.logger.debug(`Getting available addons for tenant ${tenantId}`);

    const rows = await this.db.query<DbTenantAddonJoinRow>(
      `SELECT
         a.id AS addon_id, a.code AS addon_code, a.name AS addon_name,
         a.description AS addon_description,
         a.is_core, a.price_monthly, a.trial_days,
         ta.id AS ta_id, ta.tenant_id, ta.status,
         ta.trial_started_at, ta.trial_ends_at, ta.activated_at,
         ta.deactivated_at, ta.custom_price,
         ta.is_active AS ta_is_active
       FROM addons a
       LEFT JOIN tenant_addons ta ON a.id = ta.addon_id AND ta.tenant_id = $1
       WHERE a.is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY a.sort_order, a.name`,
      [tenantId],
    );

    return rows.map((row: DbTenantAddonJoinRow) =>
      this.mapJoinRowToAddonWithStatus(row),
    );
  }

  /** Activate a purchasable addon for a tenant (starts trial or reactivates). */
  async activateAddon(
    tenantId: number,
    addonCode: string,
    _activatedBy: number,
  ): Promise<AddonStatus> {
    this.logger.log(`Activating addon ${addonCode} for tenant ${tenantId}`);

    const addon = await this.resolveAddon(addonCode);

    if (addon.is_core) {
      throw new BadRequestException(
        `Addon "${addonCode}" is a core addon and always active`,
      );
    }

    return await this.upsertTenantAddon(tenantId, addon);
  }

  private async resolveAddon(addonCode: string): Promise<DbAddonRow> {
    const row = await this.db.queryOne<DbAddonRow>(
      'SELECT * FROM addons WHERE code = $1',
      [addonCode],
    );
    if (row === null) {
      throw new NotFoundException(`Addon "${addonCode}" not found`);
    }
    return row;
  }

  private async upsertTenantAddon(
    tenantId: number,
    addon: DbAddonRow,
  ): Promise<AddonStatus> {
    const trialDays: number = addon.trial_days ?? 30;

    const rows = await this.db.query<{ id: string; status: TenantAddonStatus }>(
      'SELECT id, status FROM tenant_addons WHERE tenant_id = $1 AND addon_id = $2',
      [tenantId, addon.id],
    );
    const existing = rows[0];

    if (existing !== undefined) {
      return await this.reactivateExisting(
        tenantId,
        addon,
        existing,
        trialDays,
      );
    }

    return await this.createTrial(tenantId, addon, trialDays);
  }

  private async reactivateExisting(
    tenantId: number,
    addon: DbAddonRow,
    existing: { id: string; status: TenantAddonStatus },
    trialDays: number,
  ): Promise<AddonStatus> {
    const isReturningFromCancel: boolean =
      existing.status === 'cancelled' || existing.status === 'expired';

    const newStatus: TenantAddonStatus =
      isReturningFromCancel ? 'trial' : 'active';
    const trialEndsAt: Date | null =
      isReturningFromCancel ?
        new Date(Date.now() + trialDays * 86_400_000)
      : null;

    await this.db.query(
      `UPDATE tenant_addons
       SET status = $1, is_active = ${IS_ACTIVE.ACTIVE},
           trial_started_at = CASE WHEN $2::timestamptz IS NOT NULL THEN NOW() ELSE trial_started_at END,
           trial_ends_at = $2, activated_at = NOW(), deactivated_at = NULL, updated_at = NOW()
       WHERE tenant_id = $3 AND addon_id = $4`,
      [newStatus, trialEndsAt, tenantId, addon.id],
    );

    this.logger.log(
      `Addon ${addon.code} reactivated for tenant ${tenantId} (status: ${newStatus})`,
    );

    return this.buildAddonStatus(addon, newStatus, trialEndsAt);
  }

  private async createTrial(
    tenantId: number,
    addon: DbAddonRow,
    trialDays: number,
  ): Promise<AddonStatus> {
    const trialEndsAt: Date = new Date(Date.now() + trialDays * 86_400_000);

    await this.db.query(
      `INSERT INTO tenant_addons
         (tenant_id, addon_id, status, trial_started_at, trial_ends_at, activated_at, is_active, created_at, updated_at)
       VALUES ($1, $2, 'trial', NOW(), $3, NOW(), ${IS_ACTIVE.ACTIVE}, NOW(), NOW())`,
      [tenantId, addon.id, trialEndsAt],
    );

    this.logger.log(
      `Addon ${addon.code} trial started for tenant ${tenantId} (ends: ${trialEndsAt.toISOString()})`,
    );

    return this.buildAddonStatus(addon, 'trial', trialEndsAt);
  }

  private buildAddonStatus(
    addon: DbAddonRow,
    status: TenantAddonStatus | 'not_activated' | 'core_always_active',
    trialEndsAt: Date | null,
  ): AddonStatus {
    const result: AddonStatus = {
      addonCode: addon.code,
      isCore: addon.is_core,
      status,
    };

    if (trialEndsAt !== null) {
      result.trialEndsAt = trialEndsAt.toISOString();
      const msRemaining: number = trialEndsAt.getTime() - Date.now();
      result.daysRemaining = Math.max(0, Math.ceil(msRemaining / 86_400_000));
    }

    return result;
  }

  /**
   * Deactivate a purchasable addon for a tenant.
   * Sets status to 'cancelled' but PRESERVES user permissions (ADR-033).
   */
  async deactivateAddon(
    tenantId: number,
    addonCode: string,
    _deactivatedBy: number,
  ): Promise<void> {
    this.logger.log(`Deactivating addon ${addonCode} for tenant ${tenantId}`);

    const addon = await this.resolveAddon(addonCode);

    if (addon.is_core) {
      throw new BadRequestException(
        `Addon "${addonCode}" is a core addon and cannot be deactivated`,
      );
    }

    const rows = await this.db.query(
      `UPDATE tenant_addons
       SET status = 'cancelled', is_active = ${IS_ACTIVE.INACTIVE},
           deactivated_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND addon_id = $2
       RETURNING id`,
      [tenantId, addon.id],
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        `Addon "${addonCode}" is not activated for this tenant`,
      );
    }

    this.logger.log(
      `Addon ${addonCode} deactivated for tenant ${tenantId} (permissions preserved)`,
    );
  }

  /** Get status of a specific addon for a tenant. */
  async getAddonStatus(
    tenantId: number,
    addonCode: string,
  ): Promise<AddonStatus> {
    const addon = await this.resolveAddon(addonCode);

    if (addon.is_core) {
      return {
        addonCode: addon.code,
        isCore: true,
        status: 'core_always_active',
      };
    }

    const row = await this.db.queryOne<{
      status: TenantAddonStatus;
      trial_ends_at: Date | null;
      activated_at: Date | null;
    }>(
      `SELECT status, trial_ends_at, activated_at
       FROM tenant_addons
       WHERE tenant_id = $1 AND addon_id = $2`,
      [tenantId, addon.id],
    );

    if (row === null) {
      return { addonCode: addon.code, isCore: false, status: 'not_activated' };
    }

    const result: AddonStatus = {
      addonCode: addon.code,
      isCore: false,
      status: row.status,
    };

    if (row.trial_ends_at !== null) {
      result.trialEndsAt = new Date(row.trial_ends_at).toISOString();
      const msRemaining: number =
        new Date(row.trial_ends_at).getTime() - Date.now();
      result.daysRemaining = Math.max(0, Math.ceil(msRemaining / 86_400_000));
    }

    if (row.activated_at !== null) {
      result.activatedAt = new Date(row.activated_at).toISOString();
    }

    return result;
  }

  /** Get addon usage statistics. */
  async getUsageStats(
    tenantId: number,
    addonCode: string,
    startDate: string,
    endDate: string,
  ): Promise<UsageStats[]> {
    this.logger.debug(`Getting usage stats for addon ${addonCode}`);

    const addon = await this.resolveAddon(addonCode);

    const rows = await this.db.query<DbUsageStatsRow>(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*) AS usage_count,
         COUNT(DISTINCT user_id) AS unique_users
       FROM addon_usage_logs
       WHERE tenant_id = $1 AND addon_id = $2
         AND DATE(created_at) BETWEEN $3 AND $4
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [tenantId, addon.id, startDate, endDate],
    );

    return rows.map((row: DbUsageStatsRow) => ({
      date: new Date(row.date).toISOString().split('T')[0] ?? '',
      addonCode,
      usageCount: row.usage_count,
      uniqueUsers: row.unique_users,
    }));
  }

  /** Check if tenant has access to addon (core → true, else check tenant_addons). */
  async checkTenantAccess(
    tenantId: number,
    addonCode: string,
  ): Promise<boolean> {
    const addon = await this.db.queryOne<{ id: number; is_core: boolean }>(
      'SELECT id, is_core FROM addons WHERE code = $1',
      [addonCode],
    );

    if (addon === null) {
      return false;
    }

    if (addon.is_core) {
      return true;
    }

    const row = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM tenant_addons
       WHERE tenant_id = $1 AND addon_id = $2
         AND is_active = ${IS_ACTIVE.ACTIVE}
         AND status IN ('active', 'trial')
         AND (trial_ends_at IS NULL OR trial_ends_at > NOW())`,
      [tenantId, addon.id],
    );

    return row !== null;
  }

  /** Get tenant addons summary with cost calculation. */
  async getTenantAddonsSummary(tenantId: number): Promise<TenantAddonsSummary> {
    this.logger.debug(`Getting tenant addons summary for tenant ${tenantId}`);

    const addons = await this.getAvailableAddons(tenantId);

    const summary: TenantAddonsSummary = {
      tenantId,
      coreAddons: 0,
      activeAddons: 0,
      trialAddons: 0,
      cancelledAddons: 0,
      monthlyCost: 0,
    };

    for (const addon of addons) {
      if (addon.isCore) {
        summary.coreAddons++;
        continue;
      }

      const status: string = addon.tenantStatus?.status ?? 'not_activated';
      switch (status) {
        case 'active':
          summary.activeAddons++;
          summary.monthlyCost += addon.priceMonthly ?? 0;
          break;
        case 'trial':
          summary.trialAddons++;
          break;
        case 'cancelled':
        case 'expired':
          summary.cancelledAddons++;
          break;
      }
    }

    return summary;
  }

  /** Get all tenants with their addon summaries (root only). */
  async getAllTenantsWithAddons(): Promise<TenantWithAddons[]> {
    this.logger.debug('Getting all tenants with addons');

    const tenants = await this.db.query<DbTenantRow>(
      'SELECT id, subdomain, company_name, status FROM tenants ORDER BY company_name',
    );

    const results: TenantWithAddons[] = [];

    for (const tenant of tenants) {
      const summary = await this.getTenantAddonsSummary(tenant.id);
      results.push({
        id: tenant.id,
        subdomain: tenant.subdomain,
        companyName: tenant.company_name,
        status: tenant.status,
        addonSummary: {
          coreAddons: summary.coreAddons,
          activeAddons: summary.activeAddons,
          trialAddons: summary.trialAddons,
          cancelledAddons: summary.cancelledAddons,
          monthlyCost: summary.monthlyCost,
        },
      });
    }

    return results;
  }
}
