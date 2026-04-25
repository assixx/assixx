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

  /**
   * Append modules to an already-registered category.
   *
   * Use case: a feature module (e.g. shift-handover) ships new permission
   * modules that belong to an existing addon's category (e.g. shift_planning).
   * Because `register()` is throw-on-duplicate, and we do NOT want to
   * couple feature modules by sharing a single `PermissionCategoryDef`
   * literal, this method lets a late-arriving registrar extend the owning
   * category without touching the base feature's files.
   *
   * Caller MUST fire this hook AFTER the base category is registered. The
   * recommended lifecycle is `OnApplicationBootstrap` (fires after all
   * `OnModuleInit` hooks), which avoids fragile cross-module init ordering.
   *
   * Fails fast if: the category is missing, or a module code collides with
   * one already registered under the same category.
   *
   * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
   * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.7 + §Spec Deviation #2
   */
  addModulesToCategory(addonCode: string, modules: readonly PermissionModuleDef[]): void {
    const category = this.categories.get(addonCode);
    if (category === undefined) {
      throw new Error(
        `Cannot extend permission category "${addonCode}" — not registered. ` +
          `Ensure the owning feature module registers the category before this hook runs.`,
      );
    }
    for (const mod of modules) {
      if (category.modules.some((m: PermissionModuleDef) => m.code === mod.code)) {
        throw new Error(`Module "${mod.code}" already registered under category "${addonCode}"`);
      }
      category.modules.push(mod);
    }
    this.logger.log(`Extended permission category "${addonCode}" with ${modules.length} module(s)`);
  }
}
