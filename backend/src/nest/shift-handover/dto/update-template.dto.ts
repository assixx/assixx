/**
 * Shift Handover — Update Template Body DTO.
 *
 * Shape-identical to `CreateTemplateDto` since the endpoint is idempotent
 * upsert; kept as a distinct DTO for OpenAPI clarity and to leave room
 * for future divergence (e.g. partial patches) without breaking callers.
 */
import { createZodDto } from 'nestjs-zod';

import { CreateTemplateSchema } from './create-template.dto.js';

export const UpdateTemplateSchema = CreateTemplateSchema;
export class UpdateTemplateDto extends createZodDto(UpdateTemplateSchema) {}
