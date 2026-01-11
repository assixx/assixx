/**
 * Add Machine DTO
 *
 * Validation schema for adding machines to teams.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Add machine request body
 */
export const AddMachineSchema = z.object({
  machineId: z.coerce.number().int().positive('Machine ID must be a positive integer'),
});

/**
 * Add Machine DTO class
 */
export class AddMachineDto extends createZodDto(AddMachineSchema) {}
