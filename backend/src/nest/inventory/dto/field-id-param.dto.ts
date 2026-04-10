/**
 * Inventory Path Parameter DTO — Field ID
 */
import { createZodDto } from 'nestjs-zod';

import { FieldIdParamSchema } from './common.dto.js';

export class FieldIdParamDto extends createZodDto(FieldIdParamSchema) {}
