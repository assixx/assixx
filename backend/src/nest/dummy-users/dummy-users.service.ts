/**
 * Dummy Users Service — Core CRUD
 *
 * Handles creation, retrieval, listing, updating, and soft-deletion
 * of dummy display accounts. Auto-generates email, employee number,
 * and assigns read-only permissions on creation.
 *
 * All queries use tenant-scoped parameterized SQL (ADR-019).
 * Returns raw data — ResponseInterceptor wraps automatically (ADR-007).
 */
import type { UserRole } from '@assixx/shared';
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { TenantVerificationService } from '../domains/tenant-verification.service.js';
import type { ProtectionActor, ProtectionTargetUser } from '../root/root-protection.service.js';
import { ROOT_PROTECTION_CODES, RootProtectionService } from '../root/root-protection.service.js';
import {
  buildDummyEmail,
  buildDummyEmployeeNumber,
  mapDummyUserRowToApi,
} from './dummy-users.helpers.js';
import type { DummyUser, DummyUserWithTeamsRow, PaginatedDummyUsers } from './dummy-users.types.js';
import { DUMMY_PERMISSIONS } from './dummy-users.types.js';

// ============================================================================
// SQL Fragments
// ============================================================================

const DUMMY_SELECT_SQL = `
  SELECT u.id, u.uuid, u.tenant_id, u.email, u.display_name,
    u.employee_number, u.role, u.is_active, u.has_full_access,
    u.created_at, u.updated_at,
    STRING_AGG(DISTINCT t.id::text, ',') AS team_ids,
    STRING_AGG(DISTINCT t.name, ',') AS team_names,
    STRING_AGG(DISTINCT dep.id::text, ',') AS department_ids,
    STRING_AGG(DISTINCT dep.name, ',') AS department_names,
    STRING_AGG(DISTINCT a.id::text, ',') AS area_ids,
    STRING_AGG(DISTINCT a.name, ',') AS area_names
  FROM users u
  LEFT JOIN user_teams uta ON u.id = uta.user_id
  LEFT JOIN teams t ON uta.team_id = t.id
  LEFT JOIN departments dep ON t.department_id = dep.id
  LEFT JOIN areas a ON dep.area_id = a.id`;

const DUMMY_GROUP_BY = `
  GROUP BY u.id, u.uuid, u.tenant_id, u.email, u.display_name,
    u.employee_number, u.role, u.is_active, u.has_full_access,
    u.created_at, u.updated_at`;

// ============================================================================
// Query helpers
// ============================================================================

