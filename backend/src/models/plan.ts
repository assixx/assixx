import {
  execute as executeQuery,
  RowDataPacket,
  ResultSetHeader,
} from "../utils/db";
import { logger } from "../utils/logger";

export interface DbPlan extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description?: string;
  base_price: number;
  max_employees?: number;
  max_admins?: number;
  max_storage_gb: number;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbPlanFeature extends RowDataPacket {
  plan_id: number;
  feature_id: number;
  feature_code: string;
  feature_name: string;
  is_included: boolean;
}

export interface DbTenantPlan extends RowDataPacket {
  id: number;
  tenant_id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  status: "active" | "trial" | "cancelled" | "expired";
  started_at: Date;
  expires_at?: Date;
  custom_price?: number;
  billing_cycle: "monthly" | "yearly";
}

export interface DbTenantAddon extends RowDataPacket {
  id: number;
  tenant_id: number;
  addon_type: "employees" | "admins" | "storage_gb";
  quantity: number;
  unit_price: number;
  total_price: number;
  status: "active" | "cancelled";
}

export interface PlanChangeRequest {
  tenantId: number;
  newPlanCode: string;
  effectiveDate?: Date;
}

export interface AddonUpdateRequest {
  tenantId: number;
  addons: {
    employees?: number;
    admins?: number;
    storage_gb?: number;
  };
}

export class Plan {
  // Get all available plans
  static async findAll(): Promise<DbPlan[]> {
    try {
      const query = `
        SELECT * FROM plans 
        WHERE is_active = true 
        ORDER BY sort_order ASC
      `;
      const [plans] = await executeQuery<DbPlan[]>(query);
      return plans;
    } catch (error) {
      logger.error(`Error fetching plans: ${(error as Error).message}`);
      throw error;
    }
  }

  // Get plan by code
  static async findByCode(code: string): Promise<DbPlan | null> {
    try {
      const query = "SELECT * FROM plans WHERE code = ? AND is_active = true";
      const [plans] = await executeQuery<DbPlan[]>(query, [code]);
      return plans.length > 0 ? plans[0] : null;
    } catch (error) {
      logger.error(`Error fetching plan by code: ${(error as Error).message}`);
      throw error;
    }
  }

  // Get features included in a plan
  static async getPlanFeatures(planId: number): Promise<DbPlanFeature[]> {
    try {
      const query = `
        SELECT 
          pf.plan_id,
          pf.feature_id,
          f.code as feature_code,
          f.name as feature_name,
          pf.is_included
        FROM plan_features pf
        JOIN features f ON pf.feature_id = f.id
        WHERE pf.plan_id = ?
        AND f.is_active = true
        ORDER BY f.category, f.name
      `;
      const [features] = await executeQuery<DbPlanFeature[]>(query, [planId]);
      return features;
    } catch (error) {
      logger.error(`Error fetching plan features: ${(error as Error).message}`);
      throw error;
    }
  }

  // Get current plan for a tenant
  static async getTenantPlan(tenantId: number): Promise<DbTenantPlan | null> {
    try {
      const query = `
        SELECT 
          tp.*,
          p.code as plan_code,
          p.name as plan_name
        FROM tenant_plans tp
        JOIN plans p ON tp.plan_id = p.id
        WHERE tp.tenant_id = ?
        AND tp.status IN ('active', 'trial')
        ORDER BY tp.started_at DESC
        LIMIT 1
      `;
      const [plans] = await executeQuery<DbTenantPlan[]>(query, [tenantId]);
      return plans.length > 0 ? plans[0] : null;
    } catch (error) {
      logger.error(`Error fetching tenant plan: ${(error as Error).message}`);
      throw error;
    }
  }

