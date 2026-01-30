/**
 * Rotation Assignment Service
 *
 * Handles user assignments to rotation patterns
 * and assignment validation.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { dbToApi } from '../../utils/fieldMapper.js';
import { DatabaseService } from '../database/database.service.js';
import type { AssignUsersToPatternDto } from './dto/assign-users-to-pattern.dto.js';
import type {
  DbAssignmentRow,
  RotationAssignmentResponse,
} from './rotation.types.js';

@Injectable()
export class RotationAssignmentService {
  private readonly logger = new Logger(RotationAssignmentService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get active assignments for a pattern
   */
  async getPatternAssignments(
    patternId: number,
    tenantId: number,
  ): Promise<RotationAssignmentResponse[]> {
    const rows = await this.databaseService.query<DbAssignmentRow>(
      `SELECT a.*, u.username, u.first_name, u.last_name
       FROM shift_rotation_assignments a
       JOIN users u ON a.user_id = u.id
       WHERE a.pattern_id = $1 AND a.tenant_id = $2 AND a.is_active = 1`,
      [patternId, tenantId],
    );

    return rows.map(
      (row: DbAssignmentRow) =>
        dbToApi(
          row as unknown as Record<string, unknown>,
        ) as RotationAssignmentResponse,
    );
  }

  /**
   * Assign users to rotation pattern
   */
  async assignUsersToPattern(
    dto: AssignUsersToPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationAssignmentResponse[]> {
    this.logger.debug(`Assigning users to pattern for tenant ${tenantId}`);

    // Validate pattern exists
    await this.validatePatternExists(dto.patternId, tenantId);

    // Process each assignment
    for (const assignment of dto.assignments) {
      const { userId: assignUserId, group: shiftGroup } = assignment;

      // Check for existing active assignment
      const existing = await this.databaseService.query<{ id: number }>(
        `SELECT id FROM shift_rotation_assignments
         WHERE tenant_id = $1 AND pattern_id = $2 AND user_id = $3
         AND (ends_at IS NULL OR ends_at > NOW())`,
        [tenantId, dto.patternId, assignUserId],
      );

      if (existing.length > 0 && existing[0] !== undefined) {
        // Update existing assignment
        await this.databaseService.query(
          `UPDATE shift_rotation_assignments
           SET shift_group = $1, starts_at = $2, ends_at = $3, updated_at = NOW()
           WHERE id = $4`,
          [shiftGroup, dto.startsAt, dto.endsAt ?? null, existing[0].id],
        );
      } else {
        // Create new assignment
        const assignmentUuid = uuidv7();
        await this.databaseService.query(
          `INSERT INTO shift_rotation_assignments
           (tenant_id, pattern_id, user_id, team_id, shift_group,
            rotation_order, can_override, starts_at, ends_at, is_active, assigned_by, uuid, uuid_created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
          [
            tenantId,
            dto.patternId,
            assignUserId,
            dto.teamId ?? null,
            shiftGroup,
            0,
            true,
            dto.startsAt,
            dto.endsAt ?? null,
            1,
            userId,
            assignmentUuid,
          ],
        );
      }
    }

    return await this.getPatternAssignments(dto.patternId, tenantId);
  }

  /**
   * Validates that a rotation pattern exists
   */
  private async validatePatternExists(
    patternId: number,
    tenantId: number,
  ): Promise<void> {
    const result = await this.databaseService.query<{ id: number }>(
      'SELECT id FROM shift_rotation_patterns WHERE id = $1 AND tenant_id = $2',
      [patternId, tenantId],
    );
    if (result.length === 0) {
      throw new NotFoundException(`Rotation pattern ${patternId} not found`);
    }
  }

  /**
   * Validates that team exists and is active
   */
  async validateTeamExists(
    teamId: number | null | undefined,
    tenantId: number,
  ): Promise<void> {
    if (teamId === undefined || teamId === null) return;
    const teamResult = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM teams WHERE id = $1 AND tenant_id = $2 AND is_active = 1`,
      [teamId, tenantId],
    );
    if (teamResult.length === 0) {
      throw new BadRequestException(
        `Team with ID ${teamId} does not exist or is not active`,
      );
    }
  }

  /**
   * Validates that all user IDs in assignments exist and are active
   */
  async validateAssignmentUserIds(
    assignments: { userId: number; startGroup: string }[],
    tenantId: number,
  ): Promise<void> {
    if (assignments.length === 0) return;
    const userIds = assignments.map((a: { userId: number }) => a.userId);
    const userResult = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM users WHERE id = ANY($1::int[]) AND tenant_id = $2 AND is_active = 1`,
      [userIds, tenantId],
    );
    const validUserIds = new Set(userResult.map((r: { id: number }) => r.id));
    const invalidUserIds = userIds.filter(
      (id: number) => !validUserIds.has(id),
    );
    if (invalidUserIds.length > 0) {
      throw new BadRequestException(
        `Invalid user IDs in assignments: ${invalidUserIds.join(', ')}. Users must exist and be active.`,
      );
    }
  }
}
