/**
 * Upload Photo DTO
 */
import { createZodDto } from 'nestjs-zod';

import { UploadPhotoSchema } from './common.dto.js';

export class UploadPhotoDto extends createZodDto(UploadPhotoSchema) {}
