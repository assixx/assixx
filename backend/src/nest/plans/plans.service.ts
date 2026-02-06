/**
 * Plans Service (Native NestJS)
 *
 * Business logic for subscription plans.
 * Uses DatabaseService directly - NO Express delegation.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

/**
 * Plan status type
 */
type PlanStatus = 'active' | 'trial' | 'cancelled' | 'expired';

/**
 * Billing cycle type
 */
type BillingCycle = 'monthly' | 'yearly';

/**
 * Addon type
 */
type AddonType = 'employees' | 'admins' | 'storage_gb';

/**
 * Addon status type
 */
type AddonStatus = 'active' | 'cancelled';

/**
 * Database row for plans table
 */
interface DbPlanRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  base_price: number | string;
  max_employees: number | null;
  max_admins: number | null;
  max_storage_gb: number;
  is_active: boolean | number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database row for plan_features join query
 */
interface DbPlanFeatureRow {
  plan_id: number;
  feature_id: number;
  feature_code: string;
  feature_name: string;
  is_included: boolean | number;
}

/**
 * Database row for tenant_plans join query
 */
interface DbTenantPlanRow {
  id: number;
  tenant_id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  status: string;
  started_at: Date;
  expires_at: Date | null;
  custom_price: number | null;
  billing_cycle: string;
}

/**
 * Database row for tenant_addons table
 */
interface DbTenantAddonRow {
  id: number;
  tenant_id: number;
  addon_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
}

/**
 * Database row for addon summary query
 */
interface DbAddonSummaryRow {
  extra_employees: number;
  extra_admins: number;
  extra_storage_gb: number;
}

/**
 * Database row for cost calculation
 */
interface DbCostRow {
  plan_cost: number | string | null;
  addon_cost: number | string;
}

/**
 * API Plan type
 */
export interface Plan {
  id: number;
  code: string;
  name: string;
  description?: string;
  basePrice: number;
  maxEmployees?: number | null;
  maxAdmins?: number | null;
  maxStorageGb: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * API PlanFeature type
 */
export interface PlanFeature {
  planId: number;
  featureId: number;
  featureCode: string;
  featureName: string;
  isIncluded: boolean;
}

/**
 * Plan with features
 */
export interface PlanWithFeatures extends Plan {
  features: PlanFeature[];
}

/**
 * Tenant plan type
 */
export interface TenantPlan {
  id: number;
  tenantId: number;
  planId: number;
  planCode: string;
  planName: string;
  status: PlanStatus;
  startedAt: string;
  expiresAt?: string;
  customPrice?: number;
  billingCycle: BillingCycle;
}

/**
 * Tenant addon type
 */
export interface TenantAddon {
  id: number;
  tenantId: number;
  addonType: AddonType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: AddonStatus;
}

/**
 * Tenant costs type
 */
export interface TenantCosts {
  basePlanCost: number;
  addonsCost: number;
  totalMonthlyCost: number;
  billingCycle: BillingCycle;
  effectivePrice: number;
}

/**
 * Current plan response
 */
export interface CurrentPlanResponse {
  plan: TenantPlan & {
    details: Plan;
    features: PlanFeature[];
  };
  addons: TenantAddon[];
  costs: TenantCosts;
}

/**
 * Tenant addons summary
 */
export interface TenantAddons {
  employees: number;
  admins: number;
  storageGb: number;
}

/**
 * Cost calculation
 */
export interface CostCalculation {
  basePlanCost: number;
  addonCosts: {
    employees: number;
    admins: number;
    storage: number;
  };
  totalMonthlyCost: number;
  currency: string;
}

/**
 * Update addons request
 */
export interface UpdateAddonsRequest {
  employees?: number | undefined;
  admins?: number | undefined;
  storageGb?: number | undefined;
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Map database row to API Plan
   */
  private mapDbPlanToApi(row: DbPlanRow): Plan {
    const plan: Plan = {
      id: row.id,
      code: row.code,
      name: row.name,
      basePrice: Number.parseFloat(String(row.base_price)),
      maxStorageGb: row.max_storage_gb,
      isActive: Boolean(row.is_active),
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };

    if (row.description !== null) {
      plan.description = row.description;
    }

    if (row.max_employees !== null) {
      plan.maxEmployees = row.max_employees;
    }

    if (row.max_admins !== null) {
      plan.maxAdmins = row.max_admins;
    }

    return plan;
  }

