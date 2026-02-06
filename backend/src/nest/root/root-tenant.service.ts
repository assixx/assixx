/**
 * Root Tenant Sub-Service
 *
 * Handles tenant listing and storage information.
 * Extracted from root.service.ts — bounded context: tenant management.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import { ERROR_CODES } from './root.helpers.js';
import type {
  DbStorageTotalRow,
  DbTenantRow,
  StorageInfo,
  Tenant,
} from './root.types.js';
import { STORAGE_LIMITS } from './root.types.js';

@Injectable()
export class RootTenantService {
  private readonly logger = new Logger(RootTenantService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Get tenants - ONLY the root user's own tenant for security
   */
  async getTenants(tenantId: number): Promise<Tenant[]> {
    this.logger.debug(`Getting tenants for tenant ${tenantId}`);

    // Only return user's own tenant (multi-tenant isolation)
    const tenants = await this.db.query<DbTenantRow>(
      'SELECT * FROM tenants WHERE id = $1',
      [tenantId],
    );

    if (tenants.length === 0) {
      return [];
    }

    // Get additional stats - SECURITY: Use UserRepository for accurate active user counts
    return await Promise.all(
      tenants.map(async (tenant: DbTenantRow) => {
        const [adminCount, employeeCount, storageUsed] = await Promise.all([
          this.userRepository.countByRole('admin', tenant.id),
          this.userRepository.countByRole('employee', tenant.id),
          this.db.query<DbStorageTotalRow>(
            'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = $1',
            [tenant.id],
          ),
        ]);

        return {
          id: tenant.id,
          companyName: tenant.company_name,
          subdomain: tenant.subdomain,
          currentPlan: tenant.current_plan ?? undefined,
          status: tenant.status as Tenant['status'],
          createdAt: tenant.created_at,
          updatedAt: tenant.updated_at,
          adminCount,
          employeeCount,
          storageUsed: Number(storageUsed[0]?.total ?? 0),
        };
      }),
    );
  }

  /**
   * Get storage information
   */
  async getStorageInfo(tenantId: number): Promise<StorageInfo> {
    this.logger.debug(`Getting storage info for tenant ${tenantId}`);

    // Get tenant plan
    const tenant = await this.db.query<DbTenantRow>(
      'SELECT current_plan FROM tenants WHERE id = $1',
      [tenantId],
    );

    const tenantData = tenant[0];
    if (tenantData === undefined) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Tenant not found',
      });
    }

    const planKey = tenantData.current_plan ?? 'basic';
    const defaultStorage = STORAGE_LIMITS['basic'] ?? 0;

    const totalStorage =
      Object.hasOwn(STORAGE_LIMITS, planKey) ?
        (STORAGE_LIMITS[planKey] ?? defaultStorage)
      : defaultStorage;

    // Get storage breakdown in parallel
    const [documentsSize, attachmentsSize, logsSize] = await Promise.all([
      this.db.query<DbStorageTotalRow>(
        'SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE tenant_id = $1',
        [tenantId],
      ),
      this.db.query<DbStorageTotalRow>(
        `SELECT COALESCE(SUM(ka.file_size), 0) as total FROM kvp_attachments ka
         JOIN kvp_suggestions ks ON ka.suggestion_id = ks.id WHERE ks.tenant_id = $1`,
        [tenantId],
      ),
      this.db.query<DbStorageTotalRow>(
        "SELECT COALESCE(SUM(LENGTH(action) + LENGTH(COALESCE(details, ''))), 0) as total FROM admin_logs WHERE tenant_id = $1",
        [tenantId],
      ),
    ]);

    // PostgreSQL SUM() returns bigint/numeric as string - must convert
    const documents = Number(documentsSize[0]?.total ?? 0);
    const attachments = Number(attachmentsSize[0]?.total ?? 0);
    const logs = Number(logsSize[0]?.total ?? 0);
    const usedStorage = documents + attachments + logs;
    const percentage =
      totalStorage > 0 ? Math.round((usedStorage / totalStorage) * 100) : 0;

    return {
      used: usedStorage,
      total: totalStorage,
      percentage: Math.min(percentage, 100),
      plan: planKey,
      breakdown: {
        documents,
        attachments,
        logs,
        backups: 0,
      },
    };
  }
}
