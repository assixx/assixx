/**
 * Update Department DTO
 *
 * Validation schema for updating departments.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Update department request body schema (all fields optional)
 */
export const UpdateDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters')
    .max(100, 'Department name must not exceed 100 characters')
    .optional(),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').nullish(),
  departmentLeadId: z.coerce
    .number()
    .int()
    .positive('Department lead ID must be a positive integer')
    .nullable()
    .optional(),
  departmentDeputyLeadId: z.coerce
    .number()
    .int()
    .positive('Department deputy lead ID must be a positive integer')
    .nullable()
    .optional(),
  areaId: z.coerce
    .number()
    .int()
    .positive('Area ID must be a positive integer')
    .nullable()
    .optional(),
  isActive: z.coerce.number().int().min(0).max(4).optional(),
});

/**
 * Update Department DTO class
 */
export class UpdateDepartmentDto extends createZodDto(UpdateDepartmentSchema) {}
