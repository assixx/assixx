/**
 * Inventory Path Parameter DTO — Photo ID
 */
import { createZodDto } from 'nestjs-zod';

import { PhotoIdParamSchema } from './common.dto.js';

export class PhotoIdParamDto extends createZodDto(PhotoIdParamSchema) {}
