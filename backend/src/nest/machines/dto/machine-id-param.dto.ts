/**
 * Machine ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MachineIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Machine ID must be a positive integer'),
});

export class MachineIdParamDto extends createZodDto(MachineIdParamSchema) {}
