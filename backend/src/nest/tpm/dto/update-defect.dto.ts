/**
 * Update Defect DTO
 *
 * Partial update of a TPM execution defect (title, description).
 * At least one field must be provided.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateDefectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Mängelbezeichnung darf nicht leer sein')
      .max(500, 'Mängelbezeichnung darf maximal 500 Zeichen lang sein')
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, 'Beschreibung darf maximal 5.000 Zeichen lang sein')
      .nullish(),
  })
  .refine(
    (data: { title?: string; description?: string | null }) =>
      data.title !== undefined || data.description !== undefined,
    { message: 'Mindestens ein Feld (title oder description) erforderlich' },
  );

export class UpdateDefectDto extends createZodDto(UpdateDefectSchema) {}
