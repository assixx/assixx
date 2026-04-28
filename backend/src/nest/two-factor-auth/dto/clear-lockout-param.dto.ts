/**
 * Clear-Lockout Param DTO — `:id` for POST /api/v2/users/:id/2fa/clear-lockout.
 *
 * WHY: Re-uses the central `IdParamDto` factory per TYPESCRIPT-STANDARDS §7.5
 * + ADR-030. Inline `z.coerce.number().int().positive()` in `*-param.dto.ts`
 * files is forbidden (architectural test in shared/src/architectural.test.ts
 * fails CI on violations).
 *
 * References:
 *   - DD-8: lockout-clear is NOT a 2FA bypass — it only clears the 15-min
 *     lockout state from `MAX_ATTEMPTS` (DD-5) wrong codes. The user must
 *     still pass 2FA on next login.
 *   - ADR-030: Zod Validation Architecture.
 */
export { IdParamDto as ClearLockoutParamDto } from '../../common/dto/index.js';
