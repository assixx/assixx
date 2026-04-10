/**
 * Reorder Photos DTO
 */
import { createZodDto } from 'nestjs-zod';

import { ReorderPhotosSchema } from './common.dto.js';

export class ReorderPhotosDto extends createZodDto(ReorderPhotosSchema) {}
