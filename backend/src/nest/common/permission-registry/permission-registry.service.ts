/**
 * Permission Registry Service
 *
 * Global singleton that collects permission definitions from addon modules.
 * Each addon module registers its PermissionCategoryDef via OnModuleInit.
 * No addon-specific knowledge lives here — pure registry.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, Logger } from '@nestjs/common';

import type {
  PermissionCategoryDef,
  PermissionModuleDef,
  PermissionType,
} from './permission.types.js';

@Injectable()
export class PermissionRegistryService {
  private readonly logger = new Logger(PermissionRegistryService.name);
  private readonly categories = new Map<string, PermissionCategoryDef>();

  /**
   * Register an addon category with its modules.
   * Called by addon modules during OnModuleInit.
   * Throws on duplicate registration (fail-fast).
   */
  register(category: PermissionCategoryDef): void {
    if (this.categories.has(category.code)) {
      throw new Error(`Permission category "${category.code}" already registered`);
    }
    this.categories.set(category.code, category);
    this.logger.log(
      `Registered permission category "${category.code}" with ${category.modules.length} module(s)`,
    );
  }

  /** Get all registered permission categories */
  getAll(): PermissionCategoryDef[] {
    return Array.from(this.categories.values());
  }

  /** Get a specific category by its addon code */
  getByCode(code: string): PermissionCategoryDef | undefined {
    return this.categories.get(code);
  }

  /** Check if a module exists within an addon */
  isValidModule(addonCode: string, moduleCode: string): boolean {
    const category = this.categories.get(addonCode);
    if (category === undefined) {
      return false;
    }
    return category.modules.some((m: PermissionModuleDef) => m.code === moduleCode);
  }

  /** Get the allowed permission types for a specific module */
  getAllowedPermissions(addonCode: string, moduleCode: string): PermissionType[] {
    const category = this.categories.get(addonCode);
    if (category === undefined) {
      return [];
    }
    const mod = category.modules.find((m: PermissionModuleDef) => m.code === moduleCode);
    return mod?.allowedPermissions ?? [];
  }
}
