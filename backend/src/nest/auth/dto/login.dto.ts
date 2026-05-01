/**
 * Login DTO
 *
 * Validation schema for login requests using Zod.
 * Reuses existing schemas from common.schema.ts
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema } from '../../../schemas/common.schema.js';

/**
 * Login password schema — intentionally lightweight.
 *
 * WHY (ADR-056, 2026-04-30): the strict `PasswordSchema` from common.schema.ts
 * (4-of-4 categories + ASCII whitelist + min 12) MUST NOT be applied at login.
 * Login is a bcrypt-compare path and never sets a password — re-validating the
 * plaintext at this gate breaks two contracts:
 *
 *   1. Anti-enumeration (FEAT_2FA_EMAIL §R10): wrong-password and unknown-email
 *      must both return 401 with an identical envelope. A 400 here would leak
 *      the password policy and create a distinguishable signal an attacker can
 *      probe ("did the validator reject me, or did auth?").
 *
 *   2. Legacy-user login (ADR-056 R4 "No regression for existing users"):
 *      any pre-policy password (3-of-4 or non-ASCII) would be permanently
 *      locked out at 400 — the user could never authenticate again.
 *
 * Bound only at the bcrypt input limit (72 bytes / chars — ASCII-equivalent
 * here since we never see the plaintext past auth.service.ts) as a DoS guard
 * against mega-payloads. No min — empty string falls through to bcrypt-compare
 * which returns false → 401, preserving R10 symmetry.
 */
const LoginPasswordSchema = z.string().max(72, 'Password cannot exceed 72 characters');

/**
 * Login request body schema
 */
export const LoginSchema = z.object({
  email: EmailSchema,
  password: LoginPasswordSchema,
});

/**
 * Login DTO class
 * Provides type inference and validation
 */
export class LoginDto extends createZodDto(LoginSchema) {}

/**
 * Login response type
 * Note: Using explicit `| undefined` instead of `?` for exactOptionalPropertyTypes compliance
 *
 * `subdomain` is the tenant's routing slug (ADR-050). Always present in the
 * shape; `null` when the tenant has no subdomain populated (legacy / orphan
 * case — in greenfield prod every tenant is guaranteed to have one via the
 * signup DTO regex, but the type stays nullable for safety). The frontend
 * login action uses it to detect "logged in on apex, must redirect to
 * tenant subdomain" (Session 12c handoff branch).
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName: string | undefined;
    lastName: string | undefined;
    role: string;
    tenantId: number;
    subdomain: string | null;
  };
}
