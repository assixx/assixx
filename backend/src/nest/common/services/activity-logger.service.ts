/**
 * Activity Logger Service
 *
 * Centralized service for logging user activities to root_logs table.
 * Used for CRUD operations that should be visible in the Root Dashboard.
 *
 * IMPORTANT: This service should NOT throw errors - logging failures
 * should never break the main operation.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service.js';

/**
 * Supported action types for activity logging
 */
export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'register'
  | 'archive'
  | 'restore'
  | 'assign'
  | 'unassign';

/**
 * Supported entity types for activity logging
 */
export type ActivityEntityType =
  | 'user'
  | 'department'
  | 'team'
  | 'area'
  | 'asset'
  | 'document'
  | 'blackboard'
  | 'kvp'
  | 'survey'
  | 'notification'
  | 'auth'
  | 'tenant'
  | 'settings'
  | 'calendar'
  | 'shift'
  | 'shift_plan'
  | 'shift_swap'
  | 'rotation_pattern'
  | 'rotation_assignment'
  | 'rotation_history'
  | 'availability'
  | 'asset_availability'
  | 'asset_maintenance'
  | 'admin_permission'
  | 'subscription_plan'
  | 'user_profile'
  | 'vacation'
  | 'vacation_blackout'
  | 'vacation_holiday'
  | 'vacation_staffing_rule'
  | 'vacation_entitlement'
  | 'vacation_settings'
  | 'tpm_plan'
  | 'tpm_card'
  | 'tpm_execution'
  | 'tpm_template'
  | 'tpm_time_estimate'
  | 'tpm_color_config'
  | 'tpm_escalation_config'
  | 'tpm_defect'
  | 'work_order'
  | 'work_order_comment'
  | 'work_order_photo'
  | 'dummy_user'
  | 'user_addon_permission'
  | 'hall'
  | 'approval'
  | 'approval_config'
  | 'position_catalog';

/**
 * Parameters for logging an activity
 */
export interface ActivityLogParams {
  /** Tenant ID (required for multi-tenant isolation) */
  tenantId: number;
  /** User ID who performed the action */
  userId: number;
  /** Action performed */
  action: ActivityAction;
  /** Type of entity affected */
  entityType: ActivityEntityType;
  /** ID of the entity affected (optional) */
  entityId?: number | undefined;
  /** Human-readable details (German) */
  details?: string | undefined;
  /** Previous values before change (for update/delete) */
  oldValues?: Record<string, unknown> | undefined;
  /** New values after change (for create/update) */
  newValues?: Record<string, unknown> | undefined;
  /** Client IP address */
  ipAddress?: string | undefined;
  /** Client user agent */
  userAgent?: string | undefined;
  /** Whether this action was performed during role switch */
  wasRoleSwitched?: boolean | undefined;
}

/** Resolved user context for denormalized root_logs columns */
interface UserContext {
  userName: string | null;
  userRole: string | null;
  employeeNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  departmentName: string | null;
  areaName: string | null;
  teamName: string | null;
}

const NULL_CONTEXT: UserContext = {
  userName: null,
  userRole: null,
  employeeNumber: null,
  firstName: null,
  lastName: null,
  departmentName: null,
  areaName: null,
  teamName: null,
};

@Injectable()
export class ActivityLoggerService {
  private readonly logger = new Logger(ActivityLoggerService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Resolve denormalized user context for root_logs snapshot.
   *
   * Captures username, role, employee number, name, department, area, and team
   * at the time of the action. This is the correct behavior for audit logs —
   * if the user later changes department, the old log keeps the old context.
   *
   * Uses LIMIT 1 to handle 1:N user_teams (one user can be in multiple teams).
   * Pool runs as assixx_user (BYPASSRLS) — no tenant context required.
   */
  private async resolveUserContext(userId: number, tenantId: number): Promise<UserContext> {
    try {
      const rows = await this.db.queryAsTenant<{
        username: string | null;
        role: string | null;
        employee_number: string | null;
        first_name: string | null;
        last_name: string | null;
        department_name: string | null;
        area_name: string | null;
        team_name: string | null;
      }>(
        `SELECT u.username, u.role, u.employee_number,
                u.first_name, u.last_name,
                d.name AS department_name, a.name AS area_name, t.name AS team_name
         FROM users u
         LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
         LEFT JOIN departments d ON ud.department_id = d.id
         LEFT JOIN areas a ON d.area_id = a.id
         LEFT JOIN user_teams ut ON u.id = ut.user_id
         LEFT JOIN teams t ON ut.team_id = t.id
         WHERE u.id = $1
         LIMIT 1`,
        [userId],
        tenantId,
      );
      const row = rows[0];
      if (row === undefined) {
        return NULL_CONTEXT;
      }
      return {
        userName: row.username,
        userRole: row.role,
        employeeNumber: row.employee_number,
        firstName: row.first_name,
        lastName: row.last_name,
        departmentName: row.department_name,
        areaName: row.area_name,
        teamName: row.team_name,
      };
    } catch {
      return NULL_CONTEXT;
    }
  }

  /**
   * Log an activity to root_logs table
   *
   * This method is fire-and-forget - it will never throw an error.
   * If logging fails, it logs a warning but doesn't interrupt the main flow.
   *
   * Denormalized user context (name, role, department, area, team) is resolved
   * at INSERT time and stored as a historical snapshot (ADR-009 pattern).
   */
  async log(params: ActivityLogParams): Promise<void> {
    try {
      const ctx = await this.resolveUserContext(params.userId, params.tenantId);

      await this.db.queryAsTenant(
        `INSERT INTO root_logs
         (tenant_id, user_id, action, entity_type, entity_id, details,
          old_values, new_values, ip_address, user_agent, was_role_switched,
          user_name, user_role, employee_number, first_name, last_name,
          department_name, area_name, team_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 $12, $13, $14, $15, $16, $17, $18, $19, NOW())`,
        [
          params.tenantId,
          params.userId,
          params.action,
          params.entityType,
          params.entityId ?? null,
          params.details ?? null,
          params.oldValues !== undefined ? JSON.stringify(params.oldValues) : null,
          params.newValues !== undefined ? JSON.stringify(params.newValues) : null,
          params.ipAddress ?? null,
          params.userAgent ?? null,
          params.wasRoleSwitched ?? false,
          ctx.userName,
          ctx.userRole,
          ctx.employeeNumber,
          ctx.firstName,
          ctx.lastName,
          ctx.departmentName,
          ctx.areaName,
          ctx.teamName,
        ],
        params.tenantId,
      );
    } catch (error: unknown) {
      // NEVER throw - logging failures should not break main operations
      this.logger.warn(
        `Failed to log activity: ${params.action} ${params.entityType}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Convenience method for logging create operations
   */
  async logCreate(
    tenantId: number,
    userId: number,
    entityType: ActivityEntityType,
    entityId: number,
    details: string,
    newValues?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: 'create',
      entityType,
      entityId,
      details,
      newValues,
    });
  }

  /**
   * Convenience method for logging update operations
   */
  async logUpdate(
    tenantId: number,
    userId: number,
    entityType: ActivityEntityType,
    entityId: number,
    details: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: 'update',
      entityType,
      entityId,
      details,
      oldValues,
      newValues,
    });
  }

  /**
   * Convenience method for logging delete operations
   */
  async logDelete(
    tenantId: number,
    userId: number,
    entityType: ActivityEntityType,
    entityId: number,
    details: string,
    oldValues?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: 'delete',
      entityType,
      entityId,
      details,
      oldValues,
    });
  }
}
