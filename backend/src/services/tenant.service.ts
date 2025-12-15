/**
 * Tenant Service
 * Handles tenant-related business logic
 */
// ESLint incorrectly flags Model/Class imports as naming convention violations
// Models are exported as default classes with PascalCase names, which is correct
// eslint-disable-next-line @typescript-eslint/naming-convention
import Tenant from '../routes/v2/tenants/tenant.model.js';
import {
  type TenantCreateData as ModelTenantCreateData,
  type TenantCreateResult,
  deleteTenant,
  findAllTenants,
  findTenantById,
} from '../routes/v2/tenants/tenant.model.js';
import type { DatabaseTenant } from '../types/models.js';
import { Pool } from '../utils/db.js';

// Interfaces
interface TenantData {
  id: number;
  subdomain: string;
  company_name: string;
  company_email: string;
  company_phone?: string | null;
  country: string;
  status: 'active' | 'inactive' | 'suspended';
  trial_ends_at?: Date | null;
  subscription_plan?: string | null;
  subscription_ends_at?: Date | null;
  max_users?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface TenantFilters {
  status?: 'active' | 'inactive' | 'suspended';
  search?: string;
  limit?: number;
  offset?: number;
}

// Removed unused TenantCreateData interface - using ModelTenantCreateData instead

interface TenantUpdateData {
  company_name?: string;
  company_email?: string;
  company_phone?: string | null;
  country?: string;
  status?: 'active' | 'inactive' | 'suspended';
  trial_ends_at?: Date | string | null;
  subscription_plan?: string | null;
  subscription_ends_at?: Date | string | null;
  max_users?: number;
}

/**
 *
 */
class TenantService {
  /**
   * Holt alle Tenant Einträge
   * @param _tenantDb - Database connection (unused - uses main connection)
   * @param _filters - Filter criteria (currently unused, for future pagination/search)
   * @returns Array of all tenants (excludes cancelled tenants)
   */
  async getAll(_tenantDb: Pool, _filters: TenantFilters = {}): Promise<DatabaseTenant[]> {
    try {
      return await findAllTenants();
    } catch (error: unknown) {
      console.error('Error in TenantService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Tenant Eintrag per ID
   * @param _tenantDb - Database connection (unused - uses main connection)
   * @param id - Tenant ID
   * @returns Tenant data or null if not found (excludes cancelled tenants)
   */
  async getById(_tenantDb: Pool, id: number): Promise<DatabaseTenant | null> {
    try {
      return await findTenantById(id);
    } catch (error: unknown) {
      console.error('Error in TenantService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Tenant Eintrag
   * @param _tenantDb - The _tenantDb parameter
   * @param data - The data object
   */
  async create(_tenantDb: Pool, data: ModelTenantCreateData): Promise<TenantCreateResult> {
    try {
      return await Tenant.create(data);
    } catch (error: unknown) {
      console.error('Error in TenantService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Tenant Eintrag
   *
   * PLANNED FEATURE - Not yet implemented
   *
   * Required before implementation:
   * 1. Add updateTenant() function to tenant['ts'] model
   * 2. Define which fields are safe to update (e.g., company_name, email, phone)
   * 3. Implement subdomain change logic (complex - affects routing, URLs, files)
   * 4. Add validation for status transitions (trial → active → suspended)
   * 5. Handle Stripe subscription updates when plan changes
   * 6. Add audit logging for tenant modifications
   *
   * For now, use direct model functions or admin panel for tenant updates.
   *
   * @param _tenantDb - Database connection
   * @param _id - Tenant ID to update
   * @param _data - Update data
   * @returns Updated tenant data (currently always null)
   */
  update(_tenantDb: Pool, _id: number, _data: TenantUpdateData): TenantData | null {
    console.warn('Tenant.update is planned but not yet implemented');
    console.warn('Required fields to update:', _data);
    console.warn('Use direct database updates or admin panel for now');
    return null;
  }

  /**
   * Löscht einen Tenant und alle zugehörigen Daten (CASCADE)
   * @param _tenantDb - Database connection (unused - uses transaction)
   * @param id - Tenant ID to delete
   * @returns True if deletion was successful
   * @remarks **WARNING:** This performs a hard delete of ALL tenant data including:
   *          - All users, chats, surveys, shifts, documents
   *          - All file uploads
   *          - Cannot be undone!
   */
  async delete(_tenantDb: Pool, id: number): Promise<boolean> {
    try {
      return await deleteTenant(id);
    } catch (error: unknown) {
      console.error('Error in TenantService.delete:', error);
      throw error;
    }
  }
}

// Export singleton instance
const tenantService = new TenantService();
export default tenantService;

// Named export for the class
export { TenantService };

// CommonJS compatibility
