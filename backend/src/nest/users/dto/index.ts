/**
 * Users DTOs Barrel Export
 */
export { CreateUserDto, CreateUserSchema } from './create-user.dto.js';
export { UpdateUserDto, UpdateUserSchema } from './update-user.dto.js';
export { UpdateProfileDto, UpdateProfileSchema } from './update-profile.dto.js';
export { UpdateAvailabilityDto, UpdateAvailabilitySchema } from './update-availability.dto.js';
export { ListUsersQueryDto, ListUsersQuerySchema } from './list-users-query.dto.js';
export { UserIdParamDto, UserIdParamSchema } from './user-id-param.dto.js';
export { ChangePasswordDto, ChangePasswordSchema } from './change-password.dto.js';
export {
  AvailabilityHistoryQueryDto,
  AvailabilityHistoryQuerySchema,
  type AvailabilityHistoryEntry,
  type AvailabilityHistoryResponse,
  type AvailabilityStatus,
} from './availability-history-query.dto.js';
export {
  UpdateAvailabilityEntryDto,
  UpdateAvailabilityEntrySchema,
} from './update-availability-entry.dto.js';
// Step 2.12 (DD-32 / R15) — self-service email-change two-code 2FA flow.
export { RequestEmailChangeDto, RequestEmailChangeSchema } from './request-email-change.dto.js';
export { VerifyEmailChangeDto, VerifyEmailChangeSchema } from './verify-email-change.dto.js';
