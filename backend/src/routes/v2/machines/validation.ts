/**
 * Machines API v2 Validation Rules
 * Uses express-validator for request validation
 */

import { body, query, param } from "express-validator";

// Machine type enum values
const MACHINE_TYPES = [
  "production",
  "packaging",
  "quality_control",
  "logistics",
  "utility",
  "other",
];
const MACHINE_STATUS = [
  "operational",
  "maintenance",
  "repair",
  "standby",
  "decommissioned",
];
const MAINTENANCE_TYPES = [
  "preventive",
  "corrective",
  "inspection",
  "calibration",
  "cleaning",
  "other",
];
const STATUS_AFTER = ["operational", "needs_repair", "decommissioned"];

export const machineValidation = {
  // List machines query validation
  listMachines: [
    query("status")
      .optional()
      .isIn(MACHINE_STATUS)
      .withMessage("Invalid status"),
    query("machineType")
      .optional()
      .isIn(MACHINE_TYPES)
      .withMessage("Invalid machine type"),
    query("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Department ID must be a positive integer"),
    query("search")
      .optional()
      .isString()
      .trim()
      .withMessage("Search must be a string"),
    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    query("needsMaintenance")
      .optional()
      .isBoolean()
      .withMessage("needsMaintenance must be a boolean"),
  ],

  // Machine ID parameter validation
  machineId: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Machine ID must be a positive integer"),
  ],

  // Create machine validation
  createMachine: [
    body("name")
      .notEmpty()
      .withMessage("Name is required")
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters"),
    body("model")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Model must be at most 100 characters"),
    body("manufacturer")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Manufacturer must be at most 100 characters"),
    body("serialNumber")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Serial number must be at most 100 characters"),
    body("assetNumber")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Asset number must be at most 50 characters"),
    body("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Department ID must be a positive integer"),
    body("areaId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Area ID must be a positive integer"),
    body("location")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Location must be at most 255 characters"),
    body("machineType")
      .optional()
      .isIn(MACHINE_TYPES)
      .withMessage("Invalid machine type"),
    body("status")
      .optional()
      .isIn(MACHINE_STATUS)
      .withMessage("Invalid status"),
    body("purchaseDate")
      .optional()
      .isISO8601()
      .withMessage("Purchase date must be a valid ISO8601 date"),
    body("installationDate")
      .optional()
      .isISO8601()
      .withMessage("Installation date must be a valid ISO8601 date"),
    body("warrantyUntil")
      .optional()
      .isISO8601()
      .withMessage("Warranty until must be a valid ISO8601 date"),
    body("lastMaintenance")
      .optional()
      .isISO8601()
      .withMessage("Last maintenance must be a valid ISO8601 date"),
    body("nextMaintenance")
      .optional()
      .isISO8601()
      .withMessage("Next maintenance must be a valid ISO8601 date"),
    body("operatingHours")
      .optional()
      .isNumeric()
      .withMessage("Operating hours must be a number")
      .custom((value) => value >= 0)
      .withMessage("Operating hours must be non-negative"),
    body("productionCapacity")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Production capacity must be at most 100 characters"),
    body("energyConsumption")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Energy consumption must be at most 100 characters"),
    body("manualUrl")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Manual URL must be at most 500 characters"),
    body("qrCode")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("QR code must be at most 100 characters"),
    body("notes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 5000 })
      .withMessage("Notes must be at most 5000 characters"),
  ],

  // Update machine validation (all fields optional)
  updateMachine: [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Machine ID must be a positive integer"),
    body("name")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters"),
    body("model")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Model must be at most 100 characters"),
    body("manufacturer")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Manufacturer must be at most 100 characters"),
    body("serialNumber")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Serial number must be at most 100 characters"),
    body("assetNumber")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Asset number must be at most 50 characters"),
    body("departmentId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Department ID must be a positive integer"),
    body("areaId")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Area ID must be a positive integer"),
    body("location")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 255 })
      .withMessage("Location must be at most 255 characters"),
    body("machineType")
      .optional()
      .isIn(MACHINE_TYPES)
      .withMessage("Invalid machine type"),
    body("status")
      .optional()
      .isIn(MACHINE_STATUS)
      .withMessage("Invalid status"),
    body("purchaseDate")
      .optional()
      .isISO8601()
      .withMessage("Purchase date must be a valid ISO8601 date"),
    body("installationDate")
      .optional()
      .isISO8601()
      .withMessage("Installation date must be a valid ISO8601 date"),
    body("warrantyUntil")
      .optional()
      .isISO8601()
      .withMessage("Warranty until must be a valid ISO8601 date"),
    body("lastMaintenance")
      .optional()
      .isISO8601()
      .withMessage("Last maintenance must be a valid ISO8601 date"),
    body("nextMaintenance")
      .optional()
      .isISO8601()
      .withMessage("Next maintenance must be a valid ISO8601 date"),
    body("operatingHours")
      .optional()
      .isNumeric()
      .withMessage("Operating hours must be a number")
      .custom((value) => value >= 0)
      .withMessage("Operating hours must be non-negative"),
    body("productionCapacity")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Production capacity must be at most 100 characters"),
    body("energyConsumption")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Energy consumption must be at most 100 characters"),
    body("manualUrl")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Manual URL must be at most 500 characters"),
    body("qrCode")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("QR code must be at most 100 characters"),
    body("notes")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 5000 })
      .withMessage("Notes must be at most 5000 characters"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],

  // Add maintenance record validation
  addMaintenanceRecord: [
    body("machineId")
      .notEmpty()
      .withMessage("Machine ID is required")
      .isInt({ min: 1 })
      .withMessage("Machine ID must be a positive integer"),
    body("maintenanceType")
      .notEmpty()
      .withMessage("Maintenance type is required")
      .isIn(MAINTENANCE_TYPES)
      .withMessage("Invalid maintenance type"),
    body("performedDate")
      .notEmpty()
      .withMessage("Performed date is required")
      .isISO8601()
      .withMessage("Performed date must be a valid ISO8601 date"),
    body("performedBy")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Performed by must be a positive integer"),
    body("externalCompany")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("External company must be at most 100 characters"),
    body("description")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 5000 })
      .withMessage("Description must be at most 5000 characters"),
    body("partsReplaced")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 5000 })
      .withMessage("Parts replaced must be at most 5000 characters"),
    body("cost")
      .optional()
      .isNumeric()
      .withMessage("Cost must be a number")
      .custom((value) => value >= 0)
      .withMessage("Cost must be non-negative"),
    body("durationHours")
      .optional()
      .isNumeric()
      .withMessage("Duration hours must be a number")
      .custom((value) => value >= 0 && value <= 999.99)
      .withMessage("Duration hours must be between 0 and 999.99"),
    body("statusAfter")
      .optional()
      .isIn(STATUS_AFTER)
      .withMessage("Invalid status after"),
    body("nextMaintenanceDate")
      .optional()
      .isISO8601()
      .withMessage("Next maintenance date must be a valid ISO8601 date"),
    body("reportUrl")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Report URL must be at most 500 characters"),
  ],

  // Upcoming maintenance query validation
  upcomingMaintenance: [
    query("days")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Days must be between 1 and 365"),
  ],
};
