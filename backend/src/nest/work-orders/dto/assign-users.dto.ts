/**
 * Work Orders — Assign Users DTO
 *
 * Validates request body for POST /work-orders/:uuid/assignees.
 * Accepts array of user UUIDs to bulk-assign.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AssignUsersSchema = z.object({
  userUuids: z
    .array(z.uuid())
    .min(1, 'Mindestens ein Benutzer muss zugewiesen werden')
    .max(10, 'Maximal 10 Zuweisungen pro Auftrag'),
});

export class AssignUsersDto extends createZodDto(AssignUsersSchema) {}
