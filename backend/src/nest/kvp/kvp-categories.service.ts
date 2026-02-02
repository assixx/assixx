/**
 * KVP Categories Sub-Service
 *
 * Manages tenant-specific category customization (Overlay-Pattern):
 * - Override: rename global default categories per tenant
 * - Custom: create new tenant-specific categories
 *
 * Max 20 categories per tenant (6 defaults + 14 custom).
 *
 * @see docs/plans/KVP-CATEGORIES-CUSTOM-PLAN.md
 */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';

/** Max total categories per tenant (6 defaults + 14 custom) */
const MAX_CATEGORIES_PER_TENANT = 20;

/** Admin-view default category with optional override info */
interface CustomizableDefault {
  id: number;
  defaultName: string;
  customName: string | null;
  description: string;
  color: string;
  icon: string;
  isCustomized: boolean;
}

/** Admin-view custom category */
interface CustomCategory {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
}

/** Full admin-view response */
export interface CustomizableCategoriesResponse {
  defaults: CustomizableDefault[];
  custom: CustomCategory[];
  totalCount: number;
  maxAllowed: number;
  remainingSlots: number;
}

/** DB row from the defaults + overrides query */
interface DbDefaultRow {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  custom_name: string | null;
}

/** DB row from the custom categories query */
interface DbCustomRow {
  id: number;
  custom_name: string;
  description: string | null;
  color: string;
  icon: string;
}

