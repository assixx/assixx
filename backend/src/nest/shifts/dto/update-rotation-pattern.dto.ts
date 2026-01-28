/**
 * Update Rotation Pattern DTO
 */
import { createZodDto } from 'nestjs-zod';

import { CreateRotationPatternSchema } from './create-rotation-pattern.dto.js';

/**
 * Update rotation pattern request body (all fields optional)
 */
export const UpdateRotationPatternSchema =
  CreateRotationPatternSchema.partial();

export class UpdateRotationPatternDto extends createZodDto(
  UpdateRotationPatternSchema,
) {}
