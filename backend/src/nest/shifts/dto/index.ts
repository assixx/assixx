/**
 * Shifts DTOs Index
 *
 * Re-exports all DTOs for the shifts module.
 */

// Common schemas
export {
  ShiftDateSchema,
  ShiftStatusSchema,
  ShiftTypeSchema,
  SortBySchema,
  SortOrderSchema,
  SwapRequestStatusSchema,
  TimeSchema,
  TimeWithSecondsSchema,
} from './common.dto.js';

// Query DTOs
export { QueryShiftPlanDto, QueryShiftPlanSchema } from './query-shift-plan.dto.js';
export { QueryShiftsDto, QueryShiftsSchema } from './query-shifts.dto.js';

// Calendar DTOs
export { QueryMyCalendarShiftsDto, QueryMyCalendarShiftsSchema } from './calendar-shift.dto.js';

// Create DTOs
export { CreateShiftDto, CreateShiftSchema } from './create-shift.dto.js';
export {
  CreateShiftPlanDto,
  CreateShiftPlanSchema,
  ShiftPlanItemSchema,
} from './shift-plan.dto.js';

// Update DTOs
export { UpdateShiftDto, UpdateShiftSchema } from './update-shift.dto.js';
export { UpdateShiftPlanDto, UpdateShiftPlanSchema } from './update-shift-plan.dto.js';

// Swap Request DTOs
export { CreateSwapRequestDto, CreateSwapRequestSchema } from './create-swap-request.dto.js';
export { QuerySwapRequestsDto, QuerySwapRequestsSchema } from './query-swap-requests.dto.js';
export {
  UpdateSwapRequestStatusDto,
  UpdateSwapRequestStatusSchema,
} from './swap-request-status.dto.js';

// Overtime DTOs
export { QueryOvertimeDto, QueryOvertimeSchema } from './overtime.dto.js';

// Export DTOs
export { ExportShiftsDto, ExportShiftsSchema } from './export-shift.dto.js';

// Favorite DTOs
export { CreateFavoriteDto, CreateFavoriteSchema } from './favorite.dto.js';

// Rotation Common Schemas
export {
  NthWeekdayFreeRuleSchema,
  PatternConfigSchema,
  PatternTypeSchema,
  ShiftBlockTypeSchema,
  ShiftGroupSchema,
} from './rotation-common.dto.js';

// Rotation Pattern DTOs
export {
  CreateRotationPatternDto,
  CreateRotationPatternSchema,
} from './create-rotation-pattern.dto.js';
export {
  UpdateRotationPatternDto,
  UpdateRotationPatternSchema,
} from './update-rotation-pattern.dto.js';

// Rotation Generate DTOs
export {
  AssignUsersToPatternDto,
  AssignUsersToPatternSchema,
} from './assign-users-to-pattern.dto.js';
export {
  GenerateRotationShiftsDto,
  GenerateRotationShiftsSchema,
} from './generate-rotation-shifts.dto.js';

// Rotation Config DTOs
export {
  GenerateRotationFromConfigDto,
  GenerateRotationFromConfigSchema,
} from './rotation-config.dto.js';

// Rotation History DTOs
export {
  DeleteRotationHistoryByDateRangeDto,
  DeleteRotationHistoryByDateRangeSchema,
} from './delete-rotation-history-by-date-range.dto.js';
export {
  QueryRotationHistoryDto,
  QueryRotationHistorySchema,
} from './query-rotation-history.dto.js';

// Rotation Delete DTOs
export { DeleteRotationHistoryDto, DeleteRotationHistorySchema } from './rotation-delete.dto.js';