  /**
   * Map database row to API PlanFeature
   */
  private mapDbFeatureToApi(row: DbPlanFeatureRow): PlanFeature {
    return {
      planId: row.plan_id,
      featureId: row.feature_id,
      featureCode: row.feature_code,
      featureName: row.feature_name,
      isIncluded: Boolean(row.is_included),
    };
  }

  /**
   * Map database row to API TenantPlan
   */
  private mapDbTenantPlanToApi(row: DbTenantPlanRow): TenantPlan {
    const tenantPlan: TenantPlan = {
      id: row.id,
      tenantId: row.tenant_id,
      planId: row.plan_id,
      planCode: row.plan_code,
      planName: row.plan_name,
      status: row.status as PlanStatus,
      startedAt: new Date(row.started_at).toISOString(),
      billingCycle: row.billing_cycle as BillingCycle,
    };

    if (row.expires_at !== null) {
      tenantPlan.expiresAt = new Date(row.expires_at).toISOString();
    }

    if (row.custom_price !== null) {
      tenantPlan.customPrice = row.custom_price;
    }

    return tenantPlan;
  }

  /**
   * Map database row to API TenantAddon
   */
  private mapDbAddonToApi(row: DbTenantAddonRow): TenantAddon {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      addonType: row.addon_type as AddonType,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      totalPrice: row.total_price,
      status: row.status as AddonStatus,
    };
  }

  /**
   * Get plan features from database
   */
  private async getPlanFeaturesFromDb(planId: number): Promise<PlanFeature[]> {
    const rows = await this.db.query<DbPlanFeatureRow>(
      `
      SELECT
        pf.plan_id,
        pf.feature_id,
        f.code as feature_code,
        f.name as feature_name,
        pf.is_included
      FROM plan_features pf
      JOIN features f ON pf.feature_id = f.id
      WHERE pf.plan_id = $1
      AND f.is_active = 1
      ORDER BY f.category, f.name
      `,
      [planId],
    );

    return rows.map((row: DbPlanFeatureRow) => this.mapDbFeatureToApi(row));
  }

  /**
   * Get all available plans
   */
  async getAllPlans(
    includeInactive: boolean = false,
  ): Promise<PlanWithFeatures[]> {
    this.logger.debug(
      `Getting all plans (includeInactive: ${includeInactive})`,
    );

    const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
    const rows = await this.db.query<DbPlanRow>(
      `SELECT * FROM plans ${whereClause} ORDER BY sort_order ASC`,
    );

    const results: PlanWithFeatures[] = [];

    for (const row of rows) {
      const plan = this.mapDbPlanToApi(row);
      const allFeatures = await this.getPlanFeaturesFromDb(row.id);
      const includedFeatures = allFeatures.filter(
        (f: PlanFeature) => f.isIncluded,
      );

      results.push({
        ...plan,
        features: includedFeatures,
      });
    }

    return results;
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: number): Promise<PlanWithFeatures | null> {
    this.logger.debug(`Getting plan ${planId}`);

    const row = await this.db.queryOne<DbPlanRow>(
      'SELECT * FROM plans WHERE id = $1',
      [planId],
    );

    if (row === null) {
      return null;
    }

    const plan = this.mapDbPlanToApi(row);
    const allFeatures = await this.getPlanFeaturesFromDb(planId);
    const includedFeatures = allFeatures.filter(
      (f: PlanFeature) => f.isIncluded,
    );

    return {
      ...plan,
      features: includedFeatures,
    };
  }

  /**
   * Get plan by code
   */
  private async getPlanByCode(code: string): Promise<DbPlanRow | null> {
    return await this.db.queryOne<DbPlanRow>(
      'SELECT * FROM plans WHERE code = $1 AND is_active = 1',
      [code],
    );
  }

