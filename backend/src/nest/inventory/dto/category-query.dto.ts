/**
 * Inventory Category Autocomplete Query DTO
 */
import { createZodDto } from 'nestjs-zod';

import { CategoryQuerySchema } from './common.dto.js';

export class CategoryQueryDto extends createZodDto(CategoryQuerySchema) {}