interface ListQuery {
  search?: string | undefined;
  isActive?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

interface WhereResult {
  conditions: string[];
  params: unknown[];
  nextIdx: number;
}

function buildListWhere(tenantId: number, query: ListQuery): WhereResult {
  const conditions = ["u.role = 'dummy'", 'u.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let nextIdx = 2;

  if (query.isActive !== undefined) {
    conditions.push(`u.is_active = $${nextIdx++}`);
    params.push(query.isActive);
  } else {
    conditions.push(`u.is_active != ${IS_ACTIVE.DELETED}`);
  }

  if (query.search !== undefined && query.search !== '') {
    conditions.push(
      `(u.display_name ILIKE $${nextIdx} OR u.email ILIKE $${nextIdx} OR u.employee_number ILIKE $${nextIdx})`,
    );
    params.push(`%${query.search}%`);
    nextIdx++;
  }

  return { conditions, params, nextIdx };
}

// ============================================================================
// Service
// ============================================================================

/** BCrypt salt rounds — same as UsersService */
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class DummyUsersService {
  private readonly logger = new Logger(DummyUsersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
    // Step 2.9 KISS gate — `assertVerified(tenantId)` called at top of `create`
    // to block dummy-user creation for tenants without a verified domain.
    // DummyUsersService is the ONE service with INSERT INTO users inline in
    // the public method (v0.3.6 D33), so the gate sits at public-method entry.
    private readonly tenantVerification: TenantVerificationService,
    // Layer-2 root-protection wiring (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN
    // .md §2.3, Session 4). Defensive only: `delete()` filters role='dummy'
    // in its UPDATE WHERE clause, so the cross-root branch never fires in
    // normal flow. Wiring exists to catch any future regression where a root
    // row leaks into this path (e.g., a relaxed WHERE clause).
    private readonly rootProtection: RootProtectionService,
  ) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  async create(
    tenantId: number,
    dto: { displayName: string; password: string; teamIds?: number[] },
    actingUserId: number,
  ): Promise<DummyUser> {
    // KISS gate (§2.9 + §0.2.5 #1): Throws `ForbiddenException('TENANT_NOT_
    // VERIFIED')` if no verified `tenant_domains` row exists. Must run before
    // ANY DB writes — the INSERT INTO users at line ~128 is directly below.
    // Arch-test (§2.11, regex `INSERT INTO users\b`) locks this invariant.
    await this.tenantVerification.assertVerified(tenantId);
    const uuid = uuidv7();
    const hashedPassword = await bcryptjs.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const email = await this.generateEmail(tenantId);
    const employeeNumber = await this.generateEmployeeNumber(tenantId);

    const rows = await this.db.tenantQuery<{ id: number }>(
      `INSERT INTO users
        (uuid, tenant_id, username, email, password, role, has_full_access,
         display_name, employee_number, is_active)
       VALUES ($1, $2, $3, $3, $4, 'dummy', false, $5, $6, 1)
       RETURNING id`,
      [uuid, tenantId, email, hashedPassword, dto.displayName, employeeNumber],
    );

    if (rows[0] === undefined) {
      throw new BadRequestException('Dummy-Benutzer konnte nicht erstellt werden');
    }
    const userId = rows[0].id;

    // Auto-assign team memberships
    if (dto.teamIds !== undefined && dto.teamIds.length > 0) {
      await this.syncTeams(tenantId, userId, dto.teamIds);
    }

    // Auto-assign read-only permissions
    await this.assignDefaultPermissions(tenantId, userId, actingUserId);

    await this.activityLogger.log({
      tenantId,
      userId: actingUserId,
      action: 'create',
      entityType: 'dummy_user',
      entityId: userId,
      details: `Dummy-Benutzer "${dto.displayName}" erstellt (${email})`,
    });

    return await this.getByUuid(tenantId, uuid);
  }

  // ==========================================================================
  // LIST
  // ==========================================================================

  async list(tenantId: number, query: ListQuery): Promise<PaginatedDummyUsers> {
    const page = query.page ?? 1;
    const pageSize = query.limit ?? 20;
    const offset = (page - 1) * pageSize;

    const { conditions, params, nextIdx } = buildListWhere(tenantId, query);
    const whereClause = conditions.join(' AND ');

    // Count total
    const countRows = await this.db.tenantQuery<{ count: string }>(
      `SELECT COUNT(DISTINCT u.id) AS count FROM users u WHERE ${whereClause}`,
      params,
    );
    const total = Number(countRows[0]?.count ?? '0');

    // Fetch page
    const rows = await this.db.tenantQuery<DummyUserWithTeamsRow>(
      `${DUMMY_SELECT_SQL}
       WHERE ${whereClause}
       ${DUMMY_GROUP_BY}
       ORDER BY u.display_name ASC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, pageSize, offset],
    );

    return {
      items: rows.map(mapDummyUserRowToApi),
      total,
      page,
      pageSize,
    };
  }

  // ==========================================================================
  // GET BY UUID
  // ==========================================================================

  async getByUuid(tenantId: number, uuid: string): Promise<DummyUser> {
    const rows = await this.db.tenantQuery<DummyUserWithTeamsRow>(
      `${DUMMY_SELECT_SQL}
       WHERE u.tenant_id = $1 AND u.uuid = $2 AND u.role = 'dummy' AND u.is_active != ${IS_ACTIVE.DELETED}
       ${DUMMY_GROUP_BY}`,
      [tenantId, uuid],
    );

    const firstRow = rows[0];
    if (firstRow === undefined) {
      throw new NotFoundException('Dummy-Benutzer nicht gefunden');
    }

    return mapDummyUserRowToApi(firstRow);
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async update(
    tenantId: number,
    uuid: string,
    dto: {
      displayName?: string | undefined;
      password?: string | undefined;
      teamIds?: number[] | undefined;
      isActive?: number | undefined;
    },
    actingUserId: number,
  ): Promise<DummyUser> {
    // Verify exists
    const [existing] = await this.db.tenantQuery<{ id: number }>(
      `SELECT id FROM users
       WHERE tenant_id = $1 AND uuid = $2 AND role = 'dummy' AND is_active != ${IS_ACTIVE.DELETED}`,
      [tenantId, uuid],
    );

    if (existing === undefined) {
      throw new NotFoundException('Dummy-Benutzer nicht gefunden');
    }

    // Build dynamic SET clause
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [tenantId, uuid];
    let idx = 3;

    if (dto.displayName !== undefined) {
      setClauses.push(`display_name = $${idx++}`);
      params.push(dto.displayName);
    }

    if (dto.password !== undefined) {
      const hashed = await bcryptjs.hash(dto.password, BCRYPT_SALT_ROUNDS);
      setClauses.push(`password = $${idx++}`);
      params.push(hashed);
    }

    if (dto.isActive !== undefined) {
      setClauses.push(`is_active = $${idx}`);
      params.push(dto.isActive);
    }

    await this.db.tenantQuery(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE tenant_id = $1 AND uuid = $2 AND role = 'dummy'`,
      params,
    );

    // Sync teams if provided
    if (dto.teamIds !== undefined) {
      await this.syncTeams(tenantId, existing.id, dto.teamIds);
    }

    await this.activityLogger.log({
      tenantId,
      userId: actingUserId,
      action: 'update',
      entityType: 'dummy_user',
      entityId: existing.id,
      details: 'Dummy-Benutzer aktualisiert',
    });

    return await this.getByUuid(tenantId, uuid);
  }

  // ==========================================================================
  // DELETE (soft-delete: is_active = 4)
  // ==========================================================================

  async delete(tenantId: number, uuid: string, actingUserId: number): Promise<void> {
    // Layer-2 root protection (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md
    // §2.3, Session 4). Defensive: pre-fetch role, then run the chain.
    // The UPDATE below filters role='dummy' already, so the SELECT here
    // also returns role='dummy' in normal flow → chain is inert. The
    // pre-fetch is O(1) on the (tenant_id, uuid) unique index.
    const [target] = await this.db.tenantQuery<{ id: number; role: string }>(
      `SELECT id, role FROM users
       WHERE tenant_id = $1 AND uuid = $2 AND role = 'dummy' AND is_active != ${IS_ACTIVE.DELETED}`,
      [tenantId, uuid],
    );

    if (target !== undefined && (target.role as UserRole) === 'root') {
      const actor: ProtectionActor = { id: actingUserId, tenantId };
      const protectTarget: ProtectionTargetUser = {
        id: target.id,
        tenantId,
        role: target.role as UserRole,
        isActive: IS_ACTIVE.ACTIVE,
      };
      await this.rootProtection.assertCrossRootTerminationForbidden(
        actor,
        protectTarget,
        'soft-delete',
      );
      if (actor.id === protectTarget.id) {
        throw new ForbiddenException({
          code: ROOT_PROTECTION_CODES.SELF_VIA_APPROVAL_REQUIRED,
          message: 'Root self-termination must use the peer-approval flow.',
        });
      }
      await this.rootProtection.assertNotLastRoot(tenantId, target.id);
    }

    const rows = await this.db.tenantQuery<{ id: number }>(
      `UPDATE users SET is_active = ${IS_ACTIVE.DELETED}, updated_at = NOW()
       WHERE tenant_id = $1 AND uuid = $2 AND role = 'dummy' AND is_active != ${IS_ACTIVE.DELETED}
       RETURNING id`,
      [tenantId, uuid],
    );

    if (rows.length === 0) {
      const [check] = await this.db.tenantQuery<{ id: number }>(
        `SELECT id FROM users WHERE tenant_id = $1 AND uuid = $2 AND role = 'dummy'`,
        [tenantId, uuid],
      );
      if (check === undefined) {
        throw new NotFoundException('Dummy-Benutzer nicht gefunden');
      }
      throw new BadRequestException('Dummy-Benutzer ist bereits gelöscht');
    }

    await this.activityLogger.log({
      tenantId,
      userId: actingUserId,
      action: 'delete',
      entityType: 'dummy_user',
      details: `Dummy-Benutzer gelöscht (soft-delete, uuid: ${uuid})`,
    });
  }

  // ==========================================================================
  // PRIVATE: Email + EmployeeNumber generation
  // ==========================================================================

  private async generateEmail(tenantId: number): Promise<string> {
    const nextRows = await this.db.tenantQuery<{ next_number: number }>(
      `SELECT COALESCE(MAX(
        CAST(SUBSTRING(email FROM 'dummy_(\\d+)@') AS INTEGER)
       ), 0) + 1 AS next_number
       FROM users WHERE tenant_id = $1 AND role = 'dummy'`,
      [tenantId],
    );

    const tenantRows = await this.db.tenantQuery<{ subdomain: string }>(
      `SELECT subdomain FROM tenants WHERE id = $1`,
      [tenantId],
    );

    const tenantRow = tenantRows[0];
    if (tenantRow === undefined) {
      throw new BadRequestException('Tenant nicht gefunden');
    }

    return buildDummyEmail(nextRows[0]?.next_number ?? 1, tenantRow.subdomain);
  }

  private async generateEmployeeNumber(tenantId: number): Promise<string> {
    const nextRows = await this.db.tenantQuery<{ next_number: number }>(
      `SELECT COALESCE(MAX(
        CAST(SUBSTRING(employee_number FROM 'DUMMY-(\\d+)') AS INTEGER)
       ), 0) + 1 AS next_number
       FROM users WHERE tenant_id = $1 AND role = 'dummy'`,
      [tenantId],
    );

    return buildDummyEmployeeNumber(nextRows[0]?.next_number ?? 1);
  }

  // ==========================================================================
  // PRIVATE: Team sync
  // ==========================================================================

  private async syncTeams(tenantId: number, userId: number, teamIds: number[]): Promise<void> {
    // Delete existing assignments
    await this.db.tenantQuery(`DELETE FROM user_teams WHERE user_id = $1 AND tenant_id = $2`, [
      userId,
      tenantId,
    ]);

    // Insert new assignments
    for (const teamId of teamIds) {
      await this.db.tenantQuery(
        `INSERT INTO user_teams (user_id, team_id, tenant_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, team_id) DO NOTHING`,
        [userId, teamId, tenantId],
      );
    }
  }

  // ==========================================================================
  // PRIVATE: Auto-assign read-only permissions
  // ==========================================================================

  private async assignDefaultPermissions(
    tenantId: number,
    userId: number,
    assignedBy: number,
  ): Promise<void> {
    for (const perm of DUMMY_PERMISSIONS) {
      await this.db.tenantQuery(
        `INSERT INTO user_addon_permissions
          (tenant_id, user_id, addon_code, module_code,
           can_read, can_write, can_delete, assigned_by)
         VALUES ($1, $2, $3, $4, true, false, false, $5)
         ON CONFLICT (tenant_id, user_id, addon_code, module_code)
         DO NOTHING`,
        [tenantId, userId, perm.addonCode, perm.moduleCode, assignedBy],
      );
    }

    this.logger.log(
      `Auto-assigned ${DUMMY_PERMISSIONS.length} read-only permissions for dummy user ${userId}`,
    );
  }
}
