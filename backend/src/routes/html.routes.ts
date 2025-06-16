/**
 * HTML Routes
 * Serves frontend pages
 */

import express, { Router, Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { authenticateToken, authorizeRole } from "../middleware/auth";

const router: Router = express.Router();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extended Request interfaces - removed unused types

// Helper function to serve HTML files
const servePage =
  (pageName: string) =>
  (_req: Request, res: Response): void => {
    res.sendFile(
      path.join(__dirname, "../../../frontend/src/pages", `${pageName}.html`),
    );
  };

// Public pages
router.get("/", servePage("index"));
router.get("/login", servePage("login"));
router.get("/signup", servePage("signup"));
router.get("/design-standards", servePage("design-standards"));

// Authenticated pages - All users
router.get("/dashboard", authenticateToken, servePage("dashboard"));
router.get("/profile", authenticateToken, servePage("profile"));
router.get("/profile-picture", authenticateToken, servePage("profile-picture"));
router.get("/settings", authenticateToken, servePage("settings"));
router.get("/hilfe", authenticateToken, servePage("hilfe"));
router.get("/chat", authenticateToken, servePage("chat"));
router.get("/blackboard", authenticateToken, servePage("blackboard"));
router.get("/calendar", authenticateToken, servePage("calendar"));
router.get("/kvp", authenticateToken, servePage("kvp"));

// Employee pages
router.get(
  "/employee-dashboard",
  authenticateToken,
  servePage("employee-dashboard"),
);
router.get(
  "/employee-profile",
  authenticateToken,
  servePage("employee-profile"),
);
router.get(
  "/employee-documents",
  authenticateToken,
  servePage("employee-documents"),
);
router.get(
  "/salary-documents",
  authenticateToken,
  servePage("salary-documents"),
);
router.get("/survey-employee", authenticateToken, servePage("survey-employee"));
router.get("/shifts", authenticateToken, servePage("shifts"));

// Admin pages
router.get(
  "/admin-dashboard",
  authenticateToken,
  authorizeRole("admin"),
  servePage("admin-dashboard"),
);
router.get(
  "/admin-config",
  authenticateToken,
  authorizeRole("admin"),
  servePage("admin-config"),
);
router.get(
  "/org-management",
  authenticateToken,
  authorizeRole("admin"),
  servePage("org-management"),
);
router.get(
  "/document-upload",
  authenticateToken,
  authorizeRole("admin"),
  servePage("document-upload"),
);
router.get(
  "/archived-employees",
  authenticateToken,
  authorizeRole("admin"),
  servePage("archived-employees"),
);
router.get(
  "/feature-management",
  authenticateToken,
  authorizeRole("admin"),
  servePage("feature-management"),
);
router.get(
  "/survey-admin",
  authenticateToken,
  authorizeRole("admin"),
  servePage("survey-admin"),
);
router.get(
  "/survey-results",
  authenticateToken,
  authorizeRole("admin"),
  servePage("survey-results"),
);
router.get("/survey-details", authenticateToken, servePage("survey-details"));

// Root pages
router.get(
  "/root-dashboard",
  authenticateToken,
  authorizeRole("root"),
  servePage("root-dashboard"),
);
router.get(
  "/root-features",
  authenticateToken,
  authorizeRole("root"),
  servePage("root-features"),
);
router.get(
  "/root-profile",
  authenticateToken,
  authorizeRole("root"),
  servePage("root-profile"),
);

// Development only pages
if (process.env.NODE_ENV !== "production") {
  router.get("/api-test", servePage("api-test"));
  router.get("/test-db", servePage("test-db"));
  router.get("/debug-dashboard", servePage("debug-dashboard"));
  router.get("/token-debug", servePage("token-debug"));
}

export default router;

// CommonJS compatibility
