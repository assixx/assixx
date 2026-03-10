import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LabelSchema = z
  .string()
  .trim()
  .min(1, 'Label darf nicht leer sein')
  .max(50, 'Label darf maximal 50 Zeichen haben');

export const UpdateHierarchyLabelsSchema = z.object({
  levels: z.object({
    area: LabelSchema.optional(),
    department: LabelSchema.optional(),
    team: LabelSchema.optional(),
    asset: LabelSchema.optional(),
  }),
});

export class UpdateHierarchyLabelsDto extends createZodDto(
  UpdateHierarchyLabelsSchema,
) {}
