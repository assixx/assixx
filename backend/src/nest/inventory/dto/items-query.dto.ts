/**
 * Inventory Items List Query DTO
 */
import { createZodDto } from 'nestjs-zod';

import { ItemsQuerySchema } from './common.dto.js';

export class ItemsQueryDto extends createZodDto(ItemsQuerySchema) {}
