/**
 * Dummy Users — Update DTO
 *
 * Validates request body for PUT /dummy-users/:uuid.
 * All fields optional — only provided fields are updated.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateDummyUserSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Bezeichnung darf nicht leer sein')
    .max(100, 'Bezeichnung darf maximal 100 Zeichen lang sein')
    .optional(),
  password: z
    .string()
    .min(12, 'Passwort muss mindestens 12 Zeichen lang sein')
    .max(72, 'Passwort darf maximal 72 Zeichen lang sein (BCrypt-Limit)')
    .optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  isActive: z.coerce
    .number()
    .int()
    .refine(
      (v: number) => [0, 1, 3].includes(v),
      'isActive muss 0 (inaktiv), 1 (aktiv), oder 3 (archiviert) sein',
    )
    .optional(),
});

export class UpdateDummyUserDto extends createZodDto(UpdateDummyUserSchema) {}
