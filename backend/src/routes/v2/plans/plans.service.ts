import { executeQuery as query } from "../../../config/database";
import PlanModel from "../../../models/plan";
import RootLog from "../../../models/rootLog";

import {
  Plan,
  PlanFeature,
  PlanWithFeatures,
  TenantPlan,
  TenantAddon,
  TenantAddons,
  TenantCosts,
  CurrentPlanResponse,
  UpdateAddonsRequest,
  CostCalculation,
  DbPlan,
  DbPlanFeature,
  DbTenantPlan,
  DbTenantAddon,
  DbAddonResult,
} from "./types";

// Type helper to cast Model types to our types
type ModelDbPlan = DbPlan & { description?: string };
type ModelDbTenantPlan = DbTenantPlan & { expires_at?: Date | null };

export class PlansService {
  /**
   * Convert DB plan to API format (snake_case to camelCase)
   */
  private static dbToApiPlan(dbPlan: DbPlan): Plan {
    return {
      id: dbPlan.id,
      code: dbPlan.code,
      name: dbPlan.name,
      description: dbPlan.description,
      basePrice: parseFloat(String(dbPlan.base_price)),
      maxEmployees: dbPlan.max_employees ?? 0,
      maxAdmins: dbPlan.max_admins ?? 0,
      maxStorageGb: dbPlan.max_storage_gb ?? 0,
      isActive: Boolean(dbPlan.is_active),
      sortOrder: dbPlan.sort_order,
      createdAt: dbPlan.created_at.toISOString(),
      updatedAt: dbPlan.updated_at.toISOString(),
    };
  }

  /**
   * Convert DB plan feature to API format
   */
  private static dbToApiFeature(dbFeature: DbPlanFeature): PlanFeature {
    return {
      planId: dbFeature.plan_id,
      featureId: dbFeature.feature_id,
      featureCode: dbFeature.feature_code,
      featureName: dbFeature.feature_name,
      isIncluded: Boolean(dbFeature.is_included),
    };
  }

  /**
   * Convert DB tenant plan to API format
   */
  private static dbToApiTenantPlan(dbPlan: DbTenantPlan): TenantPlan {
    return {
      id: dbPlan.id,
      tenantId: dbPlan.tenant_id,
      planId: dbPlan.plan_id,
      planCode: dbPlan.plan_code,
      planName: dbPlan.plan_name,
      status: dbPlan.status as "active" | "cancelled" | "trial" | "expired",
      startedAt: dbPlan.started_at.toISOString(),
      expiresAt: dbPlan.expires_at?.toISOString(),
      customPrice: dbPlan.custom_price ?? undefined,
      billingCycle: dbPlan.billing_cycle as "monthly" | "yearly",
    };
  }

  /**
   * Convert DB addon to API format
   */
  private static dbToApiAddon(dbAddon: DbTenantAddon): TenantAddon {
    return {
      id: dbAddon.id,
      tenantId: dbAddon.tenant_id,
      addonType: dbAddon.addon_type as "employees" | "admins" | "storage_gb",
      quantity: dbAddon.quantity,
      unitPrice: dbAddon.unit_price,
      totalPrice: dbAddon.total_price,
      status: dbAddon.status as "active" | "cancelled",
    };
  }

  /**
   * Get all available plans
   */
  static async getAllPlans(
    includeInactive = false,
  ): Promise<PlanWithFeatures[]> {
    // Get all plans based on includeInactive filter
    const dbPlans = await PlanModel.findAll();
    const filteredPlans = includeInactive
      ? dbPlans
      : dbPlans.filter((p) => p.is_active);

    const plansWithFeatures = await Promise.all(
      filteredPlans.map(async (dbPlan) => {
        const dbFeatures = await PlanModel.getPlanFeatures(dbPlan.id);
        const plan = this.dbToApiPlan(dbPlan as ModelDbPlan);
        const features = dbFeatures
          .filter((f) => f.is_included)
          .map((f) => this.dbToApiFeature(f));

        return {
          ...plan,
          features,
        };
      }),
    );

    return plansWithFeatures;
  }

  /**
   * Get plan by ID
   */
  static async getPlanById(planId: number): Promise<PlanWithFeatures | null> {
    const [dbPlans] = await query<DbPlan[]>(
      "SELECT * FROM plans WHERE id = ?",
      [planId],
    );

    if (dbPlans.length === 0) {
      return null;
    }

    const dbPlan = dbPlans[0];
    const dbFeatures = await PlanModel.getPlanFeatures(planId);

    const plan = this.dbToApiPlan(dbPlan);
    const features = dbFeatures
      .filter((f) => f.is_included)
      .map((f) => this.dbToApiFeature(f));

    return {
      ...plan,
      features,
    };
  }

