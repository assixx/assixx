// Import all functions for default export
import * as shiftCore from './shift-core';
import { formatDateForMysql, formatDateOnlyForMysql } from './shift-types';
import * as shiftV2 from './shift-v2';

/**
 * Shift Model
 * Handles database operations for shift planning system
 * This file re-exports from the separated modules for backwards compatibility
 */

// Re-export all types and utilities from shift-types
export {
  ERROR_MESSAGES,
  SQL_FRAGMENTS,
  formatDateForMysql,
  formatDateOnlyForMysql,
  calculateDurationHours,
  type DbShiftTemplate,
  type DbShiftPlan,
  type DbShift,
  type DbShiftAssignment,
  type DbEmployeeAvailability,
  type ShiftQueryResult,
  type ShiftNoteRow,
  type DbShiftExchangeRequest,
  type ShiftPlanFilters,
  type ShiftExchangeFilters,
  type ShiftTemplateData,
  type ShiftPlanData,
  type ShiftData,
  type ShiftAssignmentData,
  type EmployeeAvailabilityData,
  type ShiftExchangeRequestData,
  type CountResult,
  type V2ShiftFilters,
  type V2ShiftData,
  type V2TemplateData,
  type V2SwapRequestData,
  type V2SwapRequestFilters,
  type V2SwapRequestResult,
} from './shift-types';

// Re-export all core functions from shift-core
export {
  getShiftTemplates,
  createShiftTemplate,
  getShiftPlans,
  createShiftPlan,
  getShiftsByPlan,
  createShift,
  assignEmployeeToShift,
  getEmployeeAvailability,
  setEmployeeAvailability,
  getShiftExchangeRequests,
  createShiftExchangeRequest,
  canAccessShiftPlan,
  getEmployeeShifts,
  getShiftsForDateRange,
  getWeekNotes,
} from './shift-core';

// Re-export all v2 functions from shift-v2
export {
  findAll,
  findById,
  create,
  update,
  deleteShift,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getSwapRequests,
  createSwapRequest,
  getSwapRequestById,
  updateSwapRequestStatus,
  getOvertimeByUser,
} from './shift-v2';

// Default export with all functions (maintains backwards compatibility)
export default {
  // Core functions
  getShiftTemplates: shiftCore.getShiftTemplates,
  createShiftTemplate: shiftCore.createShiftTemplate,
  getShiftPlans: shiftCore.getShiftPlans,
  createShiftPlan: shiftCore.createShiftPlan,
  getShiftsByPlan: shiftCore.getShiftsByPlan,
  createShift: shiftCore.createShift,
  assignEmployeeToShift: shiftCore.assignEmployeeToShift,
  getEmployeeAvailability: shiftCore.getEmployeeAvailability,
  setEmployeeAvailability: shiftCore.setEmployeeAvailability,
  getShiftExchangeRequests: shiftCore.getShiftExchangeRequests,
  createShiftExchangeRequest: shiftCore.createShiftExchangeRequest,
  canAccessShiftPlan: shiftCore.canAccessShiftPlan,
  getEmployeeShifts: shiftCore.getEmployeeShifts,
  getShiftsForDateRange: shiftCore.getShiftsForDateRange,
  getWeekNotes: shiftCore.getWeekNotes,
  formatDateForMysql,
  formatDateOnlyForMysql,
  // V2 API methods
  findAll: shiftV2.findAll,
  findById: shiftV2.findById,
  create: shiftV2.create,
  update: shiftV2.update,
  delete: shiftV2.deleteShift,
  getTemplates: shiftV2.getTemplates,
  getTemplateById: shiftV2.getTemplateById,
  createTemplate: shiftV2.createTemplate,
  updateTemplate: shiftV2.updateTemplate,
  deleteTemplate: shiftV2.deleteTemplate,
  getSwapRequests: shiftV2.getSwapRequests,
  createSwapRequest: shiftV2.createSwapRequest,
  getSwapRequestById: shiftV2.getSwapRequestById,
  updateSwapRequestStatus: shiftV2.updateSwapRequestStatus,
  getOvertimeByUser: shiftV2.getOvertimeByUser,
};
