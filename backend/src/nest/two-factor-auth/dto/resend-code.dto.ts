/**
 * Resend-Code DTO — body of POST /api/v2/auth/2fa/resend.
 *
 * WHY: The body is intentionally empty — `challengeToken` is read from the
 * httpOnly cookie. The schema exists so `nestjs-zod` can validate (or empty-
 * accept) the payload uniformly with the rest of the controller. Cooldown,
 * resend cap, and TTL extension live in the service layer.
 *
 * References:
 *   - DD-9 (resend cooldown 60 s, extends challenge TTL).
 *   - DD-21 (max 3 resends per challenge token).
 *   - ADR-030: Zod Validation Architecture.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResendCodeSchema = z.object({});

export class ResendCodeDto extends createZodDto(ResendCodeSchema) {}
