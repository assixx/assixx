/**
 * Report Type Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ReportTypeSchema } from './report.schemas.js';

export const ReportTypeParamSchema = z.object({
  type: ReportTypeSchema,
});

export class ReportTypeParamDto extends createZodDto(ReportTypeParamSchema) {}
