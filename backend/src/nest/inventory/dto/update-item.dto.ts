/**
 * Update Inventory Item DTO
 *
 * All fields optional — partial update.
 * Code is NEVER updatable (auto-generated, immutable).
 * listId is NEVER updatable (item belongs to one list).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CustomValueInputSchema, InventoryItemStatusSchema } from './common.dto.js';

export const UpdateItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen lang sein')
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Beschreibung darf maximal 5000 Zeichen lang sein')
    .nullish(),
  status: InventoryItemStatusSchema.optional(),
  location: z.string().trim().max(255, 'Standort darf maximal 255 Zeichen lang sein').nullish(),
  manufacturer: z
    .string()
    .trim()
    .max(255, 'Hersteller darf maximal 255 Zeichen lang sein')
    .nullish(),
  model: z.string().trim().max(255, 'Modell darf maximal 255 Zeichen lang sein').nullish(),
  serialNumber: z
    .string()
    .trim()
    .max(255, 'Seriennummer darf maximal 255 Zeichen lang sein')
    .nullish(),
  yearOfManufacture: z
    .number()
    .int()
    .min(1900, 'Baujahr muss nach 1900 liegen')
    .max(2100, 'Baujahr darf maximal 2100 sein')
    .nullish(),
  notes: z.string().trim().max(5000, 'Notizen dürfen maximal 5000 Zeichen lang sein').nullish(),
  customValues: z.array(CustomValueInputSchema).max(30).optional(),
});

export class UpdateItemDto extends createZodDto(UpdateItemSchema) {}
