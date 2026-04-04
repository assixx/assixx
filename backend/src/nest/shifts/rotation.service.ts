/**
 * Rotation Service (Facade)
 *
 * Thin orchestration layer for shift rotation management.
 * Delegates all business logic to specialized sub-services.
 *
 * Authorization is handled at the controller level via @RequirePermission decorators.
 *
 * Sub-services:
 * - RotationPatternService: Pattern CRUD + UUID resolution
 * - RotationAssignmentService: User assignments + validation
 * - RotationGeneratorService: Shift generation engine
 * - RotationHistoryService: History queries + deletion
 */
import { Injectable } from '@nestjs/common';

import type { AssignUsersToPatternDto } from './dto/assign-users-to-pattern.dto.js';
import type { CreateRotationPatternDto } from './dto/create-rotation-pattern.dto.js';
import type { GenerateRotationShiftsDto } from './dto/generate-rotation-shifts.dto.js';
import type { GenerateRotationFromConfigDto } from './dto/rotation-config.dto.js';
import type { UpdateRotationPatternDto } from './dto/update-rotation-pattern.dto.js';
import { RotationAssignmentService } from './rotation-assignment.service.js';
import { RotationGeneratorService } from './rotation-generator.service.js';
import { RotationHistoryService } from './rotation-history.service.js';
import { RotationPatternService } from './rotation-pattern.service.js';
import type {
  DeleteHistoryCountsResponse,
  GeneratedShiftsResponse,
  RotationAssignmentResponse,
  RotationHistoryFilters,
  RotationHistoryResponse,
  RotationPatternResponse,
} from './rotation.types.js';

export type {
  DeleteHistoryCountsResponse,
  GeneratedShiftsResponse,
  RotationAssignmentResponse,
  RotationHistoryFilters,
  RotationHistoryResponse,
  RotationPatternResponse,
} from './rotation.types.js';

@Injectable()
export class RotationService {
  constructor(
    private readonly patternService: RotationPatternService,
    private readonly assignmentService: RotationAssignmentService,
    private readonly generatorService: RotationGeneratorService,
    private readonly historyService: RotationHistoryService,
  ) {}

  // ============================================================
  // PATTERN OPERATIONS
  // ============================================================

  /** Get all rotation patterns */
  async getRotationPatterns(
    tenantId: number,
    activeOnly: boolean = true,
  ): Promise<RotationPatternResponse[]> {
    return await this.patternService.getRotationPatterns(tenantId, activeOnly);
  }

  /** Get single rotation pattern by ID */
  async getRotationPattern(patternId: number, tenantId: number): Promise<RotationPatternResponse> {
    return await this.patternService.getRotationPattern(patternId, tenantId);
  }

  /** Create rotation pattern */
  async createRotationPattern(
    dto: CreateRotationPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationPatternResponse> {
    return await this.patternService.createRotationPattern(dto, tenantId, userId);
  }

  /** Update rotation pattern */
  async updateRotationPattern(
    patternId: number,
    dto: UpdateRotationPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationPatternResponse> {
    return await this.patternService.updateRotationPattern(patternId, dto, tenantId, userId);
  }

  /** Delete rotation pattern */
  async deleteRotationPattern(patternId: number, tenantId: number, userId: number): Promise<void> {
    await this.patternService.deleteRotationPattern(patternId, tenantId, userId);
  }

  // ============================================================
  // UUID PATTERN OPERATIONS
  // ============================================================

  /** Get rotation pattern by UUID */
  async getRotationPatternByUuid(uuid: string, tenantId: number): Promise<RotationPatternResponse> {
    return await this.patternService.getRotationPatternByUuid(uuid, tenantId);
  }

  /** Update rotation pattern by UUID */
  async updateRotationPatternByUuid(
    uuid: string,
    dto: UpdateRotationPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationPatternResponse> {
    return await this.patternService.updateRotationPatternByUuid(uuid, dto, tenantId, userId);
  }

  /** Delete rotation pattern by UUID */
  async deleteRotationPatternByUuid(uuid: string, tenantId: number, userId: number): Promise<void> {
    await this.patternService.deleteRotationPatternByUuid(uuid, tenantId, userId);
  }

  // ============================================================
  // ASSIGNMENT OPERATIONS
  // ============================================================

  /** Assign users to rotation pattern */
  async assignUsersToPattern(
    dto: AssignUsersToPatternDto,
    tenantId: number,
    userId: number,
  ): Promise<RotationAssignmentResponse[]> {
    return await this.assignmentService.assignUsersToPattern(dto, tenantId, userId);
  }

  // ============================================================
  // GENERATION OPERATIONS
  // ============================================================

  /** Generate rotation shifts from pattern */
  async generateRotationShifts(
    dto: GenerateRotationShiftsDto,
    tenantId: number,
    userId: number,
  ): Promise<GeneratedShiftsResponse> {
    const pattern = await this.patternService.getRotationPattern(dto.patternId, tenantId);
    return await this.generatorService.generateRotationShifts(pattern, dto, tenantId, userId);
  }

  /** Generate rotation shifts from algorithm config */
  async generateRotationFromConfig(
    dto: GenerateRotationFromConfigDto,
    tenantId: number,
    userId: number,
  ): Promise<Record<string, unknown>> {
    await this.assignmentService.validateTeamExists(dto.teamId, tenantId);
    await this.assignmentService.validateAssignmentUserIds(dto.assignments, tenantId);
    return await this.generatorService.generateRotationFromConfig(dto, tenantId, userId);
  }

  // ============================================================
  // HISTORY OPERATIONS
  // ============================================================

  /** Get rotation history */
  async getRotationHistory(
    tenantId: number,
    filters: RotationHistoryFilters,
  ): Promise<RotationHistoryResponse[]> {
    return await this.historyService.getRotationHistory(tenantId, filters);
  }

  /** Delete rotation history for a team */
  async deleteRotationHistory(
    tenantId: number,
    teamId: number,
    userId: number,
    patternId?: number,
  ): Promise<DeleteHistoryCountsResponse> {
    return await this.historyService.deleteRotationHistory(tenantId, teamId, userId, patternId);
  }

  /** Delete rotation history by date range */
  async deleteRotationHistoryByDateRange(
    tenantId: number,
    teamId: number,
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<DeleteHistoryCountsResponse> {
    return await this.historyService.deleteRotationHistoryByDateRange(
      tenantId,
      teamId,
      userId,
      startDate,
      endDate,
    );
  }

  /** Delete single rotation history entry */
  async deleteRotationHistoryEntry(
    historyId: number,
    tenantId: number,
    userId: number,
  ): Promise<void> {
    await this.historyService.deleteRotationHistoryEntry(historyId, tenantId, userId);
  }
}
