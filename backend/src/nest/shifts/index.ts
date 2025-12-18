/**
 * Shifts Module Index
 *
 * Re-exports all shifts module components.
 */

// Module
export { ShiftsModule } from './shifts.module.js';

// Services
export { ShiftsService } from './shifts.service.js';
export { RotationService } from './rotation.service.js';

// Controllers
export { ShiftsController } from './shifts.controller.js';
export { RotationController } from './rotation.controller.js';

// DTOs
export * from './dto/index.js';

// Service types
export type {
  ShiftResponse,
  ShiftPlanResponse,
  SwapRequestResponse,
  CalendarShiftResponse,
  FavoriteResponse,
  ShiftFilters,
  ShiftPlanFilters,
  SwapRequestFilters,
  OvertimeFilters,
  ExportFilters,
} from './shifts.service.js';

export type {
  RotationPatternResponse,
  RotationAssignmentResponse,
  RotationHistoryResponse,
  GeneratedShiftsResponse,
  DeleteHistoryCountsResponse,
  RotationHistoryFilters,
} from './rotation.service.js';
