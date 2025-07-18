/**
 * Central Route Registry
 * All API routes are registered here
 */

import express, { Router, Request, Response } from "express";

const router: Router = express.Router();

import adminRoutes from "./admin";
import adminPermissionsRoutes from "./admin-permissions.js";
import areaRoutes from "./areas";
import authRoutes from "./auth.routes";
import availabilityRoutes from "./availability";
import blackboardRoutes from "./blackboard";
import calendarRoutes from "./calendar";
import chatRoutes from "./chat";
import departmentGroupsRoutes from "./department-groups.js";
import departmentRoutes from "./departments";
import documentRoutes from "./documents";
import employeeRoutes from "./employee";
import featureRoutes from "./features";
import kvpRoutes from "./kvp";
import logsRoutes from "./logs.js";
import machineRoutes from "./machines";
import planRoutes from "./plans";
import rootRoutes from "./root";
import shiftRoutes from "./shifts";
import signupRoutes from "./signup";
import surveyRoutes from "./surveys";
import teamRoutes from "./teams";
import unsubscribeRoutes from "./unsubscribe";
import userProfileRoutes from "./user";
import userRoutes from "./users";
/**
 * Central Route Registry
 * All API routes are registered here
 */

// Import all route modules
// Import remaining routes (now ES modules)
// API Version prefix
const API_PREFIX = "/api";

// Public routes (no prefix needed)
console.log("[DEBUG] Mounting auth routes at /api/auth");
router.use("/api/auth", authRoutes);
router.use("/api", signupRoutes); // Signup routes at /api/signup
router.use("/unsubscribe", unsubscribeRoutes); // Unsubscribe routes at /unsubscribe

// Protected routes with prefix
router.use(`${API_PREFIX}/users`, userRoutes);
router.use(`${API_PREFIX}/user`, userProfileRoutes);
router.use(`${API_PREFIX}/documents`, documentRoutes);
router.use(`${API_PREFIX}/blackboard`, blackboardRoutes);
router.use(`${API_PREFIX}/calendar`, calendarRoutes);
router.use(`${API_PREFIX}/chat`, chatRoutes);
router.use(`${API_PREFIX}/kvp`, kvpRoutes);
router.use(`${API_PREFIX}/shifts`, shiftRoutes);
router.use(`${API_PREFIX}/surveys`, surveyRoutes);
router.use(`${API_PREFIX}/features`, featureRoutes);
router.use(`${API_PREFIX}/plans`, planRoutes);
router.use(`${API_PREFIX}/departments`, departmentRoutes);
router.use(`${API_PREFIX}/teams`, teamRoutes);
router.use(`${API_PREFIX}/admin`, adminRoutes);
router.use(`${API_PREFIX}/root`, rootRoutes);
router.use(`${API_PREFIX}/employee`, employeeRoutes);
router.use(`${API_PREFIX}/machines`, machineRoutes);
router.use(`${API_PREFIX}/areas`, areaRoutes);
router.use(`${API_PREFIX}/availability`, availabilityRoutes);
router.use(`${API_PREFIX}/admin-permissions`, adminPermissionsRoutes);
router.use(`${API_PREFIX}/department-groups`, departmentGroupsRoutes);
router.use(`${API_PREFIX}/logs`, logsRoutes);

// Health check endpoint
router.get(`${API_PREFIX}/health`, (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler for API routes
router.use(`${API_PREFIX}`, (req: Request, res: Response): void => {
  res.status(404).json({
    error: "API endpoint not found",
    path: req.originalUrl,
  });
});

export default router;

// CommonJS compatibility
