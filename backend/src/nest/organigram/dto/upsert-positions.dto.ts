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

const ViewportSchema = z
  .object({
    zoom: z.number().min(0.1).max(5),
    panX: z.number(),
    panY: z.number(),
    fontSize: z.number().int().min(8).max(120).optional(),
    nodeWidth: z.number().int().min(100).max(1000).optional(),
    nodeHeight: z.number().int().min(40).max(400).optional(),
  })
  .optional();

const HallOverrideSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
});

export const UpsertPositionsSchema = z.object({
  positions: z
    .array(PositionItemSchema)
    .min(1, 'Mindestens eine Position erforderlich')
    .max(500, 'Maximal 500 Positionen pro Request'),
  viewport: ViewportSchema,
  hallOverrides: z.record(z.string(), HallOverrideSchema).optional(),
  canvasBg: z
    .string()
    .regex(
      /^#[\da-f]{6,8}$/i,
      'canvasBg muss ein Hex-Farbwert sein (#rrggbb oder #rrggbbaa)',
    )
    .nullable()
    .optional(),
});

export class UpsertPositionsDto extends createZodDto(UpsertPositionsSchema) {}
