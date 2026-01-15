/**
 * Refresh Token DTO
 *
 * Validation schema for token refresh requests.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Refresh token request body schema
 *
 * NOTE: refreshToken is optional because SSR clients use HttpOnly cookies.
 * The controller falls back to req.cookies['refreshToken'] if body is empty.
 * SPA clients can still send token in body for backwards compatibility.
 */
export const RefreshSchema = z.object({
  refreshToken: z.string().default(''),
});

/**
 * Refresh DTO class
 */
export class RefreshDto extends createZodDto(RefreshSchema) {}

/**
 * Refresh response type
 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
