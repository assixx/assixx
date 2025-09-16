/**
 * Reports/Analytics API v2 Routes
 * Route definitions for reporting and analytics

 * tags:
 *   - name: Reports v2
 *     description: Reporting and analytics API v2 - aggregated data and insights
 */
import { Router } from 'express';

import { authenticateV2 } from '../../../middleware/v2/auth.middleware.js';
import { typed } from '../../../utils/routeHandlers.js';
import * as reportsController from './reports.controller.js';
import { reportsValidation } from './reports.validation.js';

const router = Router();

// All routes require authentication

/**

 * /api/v2/reports/overview:
 *   get:
 *     summary: Get company overview report
 *     description: Get high-level KPIs and metrics for the entire company
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the report (defaults to 30 days ago)
 *       - name: dateTo
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the report (defaults to today)
 *     responses:
 *       200:
 *         description: Overview report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         employees:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             active:
 *                               type: integer
 *                             newThisMonth:
 *                               type: integer
 *                         departments:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             avgEmployeesPerDept:
 *                               type: number
 *                         shifts:
 *                           type: object
 *                           properties:
 *                             totalScheduled:
 *                               type: integer
 *                             overtimeHours:
 *                               type: number
 *                             coverageRate:
 *                               type: number
 *                         kvp:
 *                           type: object
 *                           properties:
 *                             totalSuggestions:
 *                               type: integer
 *                             implemented:
 *                               type: integer
 *                             totalSavings:
 *                               type: number
 *                             avgROI:
 *                               type: number
 *                         surveys:
 *                           type: object
 *                           properties:
 *                             active:
 *                               type: integer
 *                             avgResponseRate:
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/overview',
  authenticateV2,
  reportsValidation.dateRange,
  typed.auth(reportsController.getOverviewReport),
);

/**

 * /api/v2/reports/employees:
 *   get:
 *     summary: Get employee analytics report
 *     description: Get detailed employee metrics and trends
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateTo
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: departmentId
 *         in: query
 *         schema:
 *           type: integer
 *         description: Filter by department
 *       - name: teamId
 *         in: query
 *         schema:
 *           type: integer
 *         description: Filter by team
 *     responses:
 *       200:
 *         description: Employee report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         headcount:
 *                           type: object
 *                           properties:
 *                             trend:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   date:
 *                                     type: string
 *                                   count:
 *                                     type: integer
 *                         attendance:
 *                           type: object
 *                           properties:
 *                             avgRate:
 *                               type: number
 *                             absences:
 *                               type: integer
 *                         performance:
 *                           type: object
 *                           properties:
 *                             kvpParticipation:
 *                               type: number
 *                             avgShiftCompletion:
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/employees',
  authenticateV2,
  reportsValidation.employeeReport,
  typed.auth(reportsController.getEmployeeReport),
);

/**

 * /api/v2/reports/departments:
 *   get:
 *     summary: Get department analytics report
 *     description: Get performance metrics by department
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateTo
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Department report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           departmentId:
 *                             type: integer
 *                           departmentName:
 *                             type: string
 *                           metrics:
 *                             type: object
 *                             properties:
 *                               employees:
 *                                 type: integer
 *                               teams:
 *                                 type: integer
 *                               kvpSuggestions:
 *                                 type: integer
 *                               shiftCoverage:
 *                                 type: number
 *                               avgOvertime:
 *                                 type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/departments',
  authenticateV2,
  reportsValidation.dateRange,
  typed.auth(reportsController.getDepartmentReport),
);

/**

 * /api/v2/reports/shifts:
 *   get:
 *     summary: Get shift analytics report
 *     description: Get detailed shift coverage and overtime analytics
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateTo
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: departmentId
 *         in: query
 *         schema:
 *           type: integer
 *       - name: teamId
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Shift report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalShifts:
 *                           type: integer
 *                         coverage:
 *                           type: object
 *                           properties:
 *                             scheduled:
 *                               type: integer
 *                             filled:
 *                               type: integer
 *                             rate:
 *                               type: number
 *                         overtime:
 *                           type: object
 *                           properties:
 *                             totalHours:
 *                               type: number
 *                             totalCost:
 *                               type: number
 *                             byDepartment:
 *                               type: array
 *                               items:
 *                                 type: object
 *                         patterns:
 *                           type: object
 *                           properties:
 *                             peakHours:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             understaffedShifts:
 *                               type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/shifts',
  authenticateV2,
  reportsValidation.shiftReport,
  typed.auth(reportsController.getShiftReport),
);

/**

 * /api/v2/reports/kvp:
 *   get:
 *     summary: Get KVP ROI report
 *     description: Get return on investment analysis for KVP suggestions
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateTo
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: categoryId
 *         in: query
 *         schema:
 *           type: integer
 *         description: Filter by KVP category
 *     responses:
 *       200:
 *         description: KVP report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: object
 *                           properties:
 *                             totalSuggestions:
 *                               type: integer
 *                             implemented:
 *                               type: integer
 *                             totalCost:
 *                               type: number
 *                             totalSavings:
 *                               type: number
 *                             roi:
 *                               type: number
 *                         byCategory:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               categoryId:
 *                                 type: integer
 *                               categoryName:
 *                                 type: string
 *                               suggestions:
 *                                 type: integer
 *                               implemented:
 *                                 type: integer
 *                               avgSavings:
 *                                 type: number
 *                         topPerformers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               suggestions:
 *                                 type: integer
 *                               totalSavings:
 *                                 type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/kvp',
  authenticateV2,
  reportsValidation.kvpReport,
  typed.auth(reportsController.getKvpReport),
);

/**

 * /api/v2/reports/attendance:
 *   get:
 *     summary: Get attendance report
 *     description: Get detailed attendance and absence analytics
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateTo
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: departmentId
 *         in: query
 *         schema:
 *           type: integer
 *       - name: teamId
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Attendance report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         summary:
 *                           type: object
 *                           properties:
 *                             avgAttendanceRate:
 *                               type: number
 *                             totalAbsences:
 *                               type: integer
 *                             totalLateArrivals:
 *                               type: integer
 *                         byEmployee:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               attendanceRate:
 *                                 type: number
 *                               absences:
 *                                 type: integer
 *                               lateArrivals:
 *                                 type: integer
 *                         trends:
 *                           type: object
 *                           properties:
 *                             daily:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   date:
 *                                     type: string
 *                                   rate:
 *                                     type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/attendance',
  authenticateV2,
  reportsValidation.attendanceReport,
  typed.auth(reportsController.getAttendanceReport),
);

/**

 * /api/v2/reports/compliance:
 *   get:
 *     summary: Get compliance report
 *     description: Get labor law compliance metrics (working hours, breaks, etc.)
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateTo
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: departmentId
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Compliance report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         violations:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             byType:
 *                               type: object
 *                               properties:
 *                                 maxWorkingHours:
 *                                   type: integer
 *                                 missingBreaks:
 *                                   type: integer
 *                                 insufficientRest:
 *                                   type: integer
 *                         riskEmployees:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               violations:
 *                                 type: integer
 *                               issues:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/compliance',
  authenticateV2,
  reportsValidation.attendanceReport, // Same validation as attendance
  typed.auth(reportsController.getComplianceReport),
);

/**

 * /api/v2/reports/custom:
 *   post:
 *     summary: Generate custom report
 *     description: Build a custom report with selected metrics and filters
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - metrics
 *               - dateFrom
 *               - dateTo
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               metrics:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum: [employees, departments, shifts, kvp, attendance, compliance]
 *               dateFrom:
 *                 type: string
 *                 format: date
 *               dateTo:
 *                 type: string
 *                 format: date
 *               filters:
 *                 type: object
 *                 properties:
 *                   departmentIds:
 *                     type: array
 *                     items:
 *                       type: integer
 *                   teamIds:
 *                     type: array
 *                     items:
 *                       type: integer
 *               groupBy:
 *                 type: string
 *                 enum: [department, team, week, month]
 *     responses:
 *       201:
 *         description: Custom report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         reportId:
 *                           type: string
 *                         name:
 *                           type: string
 *                         generatedAt:
 *                           type: string
 *                           format: date-time
 *                         data:
 *                           type: object
 *                           description: Dynamic report data based on selected metrics
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/custom',
  authenticateV2,
  reportsValidation.customReport,
  typed.auth(reportsController.generateCustomReport),
);

/**
 * /api/v2/reports/export/\{type\}:
 *   get:
 *     summary: Export report
 *     description: Export any report as PDF, Excel or CSV
 *     tags: [Reports v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [overview, employees, departments, shifts, kvp, attendance, compliance]
 *       - name: format
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pdf, excel, csv]
 *       - name: dateFrom
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateTo
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: departmentId
 *         in: query
 *         schema:
 *           type: integer
 *       - name: teamId
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Report exported successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/export/:type',
  authenticateV2,
  reportsValidation.exportReport,
  typed.auth(reportsController.exportReport),
);

export default router;
