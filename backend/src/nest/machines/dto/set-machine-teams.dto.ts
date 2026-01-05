/**
 * Set Machine Teams DTO
 *
 * Used to assign teams to a machine (bulk operation).
 * Replaces all existing team assignments with the provided list.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SetMachineTeamsSchema = z.object({
  teamIds: z
    .array(z.number().int().positive())
    .min(0)
    .max(50)
    .describe('Array of team IDs to assign to the machine'),
});

export class SetMachineTeamsDto extends createZodDto(SetMachineTeamsSchema) {}