  /**
   * Get current plan for tenant
   */
  async getCurrentPlan(tenantId: number): Promise<CurrentPlanResponse | null> {
    this.logger.debug(`Getting current plan for tenant ${tenantId}`);

    const tenantPlanRow = await this.db.queryOne<DbTenantPlanRow>(
      `
      SELECT
        tp.*,
        p.code as plan_code,
        p.name as plan_name
      FROM tenant_plans tp
      JOIN plans p ON tp.plan_id = p.id
      WHERE tp.tenant_id = $1
      AND tp.status IN ('active', 'trial')
      ORDER BY tp.started_at DESC
      LIMIT 1
      `,
      [tenantId],
    );

    if (tenantPlanRow === null) {
      return null;
    }

    const planRow = await this.getPlanByCode(tenantPlanRow.plan_code);
    if (planRow === null) {
      throw new NotFoundException('Plan details not found');
    }

    const tenantPlan = this.mapDbTenantPlanToApi(tenantPlanRow);
    const planDetails = this.mapDbPlanToApi(planRow);
    const allFeatures = await this.getPlanFeaturesFromDb(tenantPlanRow.plan_id);
    const includedFeatures = allFeatures.filter(
      (f: PlanFeature) => f.isIncluded,
    );

    const addonRows = await this.db.query<DbTenantAddonRow>(
      `SELECT * FROM tenant_addons WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId],
    );
    const addons = addonRows.map((row: DbTenantAddonRow) =>
      this.mapDbAddonToApi(row),
    );

    const costs = await this.calculateTenantCostFromDb(tenantId);

    const apiCosts: TenantCosts = {
      basePlanCost: costs.planCost,
      addonsCost: costs.addonCost,
      totalMonthlyCost: costs.totalCost,
      billingCycle: tenantPlan.billingCycle,
      effectivePrice: costs.totalCost,
    };

    return {
      plan: {
        ...tenantPlan,
        details: planDetails,
        features: includedFeatures,
      },
      addons,
      costs: apiCosts,
    };
  }

  /**
   * Get plan features
   */
  async getPlanFeatures(planId: number): Promise<PlanFeature[]> {
    this.logger.debug(`Getting features for plan ${planId}`);
    return await this.getPlanFeaturesFromDb(planId);
  }

  /**
   * Get tenant addons (simple counts)
   */
  async getTenantAddons(tenantId: number): Promise<TenantAddons> {
    this.logger.debug(`Getting addons for tenant ${tenantId}`);

    const row = await this.db.queryOne<DbAddonSummaryRow>(
      `SELECT
        COALESCE(MAX(CASE WHEN addon_type = 'employees' THEN quantity END), 0) as extra_employees,
        COALESCE(MAX(CASE WHEN addon_type = 'admins' THEN quantity END), 0) as extra_admins,
        COALESCE(MAX(CASE WHEN addon_type = 'storage_gb' THEN quantity END), 0) as extra_storage_gb
      FROM tenant_addons
      WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId],
    );

    if (row === null) {
      return {
        employees: 0,
        admins: 0,
        storageGb: 0,
      };
    }

