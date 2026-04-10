/**
 * Update Photo Caption DTO
 */
import { createZodDto } from 'nestjs-zod';

import { UpdatePhotoCaptionSchema } from './common.dto.js';

export class UpdatePhotoCaptionDto extends createZodDto(UpdatePhotoCaptionSchema) {}
