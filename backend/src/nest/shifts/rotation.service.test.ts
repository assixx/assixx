/**
 * Unit tests for RotationService (Facade)
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Admin role guard (assertAdminRole), delegation to
 *        pattern/assignment/generator/history sub-services.
 */
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RotationAssignmentService } from './rotation-assignment.service.js';
import type { RotationGeneratorService } from './rotation-generator.service.js';
import type { RotationHistoryService } from './rotation-history.service.js';
import type { RotationPatternService } from './rotation-pattern.service.js';
import { RotationService } from './rotation.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockPatternService() {
  return {
    getRotationPatterns: vi.fn().mockResolvedValue([]),
    getRotationPattern: vi.fn().mockResolvedValue({ id: 1, name: 'Pattern' }),
    createRotationPattern: vi.fn().mockResolvedValue({ id: 1 }),
    updateRotationPattern: vi.fn().mockResolvedValue({ id: 1 }),
    deleteRotationPattern: vi.fn().mockResolvedValue(undefined),
    getRotationPatternByUuid: vi.fn().mockResolvedValue({ id: 1 }),
    updateRotationPatternByUuid: vi.fn().mockResolvedValue({ id: 1 }),
    deleteRotationPatternByUuid: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockAssignmentService() {
  return {
    assignUsersToPattern: vi.fn().mockResolvedValue([]),
    validateTeamExists: vi.fn().mockResolvedValue(undefined),
    validateAssignmentUserIds: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockGeneratorService() {
  return {
    generateRotationShifts: vi.fn().mockResolvedValue({ shifts: [] }),
    generateRotationFromConfig: vi.fn().mockResolvedValue({}),
  };
}

function createMockHistoryService() {
  return {
    getRotationHistory: vi.fn().mockResolvedValue([]),
    deleteRotationHistory: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    deleteRotationHistoryByDateRange: vi
      .fn()
      .mockResolvedValue({ deletedCount: 0 }),
    deleteRotationHistoryEntry: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================
// RotationService
// =============================================================

describe('RotationService', () => {
  let service: RotationService;
  let mockPatternService: ReturnType<typeof createMockPatternService>;
  let mockAssignmentService: ReturnType<typeof createMockAssignmentService>;
  let mockGeneratorService: ReturnType<typeof createMockGeneratorService>;
  let mockHistoryService: ReturnType<typeof createMockHistoryService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPatternService = createMockPatternService();
    mockAssignmentService = createMockAssignmentService();
    mockGeneratorService = createMockGeneratorService();
    mockHistoryService = createMockHistoryService();
    service = new RotationService(
      mockPatternService as unknown as RotationPatternService,
      mockAssignmentService as unknown as RotationAssignmentService,
      mockGeneratorService as unknown as RotationGeneratorService,
      mockHistoryService as unknown as RotationHistoryService,
    );
  });

  // =============================================================
  // assertAdminRole
  // =============================================================

  describe('admin role guard', () => {
    it('should throw ForbiddenException for employee on create', async () => {
      await expect(
        service.createRotationPattern({} as never, 10, 1, 'employee'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin on create', async () => {
      await service.createRotationPattern({} as never, 10, 1, 'admin');

      expect(mockPatternService.createRotationPattern).toHaveBeenCalled();
    });

    it('should allow root on create', async () => {
      await service.createRotationPattern({} as never, 10, 1, 'root');

      expect(mockPatternService.createRotationPattern).toHaveBeenCalled();
    });
  });

  // =============================================================
  // Pattern delegation
  // =============================================================

  describe('getRotationPatterns', () => {
    it('should delegate to patternService', async () => {
      await service.getRotationPatterns(10);

      expect(mockPatternService.getRotationPatterns).toHaveBeenCalledWith(
        10,
        true,
      );
    });
  });

  describe('deleteRotationPattern', () => {
    it('should check admin role then delegate', async () => {
      await service.deleteRotationPattern(1, 10, 'admin', 5);

      expect(mockPatternService.deleteRotationPattern).toHaveBeenCalledWith(
        1,
        10,
        5,
      );
    });
  });

  // =============================================================
  // UUID pattern delegation
  // =============================================================

  describe('getRotationPatternByUuid', () => {
    it('should delegate to patternService', async () => {
      await service.getRotationPatternByUuid('uuid-1', 10);

      expect(mockPatternService.getRotationPatternByUuid).toHaveBeenCalledWith(
        'uuid-1',
        10,
      );
    });
  });

  // =============================================================
  // Assignment delegation
  // =============================================================

  describe('assignUsersToPattern', () => {
    it('should check admin role then delegate', async () => {
      await service.assignUsersToPattern({} as never, 10, 1, 'admin');

      expect(mockAssignmentService.assignUsersToPattern).toHaveBeenCalled();
    });
  });

  // =============================================================
  // Generation delegation
  // =============================================================

  describe('generateRotationShifts', () => {
    it('should resolve pattern then generate', async () => {
      await service.generateRotationShifts(
        { patternId: 1 } as never,
        10,
        1,
        'admin',
      );

      expect(mockPatternService.getRotationPattern).toHaveBeenCalledWith(1, 10);
      expect(mockGeneratorService.generateRotationShifts).toHaveBeenCalled();
    });
  });

  // =============================================================
  // History delegation
  // =============================================================

  describe('getRotationHistory', () => {
    it('should delegate to historyService', async () => {
      await service.getRotationHistory(10, {});

      expect(mockHistoryService.getRotationHistory).toHaveBeenCalledWith(
        10,
        {},
      );
    });
  });

  describe('deleteRotationHistory', () => {
    it('should check admin role then delegate', async () => {
      await service.deleteRotationHistory(10, 5, 'admin', 1);

      expect(mockHistoryService.deleteRotationHistory).toHaveBeenCalledWith(
        10,
        5,
        1,
        undefined,
      );
    });
  });
});