    return {
      employees: row.extra_employees,
      admins: row.extra_admins,
      storageGb: row.extra_storage_gb,
    };
  }

  /**
   * Update tenant addons
   */
  async updateAddons(
    tenantId: number,
    addons: UpdateAddonsRequest,
    _userId?: number,
  ): Promise<TenantAddons> {
    this.logger.log(`Updating addons for tenant ${tenantId}`);

    const updates: { type: string; quantity: number; unitPrice: number }[] = [];

    if (addons.employees !== undefined) {
      updates.push({
        type: 'employees',
        quantity: addons.employees,
        unitPrice: 5.0,
      });
    }

    if (addons.admins !== undefined) {
      updates.push({
        type: 'admins',
        quantity: addons.admins,
        unitPrice: 10.0,
      });
    }

    if (addons.storageGb !== undefined) {
      updates.push({
        type: 'storage_gb',
        quantity: addons.storageGb,
        unitPrice: 0.1,
      });
    }

    for (const update of updates) {
      await this.db.query(
        `INSERT INTO tenant_addons (tenant_id, addon_type, quantity, unit_price, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (tenant_id, addon_type) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         unit_price = EXCLUDED.unit_price,
         updated_at = NOW()`,
        [tenantId, update.type, update.quantity, update.unitPrice],
      );
    }

    return await this.getTenantAddons(tenantId);
  }

  /**
   * Calculate tenant cost from database
   */
  private async calculateTenantCostFromDb(
    tenantId: number,
  ): Promise<{ planCost: number; addonCost: number; totalCost: number }> {
    const row = await this.db.queryOne<DbCostRow>(
      `
      SELECT
        COALESCE(tp.custom_price, p.base_price) as plan_cost,
        COALESCE(SUM(ta.quantity * ta.unit_price), 0) as addon_cost
      FROM tenants t
      LEFT JOIN tenant_plans tp ON t.id = tp.tenant_id AND tp.status IN ('active', 'trial')
      LEFT JOIN plans p ON tp.plan_id = p.id
      LEFT JOIN tenant_addons ta ON t.id = ta.tenant_id AND ta.status = 'active'
      WHERE t.id = $1
      GROUP BY t.id, tp.custom_price, p.base_price
      `,
      [tenantId],
    );

    if (row === null) {
      return { planCost: 0, addonCost: 0, totalCost: 0 };
    }

    const planCost = Number.parseFloat(String(row.plan_cost ?? 0));
    const addonCost = Number.parseFloat(String(row.addon_cost));

    return {
      planCost,
      addonCost,
      totalCost: planCost + addonCost,
    };
  }

  /**
   * Calculate costs for tenant
   */
  async calculateCosts(tenantId: number): Promise<CostCalculation> {
    this.logger.log(`Calculating costs for tenant ${tenantId}`);

    const costs = await this.calculateTenantCostFromDb(tenantId);
    const addons = await this.getTenantAddons(tenantId);

    return {
      basePlanCost: costs.planCost,
      addonCosts: {
        employees: addons.employees * 5.0,
        admins: addons.admins * 10.0,
        storage: addons.storageGb * 0.1,
      },
      totalMonthlyCost: costs.totalCost,
      currency: 'EUR',
    };
  }

  /**
   * Upgrade/downgrade plan
   */
  async upgradePlan(
    tenantId: number,
    newPlanCode: string,
    effectiveDate?: Date,
    _userId?: number,
  ): Promise<CurrentPlanResponse> {
    this.logger.log(`Upgrading plan for tenant ${tenantId} to ${newPlanCode}`);

    const newPlan = await this.getPlanByCode(newPlanCode);
    if (newPlan === null) {
      throw new NotFoundException(`Plan not found: ${newPlanCode}`);
    }

    const currentPlanRow = await this.db.queryOne<DbTenantPlanRow>(
      `SELECT * FROM tenant_plans WHERE tenant_id = $1 AND status IN ('active', 'trial')`,
      [tenantId],
    );

    if (currentPlanRow === null) {
      throw new NotFoundException('No active plan found for tenant');
    }

    const effectiveDateValue = effectiveDate ?? new Date();

    // Cancel current plan
    await this.db.query(
      `UPDATE tenant_plans
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE tenant_id = $1 AND status IN ('active', 'trial')`,
      [tenantId],
    );

    // Create new plan subscription
    await this.db.query(
      `INSERT INTO tenant_plans (tenant_id, plan_id, status, started_at)
       VALUES ($1, $2, 'active', $3)`,
      [tenantId, newPlan.id, effectiveDateValue],
    );

    // Update tenant's current_plan_id
    await this.db.query(
      'UPDATE tenants SET current_plan_id = $1 WHERE id = $2',
      [newPlan.id, tenantId],
    );

    // Deactivate features not included in new plan
    const planFeatures = await this.getPlanFeaturesFromDb(newPlan.id);
    const includedFeatureIds = planFeatures
      .filter((f: PlanFeature) => f.isIncluded)
      .map((f: PlanFeature) => f.featureId);

    if (includedFeatureIds.length > 0) {
      const { placeholders } = this.db.generateInPlaceholders(
        includedFeatureIds.length,
        2,
      );
      await this.db.query(
        `UPDATE tenant_features
         SET is_active = 0
         WHERE tenant_id = $1
         AND feature_id NOT IN (${placeholders})`,
        [tenantId, ...includedFeatureIds],
      );
    }

    const result = await this.getCurrentPlan(tenantId);
    if (result === null) {
      throw new NotFoundException('Failed to retrieve updated plan');
    }

    return result;
  }
}
