import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AssignPositionSchema = z.object({
  positionId: z.uuid('positionId muss eine gültige UUID sein'),
});

export class AssignPositionDto extends createZodDto(AssignPositionSchema) {}
