/**
 * Shifts Module
 *
 * NestJS module for shift management and rotation patterns.
 * Provides CRUD operations for shifts, swap requests, favorites,
 * and complex rotation pattern scheduling.
 */
import { Module } from '@nestjs/common';

import { RotationAssignmentService } from './rotation-assignment.service.js';
import { RotationGeneratorService } from './rotation-generator.service.js';
import { RotationHistoryService } from './rotation-history.service.js';
import { RotationPatternService } from './rotation-pattern.service.js';
import { RotationController } from './rotation.controller.js';
import { RotationService } from './rotation.service.js';
import { ShiftPlansService } from './shift-plans.service.js';
import { ShiftSwapService } from './shift-swap.service.js';
import { ShiftTimesController } from './shift-times.controller.js';
import { ShiftTimesService } from './shift-times.service.js';
import { ShiftsPermissionRegistrar } from './shifts-permission.registrar.js';
import { ShiftsController } from './shifts.controller.js';
import { ShiftsService } from './shifts.service.js';

@Module({
  controllers: [ShiftsController, RotationController, ShiftTimesController],
  providers: [
    ShiftsService,
    ShiftPlansService,
    ShiftSwapService,
    ShiftTimesService,
    RotationService,
    RotationPatternService,
    RotationAssignmentService,
    RotationGeneratorService,
    RotationHistoryService,
    // Permission registration (ADR-020)
    ShiftsPermissionRegistrar,
  ],
  exports: [ShiftsService, RotationService, ShiftTimesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class ShiftsModule {}
