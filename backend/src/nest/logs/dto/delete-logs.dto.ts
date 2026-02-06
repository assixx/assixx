/**
 * Delete Logs DTO
 *
 * Request body for deleting system logs.
 * Requires password confirmation for security.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Delete logs request body schema
 * search: Multi-field search across users, departments, areas, teams
 */
export const DeleteLogsBodySchema = z.object({
  userId: IdSchema.optional(),
  tenantId: IdSchema.optional(),
  action: z.string().trim().min(1, 'Action must be a non-empty string').optional(),
  entityType: z.string().trim().min(1, 'Entity type must be a non-empty string').optional(),
  olderThanDays: z.number().int().min(0, 'Days must be a non-negative integer').optional(),
  search: z.string().trim().optional(),
  confirmPassword: z.string().min(1, 'Password confirmation is required for log deletion'),
});

/**
 * DTO for delete logs request body
 */
export class DeleteLogsBodyDto extends createZodDto(DeleteLogsBodySchema) {}

/**
 * Response type for delete logs endpoint
 */
export interface DeleteLogsResponseData {
  message: string;
  deletedCount: number;
}
