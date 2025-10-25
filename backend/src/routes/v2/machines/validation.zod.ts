/**
 * Machines API v2 Validation with Zod
 * Replaces express-validator with Zod for machine management endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod';
import { DateSchema, IdSchema } from '../../../schemas/common.schema';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Machine type enum
 */
const MachineTypeSchema = z.enum(
  ['production', 'packaging', 'quality_control', 'logistics', 'utility', 'other'],
  {
    message: 'Invalid machine type',
  },
);

/**
 * Machine status enum
 */
const MachineStatusSchema = z.enum(
  ['operational', 'maintenance', 'repair', 'standby', 'decommissioned'],
  {
    message: 'Invalid status',
  },
);

/**
 * Maintenance type enum
 */
const MaintenanceTypeSchema = z.enum(
  ['preventive', 'corrective', 'inspection', 'calibration', 'cleaning', 'other'],
  {
    message: 'Invalid maintenance type',
  },
);

/**
 * Status after maintenance enum
 */
const StatusAfterSchema = z.enum(['operational', 'needs_repair', 'decommissioned'], {
  message: 'Invalid status after',
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List machines query parameters
 */
const ListMachinesQuerySchema = z.object({
  status: MachineStatusSchema.optional(),
  machineType: MachineTypeSchema.optional(),
  departmentId: IdSchema.optional(),
  search: z.string().trim().optional(),
  isActive: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
  needsMaintenance: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
});

/**
 * Upcoming maintenance query parameters
 */
const UpcomingMaintenanceQuerySchema = z.object({
  days: z.preprocess(
    (val: unknown) =>
      typeof val === 'string' || typeof val === 'number' ?
        Number.parseInt(val.toString(), 10)
      : val,
    z.number().int().min(1).max(365).optional(),
  ),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Machine ID parameter validation
 */
const MachineIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create machine request body
 */
const CreateMachineBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  model: z.string().trim().max(100, 'Model must not exceed 100 characters').optional(),
  manufacturer: z
    .string()
    .trim()
    .max(100, 'Manufacturer must not exceed 100 characters')
    .optional(),
  serialNumber: z
    .string()
    .trim()
    .max(100, 'Serial number must not exceed 100 characters')
    .optional(),
  assetNumber: z.string().trim().max(50, 'Asset number must not exceed 50 characters').optional(),
  departmentId: IdSchema.optional(),
  areaId: IdSchema.optional(),
  location: z.string().trim().max(255, 'Location must not exceed 255 characters').optional(),
  machineType: MachineTypeSchema.optional(),
  status: MachineStatusSchema.optional(),
  purchaseDate: DateSchema.optional(),
  installationDate: DateSchema.optional(),
  warrantyUntil: DateSchema.optional(),
  lastMaintenance: DateSchema.optional(),
  nextMaintenance: DateSchema.optional(),
  operatingHours: z.number().nonnegative('Operating hours must be non-negative').optional(),
  productionCapacity: z
    .string()
    .trim()
    .max(100, 'Production capacity must not exceed 100 characters')
    .optional(),
  energyConsumption: z
    .string()
    .trim()
    .max(100, 'Energy consumption must not exceed 100 characters')
    .optional(),
  manualUrl: z.string().trim().max(500, 'Manual URL must not exceed 500 characters').optional(),
  qrCode: z.string().trim().max(100, 'QR code must not exceed 100 characters').optional(),
  notes: z.string().trim().max(5000, 'Notes must not exceed 5000 characters').optional(),
});

/**
 * Update machine request body (all fields optional)
 */
const UpdateMachineBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  model: z.string().trim().max(100, 'Model must not exceed 100 characters').optional(),
  manufacturer: z
    .string()
    .trim()
    .max(100, 'Manufacturer must not exceed 100 characters')
    .optional(),
  serialNumber: z
    .string()
    .trim()
    .max(100, 'Serial number must not exceed 100 characters')
    .optional(),
  assetNumber: z.string().trim().max(50, 'Asset number must not exceed 50 characters').optional(),
  departmentId: IdSchema.optional(),
  areaId: IdSchema.optional(),
  location: z.string().trim().max(255, 'Location must not exceed 255 characters').optional(),
  machineType: MachineTypeSchema.optional(),
  status: MachineStatusSchema.optional(),
  purchaseDate: DateSchema.optional(),
  installationDate: DateSchema.optional(),
  warrantyUntil: DateSchema.optional(),
  lastMaintenance: DateSchema.optional(),
  nextMaintenance: DateSchema.optional(),
  operatingHours: z.number().nonnegative('Operating hours must be non-negative').optional(),
  productionCapacity: z
    .string()
    .trim()
    .max(100, 'Production capacity must not exceed 100 characters')
    .optional(),
  energyConsumption: z
    .string()
    .trim()
    .max(100, 'Energy consumption must not exceed 100 characters')
    .optional(),
  manualUrl: z.string().trim().max(500, 'Manual URL must not exceed 500 characters').optional(),
  qrCode: z.string().trim().max(100, 'QR code must not exceed 100 characters').optional(),
  notes: z.string().trim().max(5000, 'Notes must not exceed 5000 characters').optional(),
  isActive: z.boolean().optional(),
});

/**
 * Add maintenance record request body
 */
const AddMaintenanceRecordBodySchema = z.object({
  machineId: z.number().int().positive('Machine ID is required'),
  maintenanceType: MaintenanceTypeSchema,
  performedDate: DateSchema,
  performedBy: IdSchema.optional(),
  externalCompany: z
    .string()
    .trim()
    .max(100, 'External company must not exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Description must not exceed 5000 characters')
    .optional(),
  partsReplaced: z
    .string()
    .trim()
    .max(5000, 'Parts replaced must not exceed 5000 characters')
    .optional(),
  cost: z.number().nonnegative('Cost must be non-negative').optional(),
  durationHours: z
    .number()
    .nonnegative('Duration hours must be non-negative')
    .max(999.99, 'Duration hours must not exceed 999.99')
    .optional(),
  statusAfter: StatusAfterSchema.optional(),
  nextMaintenanceDate: DateSchema.optional(),
  reportUrl: z.string().trim().max(500, 'Report URL must not exceed 500 characters').optional(),
});

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for machine routes
 */
export const machinesValidationZod = {
  listMachines: validateQuery(ListMachinesQuerySchema),
  getMachine: validateParams(MachineIdParamSchema),
  createMachine: validateBody(CreateMachineBodySchema),
  updateMachine: [validateParams(MachineIdParamSchema), validateBody(UpdateMachineBodySchema)],
  deleteMachine: validateParams(MachineIdParamSchema),
  addMaintenanceRecord: validateBody(AddMaintenanceRecordBodySchema),
  upcomingMaintenance: validateQuery(UpcomingMaintenanceQuerySchema),
};
