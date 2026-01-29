/**
 * Machine Team Service
 *
 * Sub-service handling machine-team associations.
 * Operates on the machine_teams join table.
 *
 * Called exclusively through the MachinesService facade.
 * Caller is responsible for validating machine existence before calling.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type {
  DbMachineTeamRow,
  MachineTeamResponse,
} from './machines.types.js';

@Injectable()
export class MachineTeamService {
  private readonly logger = new Logger(MachineTeamService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get teams assigned to a machine
   */
  async getMachineTeams(
    machineId: number,
    tenantId: number,
  ): Promise<MachineTeamResponse[]> {
    this.logger.debug(`Getting teams for machine ${machineId}`);

    const rows = await this.db.query<DbMachineTeamRow>(
      `
      SELECT mt.id, mt.team_id, t.name as team_name,
             t.department_id, d.name as department_name,
             mt.is_primary, mt.assigned_at, mt.notes
      FROM machine_teams mt
      JOIN teams t ON mt.team_id = t.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE mt.machine_id = $1 AND mt.tenant_id = $2
      ORDER BY mt.is_primary DESC, t.name ASC
      `,
      [machineId, tenantId],
    );

    return rows.map((row: DbMachineTeamRow) => {
      const team: MachineTeamResponse = {
        id: row.id,
        teamId: row.team_id,
        teamName: row.team_name,
        isPrimary: row.is_primary,
      };

      if (row.department_id !== null) team.departmentId = row.department_id;
      if (row.department_name !== null)
        team.departmentName = row.department_name;
      if (row.assigned_at !== null)
        team.assignedAt = row.assigned_at.toISOString();
      if (row.notes !== null) team.notes = row.notes;

      return team;
    });
  }

  /**
   * Set teams for a machine (bulk operation - replaces all existing assignments)
   */
  async setMachineTeams(
    machineId: number,
    teamIds: number[],
    tenantId: number,
    userId: number,
  ): Promise<MachineTeamResponse[]> {
    this.logger.log(`Setting ${teamIds.length} teams for machine ${machineId}`);

    if (teamIds.length > 0) {
      const placeholders = teamIds
        .map((_: number, i: number) => `$${i + 2}`)
        .join(', ');
      const validTeams = await this.db.query<{ id: number }>(
        `SELECT id FROM teams WHERE id IN (${placeholders}) AND tenant_id = $1`,
        [tenantId, ...teamIds],
      );

      if (validTeams.length !== teamIds.length) {
        throw new BadRequestException('One or more team IDs are invalid');
      }
    }

    await this.db.query(
      'DELETE FROM machine_teams WHERE machine_id = $1 AND tenant_id = $2',
      [machineId, tenantId],
    );

    if (teamIds.length > 0) {
      const values: unknown[] = [];
      const valuePlaceholders: string[] = [];
      let paramIndex = 1;

      for (const teamId of teamIds) {
        valuePlaceholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, false)`,
        );
        values.push(tenantId, machineId, teamId, userId);
        paramIndex += 4;
      }

      await this.db.query(
        `INSERT INTO machine_teams (tenant_id, machine_id, team_id, assigned_by, is_primary)
         VALUES ${valuePlaceholders.join(', ')}`,
        values,
      );
    }

    return await this.getMachineTeams(machineId, tenantId);
  }
}
