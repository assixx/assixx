/**
 * Assign Departments DTO
 *
 * Validation schema for bulk assigning departments to an area.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Assign departments request body schema
 */
export const AssignDepartmentsSchema = z.object({
  departmentIds: z
    .array(z.coerce.number().int().positive('Department ID must be a positive integer'))
    .min(0, 'Department IDs must be an array'),
});

/**
 * Assign Departments DTO class
 */
export class AssignDepartmentsDto extends createZodDto(AssignDepartmentsSchema) {}
