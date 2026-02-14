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
  | 'machine'
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
  | 'availability'
  | 'machine_availability'
  | 'vacation'
  | 'vacation_blackout'
  | 'vacation_holiday'
  | 'vacation_staffing_rule'
  | 'vacation_entitlement'
  | 'vacation_settings';

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

@Injectable()
export class ActivityLoggerService {
  private readonly logger = new Logger(ActivityLoggerService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Log an activity to root_logs table
   *
   * This method is fire-and-forget - it will never throw an error.
   * If logging fails, it logs a warning but doesn't interrupt the main flow.
   */
  async log(params: ActivityLogParams): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO root_logs
         (tenant_id, user_id, action, entity_type, entity_id, details, old_values, new_values, ip_address, user_agent, was_role_switched, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          params.tenantId,
          params.userId,
          params.action,
          params.entityType,
          params.entityId ?? null,
          params.details ?? null,
          params.oldValues !== undefined ?
            JSON.stringify(params.oldValues)
          : null,
          params.newValues !== undefined ?
            JSON.stringify(params.newValues)
          : null,
          params.ipAddress ?? null,
          params.userAgent ?? null,
          params.wasRoleSwitched ?? false,
        ],
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
