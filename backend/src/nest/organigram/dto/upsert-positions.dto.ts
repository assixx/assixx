import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const OrgEntityTypeSchema = z.enum(['area', 'department', 'team', 'asset'], {
  message: 'entityType muss area, department, team oder asset sein',
});

const PositionItemSchema = z.object({
  entityType: OrgEntityTypeSchema,
  entityUuid: z
    .string()
    .trim()
    .length(36, 'entityUuid muss exakt 36 Zeichen haben'),
  positionX: z.number(),
  positionY: z.number(),
  width: z.number().positive('Breite muss positiv sein').max(2000),
  height: z.number().positive('Höhe muss positiv sein').max(2000),
});

export const UpsertPositionsSchema = z.object({
  positions: z
    .array(PositionItemSchema)
    .min(1, 'Mindestens eine Position erforderlich')
    .max(500, 'Maximal 500 Positionen pro Request'),
});

export class UpsertPositionsDto extends createZodDto(UpsertPositionsSchema) {}
