/**
 * Reports Service v2 - Main Entry Point
 * Re-exports all reporting functionality from specialized sub-services
 * Business logic for generating reports and analytics
 *
 * Architecture:
 * - reports.types.ts - All type definitions
 * - reports-metrics.service.ts - Shared metric calculations
 * - reports-overview.service.ts - Company overview report
 * - reports-shift.service.ts - Shift analytics
 * - reports-kvp.service.ts - KVP ROI analytics
 * - reports-employee.service.ts - Employee & department analytics
 * - reports-other.service.ts - Attendance, compliance, custom reports
 * - reports-export.service.ts - Export functionality (PDF, Excel, CSV)
 *
 * Best Practice 2025: Feature-based service separation for maintainability
 * No circular dependencies - each service imports only from lower layers
 */

// RE-EXPORT ALL TYPES
export type * from './reports.types.js';

// RE-EXPORT METRIC HELPERS
export {
  getDefaultDateFrom,
  getDefaultDateTo,
  getEmployeeMetrics,
  getDepartmentMetrics,
  getShiftMetrics,
  getKvpMetrics,
  getSurveyMetrics,
  getAttendanceMetrics,
  getPerformanceMetrics,
} from './reports-metrics.service.js';

// RE-EXPORT OVERVIEW REPORT
export { getOverviewReport } from './reports-overview.service.js';

// RE-EXPORT SHIFT REPORTS
export { getShiftReport } from './reports-shift.service.js';

// RE-EXPORT KVP REPORTS
export { getKvpReport } from './reports-kvp.service.js';

// RE-EXPORT EMPLOYEE & DEPARTMENT REPORTS
export { getEmployeeReport, getDepartmentReport } from './reports-employee.service.js';

// RE-EXPORT OTHER REPORTS
export {
  getAttendanceReport,
  getComplianceReport,
  generateCustomReport,
} from './reports-other.service.js';

// RE-EXPORT EXPORT FUNCTIONALITY
export { exportReport } from './reports-export.service.js';
