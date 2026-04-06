/**
 * Inventory Path Parameter DTO — List UUID
 */
import { createZodDto } from 'nestjs-zod';

import { UuidParamSchema } from './common.dto.js';

export class UuidParamDto extends createZodDto(UuidParamSchema) {}
