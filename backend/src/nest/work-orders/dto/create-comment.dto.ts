/**
 * Work Orders — Create Comment DTO
 *
 * Validates request body for POST /work-orders/:uuid/comments.
 * User documentation and notes about work progress.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Kommentar darf nicht leer sein')
    .max(5000, 'Kommentar darf maximal 5.000 Zeichen lang sein'),
});

export class CreateCommentDto extends createZodDto(CreateCommentSchema) {}