@Injectable()
export class KvpCategoriesService {
  private readonly logger = new Logger(KvpCategoriesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all categories in admin-view format (defaults with override info + custom)
   */
  async getCustomizable(
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<CustomizableCategoriesResponse> {
    await this.assertHasFullAccess(userId, userRole, tenantId);
    this.logger.debug(`Getting customizable categories for tenant ${tenantId}`);

    const defaultsQuery = `
      SELECT kc.id, kc.name, kc.description, kc.color, kc.icon,
             kcc.custom_name
      FROM kvp_categories kc
      LEFT JOIN kvp_categories_custom kcc
        ON kcc.category_id = kc.id AND kcc.tenant_id = $1
      ORDER BY kc.name ASC
    `;

    const customQuery = `
      SELECT kcc.id, kcc.custom_name, kcc.description, kcc.color, kcc.icon
      FROM kvp_categories_custom kcc
      WHERE kcc.tenant_id = $1 AND kcc.category_id IS NULL
      ORDER BY kcc.custom_name ASC
    `;

    const [defaultRows, customRows] = await Promise.all([
      this.db.query<DbDefaultRow>(defaultsQuery, [tenantId]),
      this.db.query<DbCustomRow>(customQuery, [tenantId]),
    ]);

    const defaults: CustomizableDefault[] = defaultRows.map(
      (row: DbDefaultRow) => ({
        id: row.id,
        defaultName: row.name,
        customName: row.custom_name,
        description: row.description,
        color: row.color,
        icon: row.icon,
        isCustomized: row.custom_name !== null,
      }),
    );

    const custom: CustomCategory[] = customRows.map((row: DbCustomRow) => ({
      id: row.id,
      name: row.custom_name,
      description: row.description,
      color: row.color,
      icon: row.icon,
    }));

    const totalCount = defaults.length + custom.length;

    return {
      defaults,
      custom,
      totalCount,
      maxAllowed: MAX_CATEGORIES_PER_TENANT,
      remainingSlots: MAX_CATEGORIES_PER_TENANT - totalCount,
    };
  }

  /**
   * Upsert a name override for a global default category
   */
  async upsertOverride(
    tenantId: number,
    categoryId: number,
    customName: string,
    userId: number,
    userRole: string,
  ): Promise<{ id: number }> {
    await this.assertHasFullAccess(userId, userRole, tenantId);
    this.logger.log(
      `Upserting override for category ${categoryId} in tenant ${tenantId}`,
    );

    await this.assertGlobalCategoryExists(categoryId);

    const query = `
      INSERT INTO kvp_categories_custom (tenant_id, category_id, custom_name)
      VALUES ($1, $2, $3)
      ON CONFLICT ON CONSTRAINT uq_override
      DO UPDATE SET custom_name = $3, updated_at = NOW()
      RETURNING id
    `;

    const rows = await this.db.query<{ id: number }>(query, [
      tenantId,
      categoryId,
      customName,
    ]);

    if (rows[0] === undefined) {
      throw new Error('Failed to upsert override');
    }

    return { id: rows[0].id };
  }

  /**
   * Delete a name override, resetting to the global default name
   */
  async deleteOverride(
    tenantId: number,
    categoryId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    await this.assertHasFullAccess(userId, userRole, tenantId);
    this.logger.log(
      `Deleting override for category ${categoryId} in tenant ${tenantId}`,
    );

    const query = `
      DELETE FROM kvp_categories_custom
      WHERE category_id = $1 AND tenant_id = $2
    `;

    await this.db.query(query, [categoryId, tenantId]);
  }

  /**
   * Create a new tenant-specific custom category
   */
  async createCustom(
    tenantId: number,
    name: string,
    color: string,
    icon: string,
    userId: number,
    userRole: string,
    description?: string,
  ): Promise<{ id: number }> {
    await this.assertHasFullAccess(userId, userRole, tenantId);
    this.logger.log(
      `Creating custom category "${name}" for tenant ${tenantId}`,
    );

    await this.assertCategoryLimitNotReached(tenantId);

    const query = `
      INSERT INTO kvp_categories_custom
        (tenant_id, category_id, custom_name, description, color, icon)
      VALUES ($1, NULL, $2, $3, $4, $5)
      RETURNING id
    `;

    const rows = await this.db.query<{ id: number }>(query, [
      tenantId,
      name,
      description ?? null,
      color,
      icon,
    ]);

    if (rows[0] === undefined) {
      throw new Error('Failed to create custom category');
    }

    return { id: rows[0].id };
  }

  /**
   * Delete a tenant-specific custom category
   * Fails if suggestions reference it (ConflictException)
   */
  async deleteCustom(
    tenantId: number,
    id: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    await this.assertHasFullAccess(userId, userRole, tenantId);
    this.logger.log(`Deleting custom category ${id} for tenant ${tenantId}`);

    await this.assertNoSuggestionsReference(id);

    const query = `
      DELETE FROM kvp_categories_custom
      WHERE id = $1 AND tenant_id = $2 AND category_id IS NULL
      RETURNING id
    `;

    const rows = await this.db.query<{ id: number }>(query, [id, tenantId]);

    if (rows.length === 0) {
      throw new NotFoundException('Custom category not found');
    }
  }

  // ==========================================================================
  // VALIDATION HELPERS
  // ==========================================================================

  /** Verify global category exists */
  private async assertGlobalCategoryExists(categoryId: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>(
      'SELECT id FROM kvp_categories WHERE id = $1',
      [categoryId],
    );

    if (rows[0] === undefined) {
      throw new NotFoundException(
        `Global category with ID ${categoryId} not found`,
      );
    }
  }

  /** Verify tenant hasn't exceeded max category limit */
  private async assertCategoryLimitNotReached(tenantId: number): Promise<void> {
    const rows = await this.db.query<{ cnt: number }>(
      `SELECT
        (SELECT COUNT(*) FROM kvp_categories) +
        (SELECT COUNT(*) FROM kvp_categories_custom WHERE tenant_id = $1 AND category_id IS NULL)
       AS cnt`,
      [tenantId],
    );

    const count = rows[0]?.cnt ?? 0;

    if (count >= MAX_CATEGORIES_PER_TENANT) {
      throw new ForbiddenException(
        `Maximum ${MAX_CATEGORIES_PER_TENANT} categories reached`,
      );
    }
  }

  /** Verify no suggestions reference this custom category */
  private async assertNoSuggestionsReference(
    customCategoryId: number,
  ): Promise<void> {
    const rows = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*)::integer AS cnt FROM kvp_suggestions WHERE custom_category_id = $1',
      [customCategoryId],
    );

    const count = rows[0]?.cnt ?? 0;

    if (count > 0) {
      throw new ConflictException(
        `Category is referenced by ${count} existing suggestion(s). Remove references first.`,
      );
    }
  }

  /** Verify user has full access (root always, admin needs has_full_access flag) */
  private async assertHasFullAccess(
    userId: number,
    userRole: string,
    tenantId: number,
  ): Promise<void> {
    if (userRole === 'root') return;

    if (userRole === 'admin') {
      const rows = await this.db.query<{ has_full_access: boolean }>(
        'SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2',
        [userId, tenantId],
      );

      if (rows[0]?.has_full_access === true) return;
    }

    throw new ForbiddenException(
      'Nur Administratoren mit Vollzugriff können Kategorien verwalten',
    );
  }
}
