/**
 * Update Inventory List DTO
 *
 * All fields optional — partial update.
 * Prefix change does NOT affect existing item codes.
 */
import { createZodDto } from 'nestjs-zod';

import { CreateListSchema } from './create-list.dto.js';

export const UpdateListSchema = CreateListSchema.partial();

export class UpdateListDto extends createZodDto(UpdateListSchema) {}
