/**
 * Inventory Path Parameter DTO — Item UUID
 */
import { createZodDto } from 'nestjs-zod';

import { ItemUuidParamSchema } from './common.dto.js';

export class ItemUuidParamDto extends createZodDto(ItemUuidParamSchema) {}
