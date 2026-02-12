/**
 * Vacation Staffing Rules Service
 *
 * Manages minimum staffing requirements per machine.
 * Each rule says: "Machine X needs at least N operators available."
 * The capacity service uses these rules to determine if a vacation
 * request can be approved without understaffing a machine.
 *
 * Staffing rules table: `vacation_staffing_rules` (Migration 29)
 * - UNIQUE(tenant_id, machine_id) — one rule per machine per tenant
 * - CHECK(min_staff_count \> 0) — must require at least 1 person
 * - RLS enforced via `db.tenantTransaction()` (ADR-019)
 *
 * Used by: Capacity service (machine availability analysis)
 */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { DatabaseService } from '../database/database.service.js';
import type { CreateStaffingRuleDto } from './dto/create-staffing-rule.dto.js';
import type { UpdateStaffingRuleDto } from './dto/update-staffing-rule.dto.js';
import type {
  VacationStaffingRule,
  VacationStaffingRuleRow,
} from './vacation.types.js';

/** Row shape for staffing rule query with machine name JOIN */
interface StaffingRuleWithMachineRow extends VacationStaffingRuleRow {
  machine_name: string | null;
}

@Injectable()
export class VacationStaffingRulesService {
  private readonly logger: Logger = new Logger(
    VacationStaffingRulesService.name,
  );

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all active staffing rules for a tenant.
   * JOINs machines table to include machine name.
   */
  async getStaffingRules(tenantId: number): Promise<VacationStaffingRule[]> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationStaffingRule[]> => {
        const result = await client.query<StaffingRuleWithMachineRow>(
          `SELECT vsr.id, vsr.tenant_id, vsr.machine_id, vsr.min_staff_count,
                  vsr.is_active, vsr.created_by, vsr.created_at, vsr.updated_at,
                  m.name AS machine_name
           FROM vacation_staffing_rules vsr
           LEFT JOIN machines m ON vsr.machine_id = m.id
           WHERE vsr.tenant_id = $1 AND vsr.is_active = 1
           ORDER BY m.name ASC NULLS LAST`,
          [tenantId],
        );

        return result.rows.map((row: StaffingRuleWithMachineRow) =>
          this.mapRowToStaffingRule(row),
        );
      },
    );
  }

  /**
   * Create a new staffing rule for a machine.
   * Throws ConflictException on duplicate (tenant_id, machine_id).
   */
  async createStaffingRule(
    tenantId: number,
    userId: number,
    dto: CreateStaffingRuleDto,
  ): Promise<VacationStaffingRule> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationStaffingRule> => {
        const id: string = uuidv7();

        try {
          const result = await client.query<StaffingRuleWithMachineRow>(
            `WITH inserted AS (
              INSERT INTO vacation_staffing_rules
                (id, tenant_id, machine_id, min_staff_count, created_by)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *
            )
            SELECT ins.id, ins.tenant_id, ins.machine_id, ins.min_staff_count,
                   ins.is_active, ins.created_by, ins.created_at, ins.updated_at,
                   m.name AS machine_name
            FROM inserted ins
            LEFT JOIN machines m ON ins.machine_id = m.id`,
            [id, tenantId, dto.machineId, dto.minStaffCount, userId],
          );

          const row: StaffingRuleWithMachineRow | undefined = result.rows[0];
          if (row === undefined) {
            throw new Error(
              'INSERT into vacation_staffing_rules returned no rows',
            );
          }

          this.logger.log(
            `Staffing rule created: machine ${dto.machineId} → min ${dto.minStaffCount} (tenant ${tenantId})`,
          );
          return this.mapRowToStaffingRule(row);
        } catch (error: unknown) {
          if (this.isUniqueViolation(error)) {
            throw new ConflictException(
              `A staffing rule already exists for machine ${dto.machineId}`,
            );
          }
          throw error;
        }
      },
    );
  }

  /**
   * Update an existing staffing rule.
   * Throws NotFoundException if not found or soft-deleted.
   */
  async updateStaffingRule(
    tenantId: number,
    id: string,
    dto: UpdateStaffingRuleDto,
  ): Promise<VacationStaffingRule> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<VacationStaffingRule> => {
        const result = await client.query<StaffingRuleWithMachineRow>(
          `WITH updated AS (
            UPDATE vacation_staffing_rules
            SET min_staff_count = $1, updated_at = NOW()
            WHERE id = $2 AND tenant_id = $3 AND is_active = 1
            RETURNING *
          )
          SELECT upd.id, upd.tenant_id, upd.machine_id, upd.min_staff_count,
                 upd.is_active, upd.created_by, upd.created_at, upd.updated_at,
                 m.name AS machine_name
          FROM updated upd
          LEFT JOIN machines m ON upd.machine_id = m.id`,
          [dto.minStaffCount, id, tenantId],
        );

        const row: StaffingRuleWithMachineRow | undefined = result.rows[0];
        if (row === undefined) {
          throw new NotFoundException(`Staffing rule ${id} not found`);
        }

        this.logger.log(
          `Staffing rule updated: ${id} → min ${dto.minStaffCount} (tenant ${tenantId})`,
        );
        return this.mapRowToStaffingRule(row);
      },
    );
  }

  /**
   * Soft-delete a staffing rule (is_active = 4).
   * Throws NotFoundException if not found.
   */
  async deleteStaffingRule(tenantId: number, id: string): Promise<void> {
    await this.db.tenantTransaction(
      async (client: PoolClient): Promise<void> => {
        const result = await client.query<{ id: string }>(
          `UPDATE vacation_staffing_rules
           SET is_active = 4, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 AND is_active = 1
           RETURNING id`,
          [id, tenantId],
        );

        if (result.rows[0] === undefined) {
          throw new NotFoundException(`Staffing rule ${id} not found`);
        }

        this.logger.log(
          `Staffing rule soft-deleted: ${id} (tenant ${tenantId})`,
        );
      },
    );
  }

  /**
   * Bulk-query staffing rules for multiple machines.
   * Returns a Map of machineId to minStaffCount for efficient lookup.
   *
   * Used by the capacity service to check all machines in one query
   * instead of N+1 queries per machine.
   */
  async getForMachines(
    tenantId: number,
    machineIds: number[],
  ): Promise<Map<number, number>> {
    if (machineIds.length === 0) {
      return new Map<number, number>();
    }

    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<Map<number, number>> => {
        // Build parameterized IN clause: $2, $3, $4, ...
        const placeholders: string = machineIds
          .map((_: number, i: number) => `$${i + 2}`)
          .join(', ');

        const result = await client.query<
          Pick<VacationStaffingRuleRow, 'machine_id' | 'min_staff_count'>
        >(
          `SELECT machine_id, min_staff_count
           FROM vacation_staffing_rules
           WHERE tenant_id = $1
             AND is_active = 1
             AND machine_id IN (${placeholders})`,
          [tenantId, ...machineIds],
        );

        const ruleMap: Map<number, number> = new Map<number, number>();
        for (const row of result.rows) {
          ruleMap.set(row.machine_id, row.min_staff_count);
        }

        return ruleMap;
      },
    );
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /** Map DB row to API response type (snake_case → camelCase). */
  private mapRowToStaffingRule(
    row: StaffingRuleWithMachineRow,
  ): VacationStaffingRule {
    const base: VacationStaffingRule = {
      id: row.id,
      machineId: row.machine_id,
      minStaffCount: row.min_staff_count,
      createdBy: row.created_by,
      createdAt:
        typeof row.created_at === 'string' ?
          row.created_at
        : new Date(row.created_at).toISOString(),
      updatedAt:
        typeof row.updated_at === 'string' ?
          row.updated_at
        : new Date(row.updated_at).toISOString(),
    };

    if (row.machine_name !== null) {
      base.machineName = row.machine_name;
    }

    return base;
  }

  /** Check if a PostgreSQL error is a unique constraint violation (23505). */
  private isUniqueViolation(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  }
}
