/**
 * Update Escalation Config DTO
 *
 * Zod schema for configuring escalation thresholds.
 * One config row per tenant (UPSERT pattern, no soft-delete).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateEscalationConfigSchema = z.object({
  escalationAfterHours: z
    .number()
    .int()
    .min(1, 'Eskalation muss mindestens nach 1 Stunde erfolgen')
    .max(720, 'Eskalation darf maximal nach 720 Stunden (30 Tage) erfolgen'),
  notifyTeamLead: z.boolean().optional(),
  notifyDepartmentLead: z.boolean().optional(),
});

export class UpdateEscalationConfigDto extends createZodDto(
  UpdateEscalationConfigSchema,
) {}
