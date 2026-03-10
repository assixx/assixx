import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const HierarchyLabelSchema = z.object({
  singular: z
    .string()
    .trim()
    .min(1, 'Label darf nicht leer sein')
    .max(50, 'Label darf maximal 50 Zeichen haben'),
  plural: z
    .string()
    .trim()
    .min(1, 'Label darf nicht leer sein')
    .max(50, 'Label darf maximal 50 Zeichen haben'),
});

export const UpdateHierarchyLabelsSchema = z.object({
  levels: z.object({
    area: HierarchyLabelSchema.optional(),
    department: HierarchyLabelSchema.optional(),
    team: HierarchyLabelSchema.optional(),
    asset: HierarchyLabelSchema.optional(),
  }),
});

export class UpdateHierarchyLabelsDto extends createZodDto(
  UpdateHierarchyLabelsSchema,
) {}
