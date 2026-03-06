/**
 * Maintenance DTOs
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MaintenanceTypeEnum = z.enum([
  'preventive',
  'corrective',
  'inspection',
  'calibration',
  'cleaning',
  'other',
]);

const StatusAfterEnum = z.enum([
  'operational',
  'needs_repair',
  'decommissioned',
]);

export const AddMaintenanceRecordSchema = z.object({
  assetId: z.number().int().positive('Asset ID is required'),
  maintenanceType: MaintenanceTypeEnum,
  performedDate: z.iso.datetime(),
  performedBy: z.number().int().positive().optional(),
  externalCompany: z.string().max(100).optional(),
  description: z.string().optional(),
  partsReplaced: z.string().optional(),
  cost: z.number().min(0).optional(),
  durationHours: z.number().min(0).optional(),
  statusAfter: StatusAfterEnum.optional().default('operational'),
  nextMaintenanceDate: z.iso.datetime().optional(),
  reportUrl: z.url().optional(),
});

export class AddMaintenanceRecordDto extends createZodDto(
  AddMaintenanceRecordSchema,
) {}
