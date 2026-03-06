/**
 * TPM DTOs — Barrel Export
 *
 * Re-exports all TPM DTOs and their Zod schemas.
 */
export { CompleteCardDto, CompleteCardSchema } from './complete-card.dto.js';
export { CreateCardDto, CreateCardSchema } from './create-card.dto.js';
export {
  CreateLocationDto,
  CreateLocationSchema,
} from './create-location.dto.js';
export {
  CreateExecutionDto,
  CreateExecutionSchema,
} from './create-execution.dto.js';
export {
  CreateMaintenancePlanDto,
  CreateMaintenancePlanSchema,
} from './create-maintenance-plan.dto.js';
export {
  CreateTimeEstimateDto,
  CreateTimeEstimateSchema,
} from './create-time-estimate.dto.js';
export {
  RespondExecutionDto,
  RespondExecutionSchema,
} from './respond-execution.dto.js';
export { UpdateCardDto, UpdateCardSchema } from './update-card.dto.js';
export {
  UpdateLocationDto,
  UpdateLocationSchema,
} from './update-location.dto.js';
export {
  UpdateColorConfigDto,
  UpdateColorConfigSchema,
} from './update-color-config.dto.js';
export {
  UpdateEscalationConfigDto,
  UpdateEscalationConfigSchema,
} from './update-escalation-config.dto.js';
export {
  UpdateMaintenancePlanDto,
  UpdateMaintenancePlanSchema,
} from './update-maintenance-plan.dto.js';
// Query DTOs (controller-specific, 1 class per file)
export {
  AvailableSlotsQueryDto,
  AvailableSlotsQuerySchema,
} from './available-slots-query.dto.js';
export { BoardQueryDto, BoardQuerySchema } from './board-query.dto.js';
export {
  CheckDuplicateDto,
  CheckDuplicateSchema,
} from './check-duplicate.dto.js';
export {
  ListCardsQueryDto,
  ListCardsQuerySchema,
} from './list-cards-query.dto.js';
export {
  ListExecutionsQueryDto,
  ListExecutionsQuerySchema,
} from './list-executions-query.dto.js';
export {
  ListPlansQueryDto,
  ListPlansQuerySchema,
} from './list-plans-query.dto.js';
export {
  AssetSlotsQueryDto,
  AssetSlotsQuerySchema,
} from './asset-slots-query.dto.js';

// Common schemas (for reuse in services/controllers/tests)
export {
  HexColorSchema,
  LimitSchema,
  MinutesSchema,
  PageSchema,
  StaffCountSchema,
  TimeSchema,
  TpmApprovalActionSchema,
  TpmCardRoleSchema,
  TpmCardStatusSchema,
  TpmIntervalTypeSchema,
  UuidParamDto,
  UuidParamSchema,
  WeekdaySchema,
} from './common.dto.js';
