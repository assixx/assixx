/**
 * Rotation Service (Facade)
 *
 * Thin orchestration layer for shift rotation management.
 * Delegates all business logic to specialized sub-services.
 * Handles authorization checks and cross-service coordination.
 *
 * Sub-services:
 * - RotationPatternService: Pattern CRUD + UUID resolution
 * - RotationAssignmentService: User assignments + validation
 * - RotationGeneratorService: Shift generation engine
 * - RotationHistoryService: History queries + deletion
 */
import { ForbiddenException, Injectable } from '@nestjs/common';

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

// Re-export types for backwards compatibility (controller + index.ts import from here)
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
    userRole: string,
  ): Promise<RotationPatternResponse> {
    this.assertAdminRole(userRole, 'create rotation patterns');
    return await this.patternService.createRotationPattern(dto, tenantId, userId);
  }

  /** Update rotation pattern */
  async updateRotationPattern(
    patternId: number,
    dto: UpdateRotationPatternDto,
    tenantId: number,
    userRole: string,
    userId: number,
  ): Promise<RotationPatternResponse> {
    this.assertAdminRole(userRole, 'update rotation patterns');
    return await this.patternService.updateRotationPattern(patternId, dto, tenantId, userId);
  }

  /** Delete rotation pattern */
  async deleteRotationPattern(
    patternId: number,
    tenantId: number,
    userRole: string,
    userId: number,
  ): Promise<void> {
    this.assertAdminRole(userRole, 'delete rotation patterns');
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
    userRole: string,
    userId: number,
  ): Promise<RotationPatternResponse> {
    this.assertAdminRole(userRole, 'update rotation patterns');
    return await this.patternService.updateRotationPatternByUuid(uuid, dto, tenantId, userId);
  }

  /** Delete rotation pattern by UUID */
  async deleteRotationPatternByUuid(
    uuid: string,
    tenantId: number,
    userRole: string,
    userId: number,
  ): Promise<void> {
    this.assertAdminRole(userRole, 'delete rotation patterns');
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
    userRole: string,
  ): Promise<RotationAssignmentResponse[]> {
    this.assertAdminRole(userRole, 'assign users to patterns');
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
    userRole: string,
  ): Promise<GeneratedShiftsResponse> {
    this.assertAdminRole(userRole, 'generate rotation shifts');
    const pattern = await this.patternService.getRotationPattern(dto.patternId, tenantId);
    return await this.generatorService.generateRotationShifts(pattern, dto, tenantId, userId);
  }

  /** Generate rotation shifts from algorithm config */
  async generateRotationFromConfig(
    dto: GenerateRotationFromConfigDto,
    tenantId: number,
    userId: number,
    userRole: string,
  ): Promise<Record<string, unknown>> {
    this.assertAdminRole(userRole, 'generate rotation shifts');
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
    userRole: string,
    userId: number,
    patternId?: number,
  ): Promise<DeleteHistoryCountsResponse> {
    this.assertAdminRole(userRole, 'delete rotation history');
    return await this.historyService.deleteRotationHistory(tenantId, teamId, userId, patternId);
  }

  /** Delete rotation history by date range */
  async deleteRotationHistoryByDateRange(
    tenantId: number,
    teamId: number,
    userRole: string,
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<DeleteHistoryCountsResponse> {
    this.assertAdminRole(userRole, 'delete rotation history');
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
    userRole: string,
    userId: number,
  ): Promise<void> {
    this.assertAdminRole(userRole, 'delete rotation history entries');
    await this.historyService.deleteRotationHistoryEntry(historyId, tenantId, userId);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Assert that the user has admin or root role
   */
  private assertAdminRole(userRole: string, action: string): void {
    if (userRole !== 'admin' && userRole !== 'root') {
      throw new ForbiddenException(`Only admins can ${action}`);
    }
  }
}
