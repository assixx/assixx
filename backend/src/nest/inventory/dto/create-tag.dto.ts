/**
 * Create Inventory Tag DTO
 *
 * Zod schema for creating an inventory tag explicitly (e.g., when an admin
 * sets up a tag with a specific icon ahead of attaching it to a list).
 *
 * Tags are also created implicitly via list create/update — the
 * `getOrCreate` flow uses this same name validation but skips the icon.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { MAX_TAG_NAME_LENGTH } from '../inventory.types.js';

export const CreateTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tag-Name ist erforderlich')
    .max(
      MAX_TAG_NAME_LENGTH,
      `Tag-Name darf maximal ${String(MAX_TAG_NAME_LENGTH)} Zeichen lang sein`,
    ),
  icon: z.string().trim().max(50, 'Icon darf maximal 50 Zeichen lang sein').nullish(),
});

export class CreateTagDto extends createZodDto(CreateTagSchema) {}
