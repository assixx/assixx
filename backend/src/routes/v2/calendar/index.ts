/**
 * Calendar v2 Routes
 * RESTful API endpoints for calendar management
 */

import { Router } from "express";
import { body, param, query } from "express-validator";

import { apiLimiter } from "../../../middleware/security-enhanced.js";
import { authenticateV2 } from "../../../middleware/v2/auth.middleware.js";
import { createValidation } from "../../../middleware/validation.js";
import { typed } from "../../../utils/routeHandlers.js";

import * as calendarController from "./calendar.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticateV2);

// Validation schemas
const eventValidation = createValidation([
  body("title").notEmpty().trim().withMessage("Title is required"),
  body("startTime")
    .notEmpty()
    .isISO8601()
    .withMessage("Valid start time is required"),
  body("endTime")
    .notEmpty()
    .isISO8601()
    .withMessage("Valid end time is required")
    .custom((value, { req }) => {
      const start = new Date(req.body.startTime);
      const end = new Date(value);
      return end > start;
    })
    .withMessage("End time must be after start time"),
  body("allDay").optional().isBoolean(),
  body("orgLevel")
    .notEmpty()
    .isIn(["company", "department", "team", "personal"])
    .withMessage("Valid organization level is required"),
  body("orgId")
    .optional()
    .isInt({ min: 1 })
    .custom((value, { req }) => {
      if (req.body.orgLevel === "department" || req.body.orgLevel === "team") {
        return value !== undefined;
      }
      return true;
    })
    .withMessage("Organization ID is required for department/team events"),
  body("description").optional().trim(),
  body("location").optional().trim(),
  body("reminderMinutes").optional().isInt({ min: 0 }),
  body("color")
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage("Color must be a valid hex color"),
  body("recurrenceRule").optional().isString(),
  body("attendeeIds")
    .optional()
    .isArray()
    .withMessage("Attendee IDs must be an array"),
  body("attendeeIds.*").isInt({ min: 1 }).withMessage("Invalid attendee ID"),
]);

const updateEventValidation = createValidation([
  body("title").optional().notEmpty().trim(),
  body("startTime").optional().isISO8601(),
  body("endTime")
    .optional()
    .isISO8601()
    .custom((value, { req }) => {
      if (req.body.startTime && value) {
        const start = new Date(req.body.startTime);
        const end = new Date(value);
        return end > start;
      }
      return true;
    })
    .withMessage("End time must be after start time"),
  body("allDay").optional().isBoolean(),
  body("orgLevel")
    .optional()
    .isIn(["company", "department", "team", "personal"]),
  body("orgId").optional().isInt({ min: 1 }),
  body("description").optional().trim(),
  body("location").optional().trim(),
  body("reminderMinutes").optional().isInt({ min: 0 }),
  body("color")
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage("Color must be a valid hex color"),
  body("recurrenceRule").optional().isString(),
  body("status").optional().isIn(["tentative", "confirmed", "cancelled"]),
]);

const listEventsValidation = createValidation([
  query("status").optional().isIn(["active", "cancelled"]),
  query("filter")
    .optional()
    .isIn(["all", "company", "department", "team", "personal"]),
  query("search").optional().isString().trim(),
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("sortBy")
    .optional()
    .isIn(["startDate", "endDate", "title", "createdAt"]),
  query("sortOrder").optional().isIn(["asc", "desc"]),
]);

const idValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Valid event ID is required"),
]);

const attendeeResponseValidation = createValidation([
  param("id").isInt({ min: 1 }).withMessage("Valid event ID is required"),
  body("response")
    .notEmpty()
    .isIn(["accepted", "declined", "tentative"])
    .withMessage("Valid response is required"),
]);

const exportValidation = createValidation([
  query("format")
    .notEmpty()
    .isIn(["ics", "csv"])
    .withMessage("Valid format is required (ics or csv)"),
]);

// Routes
router.get(
  "/events",
  apiLimiter,
  listEventsValidation,
  typed.auth(calendarController.listEvents),
);

router.get(
  "/events/:id",
  apiLimiter,
  idValidation,
  typed.auth(calendarController.getEvent),
);

router.post(
  "/events",
  apiLimiter,
  eventValidation,
  typed.auth(calendarController.createEvent),
);

router.put(
  "/events/:id",
  apiLimiter,
  idValidation,
  updateEventValidation,
  typed.auth(calendarController.updateEvent),
);

router.delete(
  "/events/:id",
  apiLimiter,
  idValidation,
  typed.auth(calendarController.deleteEvent),
);

router.put(
  "/events/:id/attendees/response",
  apiLimiter,
  attendeeResponseValidation,
  typed.auth(calendarController.updateAttendeeResponse),
);

router.get(
  "/export",
  apiLimiter,
  exportValidation,
  typed.auth(calendarController.exportEvents),
);

export default router;
