/**
 * Work Orders Assignees Service
 *
 * Handles user assignment to work orders: bulk-assign, remove,
 * list assignees, and get eligible users (team-filtered).
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { mapAssigneeRowToApi } from './work-orders.helpers.js';
import type {
  EligibleUser,
  WorkOrderAssignee,
  WorkOrderAssigneeWithNameRow,
} from './work-orders.types.js';
import { MAX_ASSIGNEES_PER_WORK_ORDER } from './work-orders.types.js';

@Injectable()
export class WorkOrderAssigneesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** Bulk-assign users to a work order */
  async assignUsers(
    tenantId: number,
    workOrderUuid: string,
    userUuids: string[],
    assignedByUserId: number,
  ): Promise<WorkOrderAssignee[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<WorkOrderAssignee[]> => {
        const wo = await this.resolveWorkOrder(client, tenantId, workOrderUuid);
        const currentCount = await this.countAssignees(client, wo.id);

        if (currentCount + userUuids.length > MAX_ASSIGNEES_PER_WORK_ORDER) {
          throw new BadRequestException(
            `Maximal ${MAX_ASSIGNEES_PER_WORK_ORDER} Zuweisungen pro Auftrag`,
          );
        }

        const rows = await this.insertAssignees(
          client,
          tenantId,
          wo.id,
          userUuids,
          assignedByUserId,
        );

        void this.activityLogger.logCreate(
          tenantId,
          assignedByUserId,
          'work_order',
          wo.id,
          `${rows.length} Benutzer zu "${wo.title}" zugewiesen`,
          { userUuids },
        );

        return rows.map(mapAssigneeRowToApi);
      },
    );
  }

  /** Remove a single assignee from a work order */
  async removeAssignee(
    tenantId: number,
    workOrderUuid: string,
    userUuid: string,
    removedByUserId: number,
  ): Promise<void> {
    const result = await this.db.tenantTransaction(
      async (client: PoolClient): Promise<{ woId: number; title: string }> => {
        const wo = await this.resolveWorkOrder(client, tenantId, workOrderUuid);

        const del = await client.query(
          `DELETE FROM work_order_assignees
           WHERE work_order_id = $1 AND user_id = (
             SELECT id FROM users WHERE uuid = $2 AND tenant_id = $3
           )`,
          [wo.id, userUuid, tenantId],
        );

        if (del.rowCount === 0) {
          throw new NotFoundException('Zuweisung nicht gefunden');
        }

        return { woId: wo.id, title: wo.title };
      },
    );

    void this.activityLogger.logDelete(
      tenantId,
      removedByUserId,
      'work_order',
      result.woId,
      `Benutzer-Zuweisung von "${result.title}" entfernt`,
      { userUuid },
    );
  }

  /** List all assignees for a work order */
  async getAssignees(
    tenantId: number,
    workOrderUuid: string,
  ): Promise<WorkOrderAssignee[]> {
    const rows = await this.db.query<WorkOrderAssigneeWithNameRow>(
      `SELECT a.*, u.first_name, u.last_name
       FROM work_order_assignees a
       JOIN users u ON a.user_id = u.id
       JOIN work_orders wo ON a.work_order_id = wo.id
       WHERE wo.uuid = $1 AND wo.tenant_id = $2 AND wo.is_active = 1`,
      [workOrderUuid, tenantId],
    );
    return rows.map(mapAssigneeRowToApi);
  }

  /** Get eligible users for assignment, optionally filtered by machine teams */
  async getEligibleUsers(
    tenantId: number,
    machineId?: number,
  ): Promise<EligibleUser[]> {
    if (machineId !== undefined) {
      return await this.fetchTeamFilteredUsers(tenantId, machineId);
    }
    return await this.fetchAllEmployees(tenantId);
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async resolveWorkOrder(
    client: PoolClient,
    tenantId: number,
    uuid: string,
  ): Promise<{ id: number; title: string }> {
    const result = await client.query<{ id: number; title: string }>(
      `SELECT id, title FROM work_orders
       WHERE uuid = $1 AND tenant_id = $2 AND is_active = 1
       FOR UPDATE`,
      [uuid, tenantId],
    );
    if (result.rows[0] === undefined) {
      throw new NotFoundException('Arbeitsauftrag nicht gefunden');
    }
    return result.rows[0];
  }

  private async countAssignees(
    client: PoolClient,
    workOrderId: number,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM work_order_assignees
       WHERE work_order_id = $1`,
      [workOrderId],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  private async insertAssignees(
    client: PoolClient,
    tenantId: number,
    workOrderId: number,
    userUuids: string[],
    assignedBy: number,
  ): Promise<WorkOrderAssigneeWithNameRow[]> {
    const rows: WorkOrderAssigneeWithNameRow[] = [];
    for (const userUuid of userUuids) {
      const result = await client.query<WorkOrderAssigneeWithNameRow>(
        `INSERT INTO work_order_assignees (uuid, tenant_id, work_order_id, user_id, assigned_by)
         SELECT $1, $2, $3, u.id, $5
         FROM users u WHERE u.uuid = $4 AND u.tenant_id = $2 AND u.is_active = 1
         ON CONFLICT (work_order_id, user_id) DO NOTHING
         RETURNING *, (SELECT first_name FROM users WHERE id = user_id) AS first_name,
                      (SELECT last_name FROM users WHERE id = user_id) AS last_name`,
        [uuidv7(), tenantId, workOrderId, userUuid, assignedBy],
      );
      if (result.rows[0] !== undefined) {
        rows.push(result.rows[0]);
      }
    }
    return rows;
  }

  /** Team-filtered: only employees belonging to teams assigned to the machine */
  private async fetchTeamFilteredUsers(
    tenantId: number,
    machineId: number,
  ): Promise<EligibleUser[]> {
    const rows = await this.db.query<{
      id: number;
      uuid: string;
      first_name: string;
      last_name: string;
      email: string;
      employee_number: string | null;
    }>(
      `SELECT DISTINCT u.id, u.uuid, u.first_name, u.last_name, u.email, u.employee_number
       FROM users u
       JOIN user_teams ut ON u.id = ut.user_id AND ut.tenant_id = u.tenant_id
       JOIN machine_teams mt ON ut.team_id = mt.team_id AND mt.tenant_id = ut.tenant_id
       WHERE mt.machine_id = $1 AND u.tenant_id = $2 AND u.is_active = 1 AND u.role = 'employee'
       ORDER BY u.last_name, u.first_name`,
      [machineId, tenantId],
    );
    return rows.map(mapEligibleUserRow);
  }

  /** Fallback: all active employees for manual work orders */
  private async fetchAllEmployees(tenantId: number): Promise<EligibleUser[]> {
    const rows = await this.db.query<{
      id: number;
      uuid: string;
      first_name: string;
      last_name: string;
      email: string;
      employee_number: string | null;
    }>(
      `SELECT u.id, u.uuid, u.first_name, u.last_name, u.email, u.employee_number
       FROM users u
       WHERE u.tenant_id = $1 AND u.is_active = 1 AND u.role = 'employee'
       ORDER BY u.last_name, u.first_name`,
      [tenantId],
    );
    return rows.map(mapEligibleUserRow);
  }
}

// ============================================================================
// Module-level pure mapper
// ============================================================================

function mapEligibleUserRow(row: {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_number: string | null;
}): EligibleUser {
  return {
    id: row.id,
    uuid: row.uuid.trim(),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    employeeNumber: row.employee_number,
  };
}
