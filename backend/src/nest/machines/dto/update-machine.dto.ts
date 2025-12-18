/**
 * Update Machine DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MachineStatusEnum = z.enum([
  'operational',
  'maintenance',
  'repair',
  'standby',
  'decommissioned',
]);

const MachineTypeEnum = z.enum([
  'production',
  'packaging',
  'quality_control',
  'logistics',
  'utility',
  'other',
]);

export const UpdateMachineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  model: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  assetNumber: z.string().max(50).optional(),
  departmentId: z.number().int().positive().optional(),
  areaId: z.number().int().positive().optional(),
  location: z.string().max(255).optional(),
  machineType: MachineTypeEnum.optional(),
  status: MachineStatusEnum.optional(),
  purchaseDate: z.iso.datetime().optional(),
  installationDate: z.iso.datetime().optional(),
  warrantyUntil: z.iso.datetime().optional(),
  lastMaintenance: z.iso.datetime().optional(),
  nextMaintenance: z.iso.datetime().optional(),
  operatingHours: z.number().int().min(0).optional(),
  productionCapacity: z.string().max(100).optional(),
  energyConsumption: z.string().max(100).optional(),
  manualUrl: z.url().optional(),
  qrCode: z.string().max(255).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export class UpdateMachineDto extends createZodDto(UpdateMachineSchema) {}
