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
import { ShiftsController } from './shifts.controller.js';
import { ShiftsService } from './shifts.service.js';

@Module({
  controllers: [ShiftsController, RotationController],
  providers: [
    ShiftsService,
    RotationService,
    RotationPatternService,
    RotationAssignmentService,
    RotationGeneratorService,
    RotationHistoryService,
  ],
  exports: [ShiftsService, RotationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class ShiftsModule {}