  // Change tenant's plan
  static async changeTenantPlan(request: PlanChangeRequest): Promise<boolean> {
    try {
      const newPlan = await this.findByCode(request.newPlanCode);
      if (!newPlan) {
        throw new Error(`Plan ${request.newPlanCode} not found`);
      }

      const effectiveDate = request.effectiveDate || new Date();

      // Cancel current plan
      await executeQuery<ResultSetHeader>(
        `UPDATE tenant_plans 
         SET status = 'cancelled', cancelled_at = NOW() 
         WHERE tenant_id = ? AND status IN ('active', 'trial')`,
        [request.tenantId],
      );

      // Create new plan subscription
      await executeQuery<ResultSetHeader>(
        `INSERT INTO tenant_plans (tenant_id, plan_id, status, started_at) 
         VALUES (?, ?, 'active', ?)`,
        [request.tenantId, newPlan.id, effectiveDate],
      );

      // Update tenant's current_plan_id
      await executeQuery<ResultSetHeader>(
        "UPDATE tenants SET current_plan_id = ? WHERE id = ?",
        [newPlan.id, request.tenantId],
      );

      // Deactivate features not included in new plan
      const planFeatures = await this.getPlanFeatures(newPlan.id);
      const includedFeatureIds = planFeatures
        .filter((f) => f.is_included)
        .map((f) => f.feature_id);

      if (includedFeatureIds.length > 0) {
        await executeQuery<ResultSetHeader>(
          `UPDATE tenant_features 
           SET is_active = FALSE 
           WHERE tenant_id = ? 
           AND feature_id NOT IN (${includedFeatureIds.map(() => "?").join(",")})`,
          [request.tenantId, ...includedFeatureIds],
        );
      }

      logger.info(
        `Tenant ${request.tenantId} changed plan to ${request.newPlanCode}`,
      );
      return true;
    } catch (error) {
      logger.error(`Error changing tenant plan: ${(error as Error).message}`);
      throw error;
    }
  }

  // Get tenant's addons
  static async getTenantAddons(tenantId: number): Promise<DbTenantAddon[]> {
    try {
      const query = `
        SELECT * FROM tenant_addons 
        WHERE tenant_id = ? 
        AND status = 'active'
      `;
      const [addons] = await executeQuery<DbTenantAddon[]>(query, [tenantId]);
      return addons;
    } catch (error) {
      logger.error(`Error fetching tenant addons: ${(error as Error).message}`);
      throw error;
    }
  }

  // Update tenant's addons
  static async updateTenantAddons(
    request: AddonUpdateRequest,
  ): Promise<boolean> {
    try {
      const updates = [];

      if (request.addons.employees !== undefined) {
        updates.push({
          type: "employees",
          quantity: request.addons.employees,
          unitPrice: 5.0,
        });
      }

      if (request.addons.admins !== undefined) {
        updates.push({
          type: "admins",
          quantity: request.addons.admins,
          unitPrice: 10.0,
        });
      }

      if (request.addons.storage_gb !== undefined) {
        updates.push({
          type: "storage_gb",
          quantity: request.addons.storage_gb,
          unitPrice: 0.1,
        });
      }

      for (const update of updates) {
        await executeQuery<ResultSetHeader>(
          `INSERT INTO tenant_addons (tenant_id, addon_type, quantity, unit_price, status)
           VALUES (?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE
           quantity = VALUES(quantity),
           unit_price = VALUES(unit_price),
           updated_at = NOW()`,
          [request.tenantId, update.type, update.quantity, update.unitPrice],
        );
      }

      logger.info(`Updated addons for tenant ${request.tenantId}`);
      return true;
    } catch (error) {
      logger.error(`Error updating tenant addons: ${(error as Error).message}`);
      throw error;
    }
  }

  // Calculate total monthly cost for a tenant
  static async calculateTenantCost(tenantId: number): Promise<{
    planCost: number;
    addonCost: number;
    totalCost: number;
  }> {
    try {
      const query = `
        SELECT 
          COALESCE(tp.custom_price, p.base_price) as plan_cost,
          COALESCE(SUM(ta.total_price), 0) as addon_cost
        FROM tenants t
        LEFT JOIN tenant_plans tp ON t.id = tp.tenant_id AND tp.status IN ('active', 'trial')
        LEFT JOIN plans p ON tp.plan_id = p.id
        LEFT JOIN tenant_addons ta ON t.id = ta.tenant_id AND ta.status = 'active'
        WHERE t.id = ?
        GROUP BY t.id, tp.custom_price, p.base_price
      `;

      const [queryResult] = await executeQuery<RowDataPacket[]>(query, [
        tenantId,
      ]);
      const data = queryResult[0];

      const planCost = data?.plan_cost || 0;
      const addonCost = data?.addon_cost || 0;

      return {
        planCost: parseFloat(planCost),
        addonCost: parseFloat(addonCost),
        totalCost: parseFloat(planCost) + parseFloat(addonCost),
      };
    } catch (error) {
      logger.error(
        `Error calculating tenant cost: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
