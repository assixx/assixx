/**
 * DTOs for Documents Query Parameters
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Access scope values
 */
const ACCESS_SCOPE_VALUES = [
  'personal',
  'team',
  'department',
  'company',
  'payroll',
  'blackboard',
  'chat',
] as const;

/**
 * List documents query schema
 */
const listDocumentsQuerySchema = z.object({
  category: z.string().optional(),
  accessScope: z.enum(ACCESS_SCOPE_VALUES).optional(),
  ownerUserId: z.coerce.number().int().positive().optional(),
  targetTeamId: z.coerce.number().int().positive().optional(),
  targetDepartmentId: z.coerce.number().int().positive().optional(),
  salaryYear: z.coerce.number().int().min(2000).max(2100).optional(),
  salaryMonth: z.coerce.number().int().min(1).max(12).optional(),
  blackboardEntryId: z.coerce.number().int().positive().optional(),
  conversationId: z.coerce.number().int().positive().optional(),
  isActive: z.coerce.number().int().min(0).max(4).optional().default(1),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export class ListDocumentsQueryDto extends createZodDto(listDocumentsQuerySchema) {}
