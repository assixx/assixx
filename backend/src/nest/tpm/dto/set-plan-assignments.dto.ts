/**
 * Set Plan Assignments DTO
 *
 * Body for POST /tpm/plans/:uuid/assignments.
 * Replaces all assignments for a plan on a given date with the provided user IDs.
 * Empty userIds array removes all assignments for that date.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const SetPlanAssignmentsSchema = z.object({
  userIds: z.array(z.number().int().positive()).max(50, 'Maximal 50 Mitarbeiter pro Zuweisung'),
  scheduledDate: z.string().regex(DATE_REGEX, 'Datum muss im Format YYYY-MM-DD sein'),
});

export class SetPlanAssignmentsDto extends createZodDto(SetPlanAssignmentsSchema) {}
