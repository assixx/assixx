/**
 * Set Full Access DTO
 *
 * Set full access (PATCH /:userId/full-access)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetFullAccessSchema = z.object({
  hasFullAccess: z.boolean(),
});

export class SetFullAccessDto extends createZodDto(SetFullAccessSchema) {}
