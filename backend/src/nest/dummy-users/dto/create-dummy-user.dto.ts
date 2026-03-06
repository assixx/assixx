/**
 * Dummy Users — Create DTO
 *
 * Validates request body for POST /dummy-users.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateDummyUserSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Bezeichnung darf nicht leer sein')
    .max(100, 'Bezeichnung darf maximal 100 Zeichen lang sein'),
  password: z
    .string()
    .min(12, 'Passwort muss mindestens 12 Zeichen lang sein')
    .max(72, 'Passwort darf maximal 72 Zeichen lang sein (BCrypt-Limit)'),
  teamIds: z.array(z.number().int().positive()).default([]),
});

export class CreateDummyUserDto extends createZodDto(CreateDummyUserSchema) {}
