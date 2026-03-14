/**
 * Scope Service — Lazy Organizational Scope Resolution
 *
 * Resolves the OrganizationalScope on first access, caches in CLS.
 * ~90% of requests (Chat, Calendar etc.) never resolve scope → no DB overhead.
 *
 * NOT an APP_GUARD — services call getScope() only when they actually need it.
 * Guard order stays unchanged: JwtAuth → Roles → TenantAddon → Permission.
 */
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { HierarchyPermissionService } from './hierarchy-permission.service.js';
import type { OrganizationalScope } from './organizational-scope.types.js';

@Injectable()
export class ScopeService {
  constructor(
    private readonly hierarchyPermission: HierarchyPermissionService,
    private readonly cls: ClsService,
  ) {}

  /** Lazy: First access → DB query + CLS cache. Subsequent → from CLS. */
  async getScope(): Promise<OrganizationalScope> {
    const cached = this.cls.get<OrganizationalScope | undefined>('orgScope');
    if (cached !== undefined) return cached;

    const userId = this.cls.get<number | undefined>('userId');
    const tenantId = this.cls.get<number | undefined>('tenantId');

    // Background jobs (Cron, Deletion-Worker) have no CLS context
    if (userId === undefined || tenantId === undefined) {
      throw new Error(
        'ScopeService requires CLS context (userId + tenantId). Cannot be used in background jobs or cron tasks.',
      );
    }

    const scope = await this.hierarchyPermission.getScope(userId, tenantId);
    this.cls.set('orgScope', scope);
    return scope;
  }
}
