/**
 * Update Inventory Tag DTO
 *
 * Partial update — name and/or icon. Renaming a tag is global: every
 * list that references it picks up the new name on next read.
 */
import { createZodDto } from 'nestjs-zod';

import { CreateTagSchema } from './create-tag.dto.js';

export const UpdateTagSchema = CreateTagSchema.partial();

export class UpdateTagDto extends createZodDto(UpdateTagSchema) {}
