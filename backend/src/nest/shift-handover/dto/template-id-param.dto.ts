/**
 * Shift Handover — Template Route Param DTO.
 *
 * Template endpoints address the row by `teamId` (one template per team,
 * UNIQUE constraint in Phase 1.1). `createIdParamSchema` is the canonical
 * factory per TS-Standards §7.5 — never inline `z.coerce.number()` in a
 * param DTO.
 */
import { createZodDto } from 'nestjs-zod';

import { createIdParamSchema } from '../../common/dto/index.js';

export const TemplateTeamIdParamSchema = createIdParamSchema('teamId');
export class TemplateTeamIdParamDto extends createZodDto(TemplateTeamIdParamSchema) {}
