// Import all functions for default export
import * as shiftCore from './shift-core.model.js';
import { formatDateForMysql, formatDateOnlyForMysql } from './shift-types.js';
import * as shiftModel from './shift.model.js';

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
  type DbShiftPlan,
  type DbShift,
  type DbShiftAssignment,
  type DbEmployeeAvailability,
  type ShiftQueryResult,
  type ShiftNoteRow,
  type DbShiftExchangeRequest,
  type ShiftPlanFilters,
  type ShiftExchangeFilters,
  type ShiftPlanData,
  type ShiftData,
  type ShiftAssignmentData,
  type EmployeeAvailabilityData,
  type ShiftExchangeRequestData,
  type CountResult,
  type V2ShiftFilters,
  type V2ShiftData,
  type V2SwapRequestData,
  type V2SwapRequestFilters,
  type V2SwapRequestResult,
} from './shift-types.js';

// Re-export all core functions from shift-core
export {
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
} from './shift-core.model.js';

// Re-export all v2 functions from shift-v2
export {
  findAll,
  findById,
  create,
  update,
  deleteShift,
  getSwapRequests,
  createSwapRequest,
  getSwapRequestById,
  updateSwapRequestStatus,
  getOvertimeByUser,
} from './shift.model.js';

// Default export with all functions (maintains backwards compatibility)
export default {
  // Core functions
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
  findAll: shiftModel.findAll,
  findById: shiftModel.findById,
  create: shiftModel.create,
  update: shiftModel.update,
  delete: shiftModel.deleteShift,
  getSwapRequests: shiftModel.getSwapRequests,
  createSwapRequest: shiftModel.createSwapRequest,
  getSwapRequestById: shiftModel.getSwapRequestById,
  updateSwapRequestStatus: shiftModel.updateSwapRequestStatus,
  getOvertimeByUser: shiftModel.getOvertimeByUser,
};
