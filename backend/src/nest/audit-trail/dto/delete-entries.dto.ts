/**
 * Delete Old Entries DTO
 *
 * Request body for deleting old audit entries (data retention).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Delete old entries request body schema
 */
export const DeleteOldEntriesBodySchema = z.object({
  olderThanDays: z.number().int().min(90, 'Must specify days (minimum 90)'),
  confirmPassword: z
    .string()
    .min(1, 'Password confirmation required for this action'),
});

/**
 * DTO for delete old entries request body
 */
export class DeleteOldEntriesBodyDto extends createZodDto(
  DeleteOldEntriesBodySchema,
) {}

/**
 * Response type for delete old entries
 */
export interface DeleteOldEntriesResponseData {
  deletedCount: number;
  cutoffDate: string;
}
