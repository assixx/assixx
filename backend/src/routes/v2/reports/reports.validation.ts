/**
 * Reports/Analytics v2 Validation
 * Input validation for reports endpoints
 */

import { body, param, query, validationResult } from "express-validator";

import { NextFunction, Request, Response } from "express";

import { ServiceError } from "../../../utils/ServiceError.js";

/**
 * Validation middleware wrapper
 * @param req
 * @param _res
 * @param next
 */
const validate = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ServiceError("VALIDATION_ERROR", "Validation failed");
  }
  next();
};

/**
 * Date range validation for most reports
 */
export const dateRange = [
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateFrom format"),
  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateTo format")
    .custom((dateTo, { req }) => {
      if (req.query?.dateFrom && dateTo < req.query.dateFrom) {
        throw new Error("dateTo must be after dateFrom");
      }
      return true;
    }),
  validate,
];

/**
 * Employee report validation
 */
export const employeeReport = [
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateFrom format"),
  query("dateTo").optional().isISO8601().withMessage("Invalid dateTo format"),
  query("departmentId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Invalid department ID"),
  query("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
  validate,
];

/**
 * Shift report validation
 */
export const shiftReport = [
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateFrom format"),
  query("dateTo").optional().isISO8601().withMessage("Invalid dateTo format"),
  query("departmentId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Invalid department ID"),
  query("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
  validate,
];

/**
 * KVP report validation
 */
export const kvpReport = [
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateFrom format"),
  query("dateTo").optional().isISO8601().withMessage("Invalid dateTo format"),
  query("categoryId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Invalid category ID"),
  validate,
];

/**
 * Attendance report validation (dateFrom and dateTo required)
 */
export const attendanceReport = [
  query("dateFrom")
    .notEmpty()
    .isISO8601()
    .withMessage("dateFrom is required and must be a valid date"),
  query("dateTo")
    .notEmpty()
    .isISO8601()
    .withMessage("dateTo is required and must be a valid date")
    .custom((dateTo, { req }) => {
      if (req.query?.dateFrom && dateTo < req.query.dateFrom) {
        throw new Error("dateTo must be after dateFrom");
      }
      // Max 90 days range
      const daysDiff =
        (new Date(dateTo).getTime() -
          new Date(req.query.dateFrom as string).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        throw new Error("Date range cannot exceed 90 days");
      }
      return true;
    }),
  query("departmentId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Invalid department ID"),
  query("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
  validate,
];

/**
 * Custom report validation
 */
export const customReport = [
  body("name")
    .trim()
    .notEmpty()
    .isLength({ min: 3, max: 100 })
    .withMessage("Name must be between 3 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("metrics")
    .isArray({ min: 1 })
    .withMessage("At least one metric must be selected"),
  body("metrics.*")
    .isIn([
      "employees",
      "departments",
      "shifts",
      "kvp",
      "attendance",
      "compliance",
    ])
    .withMessage("Invalid metric selected"),
  body("dateFrom")
    .notEmpty()
    .isISO8601()
    .withMessage("dateFrom is required and must be a valid date"),
  body("dateTo")
    .notEmpty()
    .isISO8601()
    .withMessage("dateTo is required and must be a valid date")
    .custom((dateTo, { req }) => {
      if (dateTo < req.body.dateFrom) {
        throw new Error("dateTo must be after dateFrom");
      }
      return true;
    }),
  body("filters.departmentIds")
    .optional()
    .isArray()
    .withMessage("departmentIds must be an array"),
  body("filters.departmentIds.*")
    .isInt({ min: 1 })
    .withMessage("Invalid department ID"),
  body("filters.teamIds")
    .optional()
    .isArray()
    .withMessage("teamIds must be an array"),
  body("filters.teamIds.*").isInt({ min: 1 }).withMessage("Invalid team ID"),
  body("groupBy")
    .optional()
    .isIn(["department", "team", "week", "month"])
    .withMessage("Invalid groupBy value"),
  validate,
];

/**
 * Export report validation
 */
export const exportReport = [
  param("type")
    .isIn([
      "overview",
      "employees",
      "departments",
      "shifts",
      "kvp",
      "attendance",
      "compliance",
    ])
    .withMessage("Invalid report type"),
  query("format")
    .notEmpty()
    .isIn(["pdf", "excel", "csv"])
    .withMessage("Format must be pdf, excel, or csv"),
  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid dateFrom format"),
  query("dateTo").optional().isISO8601().withMessage("Invalid dateTo format"),
  query("departmentId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Invalid department ID"),
  query("teamId").optional().isInt({ min: 1 }).withMessage("Invalid team ID"),
  validate,
];

export const reportsValidation = {
  dateRange,
  employeeReport,
  shiftReport,
  kvpReport,
  attendanceReport,
  customReport,
  exportReport,
};
