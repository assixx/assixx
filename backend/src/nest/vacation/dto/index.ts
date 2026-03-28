/**
 * Vacation DTOs — Barrel Export
 *
 * Re-exports all vacation DTOs and their Zod schemas.
 */
export { CapacityQueryDto, CapacityQuerySchema } from './capacity-query.dto.js';
export { CreateBlackoutDto, CreateBlackoutSchema } from './create-blackout.dto.js';
export { CreateEntitlementDto, CreateEntitlementSchema } from './create-entitlement.dto.js';
export { CreateHolidayDto, CreateHolidaySchema } from './create-holiday.dto.js';
export { CreateStaffingRuleDto, CreateStaffingRuleSchema } from './create-staffing-rule.dto.js';
export {
  CreateVacationRequestDto,
  CreateVacationRequestSchema,
} from './create-vacation-request.dto.js';
export {
  RespondVacationRequestDto,
  RespondVacationRequestSchema,
} from './respond-vacation-request.dto.js';
export { UpdateBlackoutDto, UpdateBlackoutSchema } from './update-blackout.dto.js';
export { UpdateEntitlementDto, UpdateEntitlementSchema } from './update-entitlement.dto.js';
export { UpdateHolidayDto, UpdateHolidaySchema } from './update-holiday.dto.js';
export { UpdateSettingsDto, UpdateSettingsSchema } from './update-settings.dto.js';
export { UpdateStaffingRuleDto, UpdateStaffingRuleSchema } from './update-staffing-rule.dto.js';
export {
  UpdateVacationRequestDto,
  UpdateVacationRequestSchema,
} from './update-vacation-request.dto.js';
export { VacationQueryDto, VacationQuerySchema } from './vacation-query.dto.js';

// Common schemas (for reuse in services/tests)
export {
  DateSchema,
  DaysSchema,
  LimitSchema,
  NonNegativeDaysSchema,
  PageSchema,
  RespondActionSchema,
  VacationHalfDaySchema,
  VacationRequestStatusSchema,
  VacationTypeSchema,
  YearSchema,
} from './common.dto.js';
