/**
 * Refresh Token DTO
 *
 * Validation schema for token refresh requests.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Refresh token request body schema
 */
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
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
