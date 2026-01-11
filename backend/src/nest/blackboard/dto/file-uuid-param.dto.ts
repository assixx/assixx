/**
 * File UUID Param DTO
 *
 * Validates fileUuid path parameter for secure download URLs.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const FileUuidParamSchema = z.object({
  fileUuid: z.uuid(),
});

export class FileUuidParamDto extends createZodDto(FileUuidParamSchema) {}
