/**
 * Two-Factor Auth DTOs — Barrel Export.
 *
 * Pattern matches `auth/dto/index.ts`: explicit named re-exports (NOT
 * `export *`) so consumers see exactly which classes/schemas are public API.
 */
export { ClearLockoutParamDto } from './clear-lockout-param.dto.js';
export { ResendCodeDto, ResendCodeSchema } from './resend-code.dto.js';
export { VerifyCodeDto, VerifyCodeSchema } from './verify-code.dto.js';