  /**
   * Get current plan for tenant
   */
  static async getCurrentPlan(
    tenantId: number,
  ): Promise<CurrentPlanResponse | null> {
    const dbTenantPlan = await PlanModel.getTenantPlan(tenantId);

    if (!dbTenantPlan) {
      return null;
    }

    const dbPlan = await PlanModel.findByCode(dbTenantPlan.plan_code);
    if (!dbPlan) {
      throw new Error("Plan details not found");
    }

    const dbFeatures = await PlanModel.getPlanFeatures(dbTenantPlan.plan_id);
    const dbAddons = await PlanModel.getTenantAddons(tenantId);
    const costs = await PlanModel.calculateTenantCost(tenantId);

    const tenantPlan = this.dbToApiTenantPlan(
      dbTenantPlan as ModelDbTenantPlan,
    );
    const planDetails = this.dbToApiPlan(dbPlan as ModelDbPlan);
    const features = dbFeatures
      .filter((f) => f.is_included)
      .map((f) => this.dbToApiFeature(f));
    const addons = dbAddons.map((a) => this.dbToApiAddon(a));

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
        features,
      },
      addons,
      costs: apiCosts,
    };
  }

  /**
   * Upgrade/downgrade plan
   */
  static async upgradePlan(
    tenantId: number,
    newPlanCode: string,
    effectiveDate?: Date,
    userId?: number,
  ): Promise<CurrentPlanResponse> {
    // Validate plan exists
    const newPlan = await PlanModel.findByCode(newPlanCode);
    if (!newPlan) {
      throw new Error(`Plan not found: ${newPlanCode}`);
    }

    // Get current plan
    const currentPlan = await PlanModel.getTenantPlan(tenantId);
    if (!currentPlan) {
      throw new Error("No active plan found for tenant");
    }

    // Change the plan
    await PlanModel.changeTenantPlan({
      tenantId,
      newPlanCode,
      effectiveDate,
    });

    // Log the change
    if (userId) {
      await RootLog.create({
        user_id: userId,
        tenant_id: tenantId,
        action: "plan_upgrade",
        entity_type: "tenant_plans",
        entity_id: newPlan.id,
        old_values: { plan_id: currentPlan.plan_id },
        new_values: {
          plan_id: newPlan.id,
          effective_date:
            effectiveDate?.toISOString() ?? new Date().toISOString(),
        },
      });
    }

    // Return updated plan info
    const result = await this.getCurrentPlan(tenantId);
    if (!result) {
      throw new Error("Failed to retrieve updated plan");
    }

    return result;
  }

  /**
   * Get plan features
   */
  static async getPlanFeatures(planId: number): Promise<PlanFeature[]> {
    const dbFeatures = await PlanModel.getPlanFeatures(planId);
    return dbFeatures.map((f) => this.dbToApiFeature(f));
  }

  /**
   * Get tenant addons (simple counts)
   */
  static async getTenantAddons(tenantId: number): Promise<TenantAddons> {
    const [dbAddons] = await query<DbAddonResult[]>(
      `SELECT 
        COALESCE(MAX(CASE WHEN addon_type = 'employees' THEN quantity END), 0) as extra_employees,
        COALESCE(MAX(CASE WHEN addon_type = 'admins' THEN quantity END), 0) as extra_admins,
        COALESCE(MAX(CASE WHEN addon_type = 'storage_gb' THEN quantity END), 0) as extra_storage_gb
      FROM tenant_addons 
      WHERE tenant_id = ? AND status = 'active'`,
      [tenantId],
    );

    if (dbAddons.length === 0) {
      return {
        employees: 0,
        admins: 0,
        storageGb: 0,
      };
    }

    return {
      employees: dbAddons[0].extra_employees ?? 0,
      admins: dbAddons[0].extra_admins ?? 0,
      storageGb: dbAddons[0].extra_storage_gb ?? 0,
    };
  }

  /**
   * Get tenant addon details (full records)
   */
  static async getTenantAddonDetails(tenantId: number): Promise<TenantAddon[]> {
    const dbAddons = await PlanModel.getTenantAddons(tenantId);
    return dbAddons.map((a) => this.dbToApiAddon(a));
  }

  /**
   * Update tenant addons
   */
  static async updateAddons(
    tenantId: number,
    addons: UpdateAddonsRequest,
    userId?: number,
  ): Promise<TenantAddons> {
    // Map camelCase to snake_case for model
    const addonUpdate: Record<string, number> = {};
    if (addons.employees !== undefined)
      addonUpdate.employees = addons.employees;
    if (addons.admins !== undefined) addonUpdate.admins = addons.admins;
    if (addons.storageGb !== undefined)
      addonUpdate.storage_gb = addons.storageGb;

    await PlanModel.updateTenantAddons({
      tenantId,
      addons: addonUpdate,
    });

    // Log the change
    if (userId) {
      await RootLog.create({
        user_id: userId,
        tenant_id: tenantId,
        action: "addon_update",
        entity_type: "tenant_addons",
        entity_id: tenantId,
        new_values: addons as Record<string, unknown>,
      });
    }

    // Return updated addons
    return await this.getTenantAddons(tenantId);
  }

  /**
   * Calculate tenant costs
   */
  static async calculateCosts(tenantId: number): Promise<CostCalculation> {
    const costs = await PlanModel.calculateTenantCost(tenantId);
    const addons = await this.getTenantAddons(tenantId);

    return {
      basePlanCost: costs.planCost,
      addonCosts: {
        employees: addons.employees * 5.0, // 5€ per extra employee
        admins: addons.admins * 10.0, // 10€ per extra admin
        storage: addons.storageGb * 0.1, // 0.10€ per GB
      },
      totalMonthlyCost: costs.totalCost,
      currency: "EUR",
    };
  }
}
