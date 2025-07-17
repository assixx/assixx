/**
 * Legacy Routes
 * Handles old API endpoints for backward compatibility
 */

import express, { Router } from "express";
import { security } from "../middleware/security";
import { logger } from "../utils/logger";
import { successResponse, errorResponse } from "../types/response.types";
import { typed } from "../utils/routeHandlers";

// Import models (now ES modules)
import User from "../models/user";
import Document from "../models/document";
import Department from "../models/department";
import Team from "../models/team";
import { DbUser } from "../models/user";

const router: Router = express.Router();

// Response interfaces
interface AuthCheckResponse {
  authenticated: boolean;
  user: {
    id: number;
    role: string;
    email: string;
  };
}

interface CountsResponse {
  employees: number;
  documents: number;
  departments: number;
  teams: number;
}

interface RootDashboardResponse {
  user: {
    id: number;
    username: string;
    role: string;
    iat?: number;
    exp?: number;
  };
}

interface CreateAdminResponse {
  message: string;
  admin: {
    id: number;
    username: string;
    email: string;
    company?: string;
  };
}

// Auth check endpoint (legacy location)
router.get(
  "/api/auth/check",
  ...security.user(),
  typed.auth((req, res) => {
    const response: AuthCheckResponse = {
      authenticated: true,
      user: {
        id: req.user.id,
        role: req.user.role,
        email: req.user.email,
      },
    };
    res.json(successResponse(response));
  }),
);

// User profile endpoint
router.get(
  "/api/user/profile",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const user = await User.findById(req.user.id, req.user.tenant_id);

      if (!user) {
        res.status(404).json(errorResponse("User not found", 404));
        return;
      }

      const { password: _password, ...userWithoutPassword } = user;
      res.json(successResponse(userWithoutPassword));
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Test DB endpoints (for admin dashboard)
router.get(
  "/test/db/employees",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employees = await User.findAll({
        role: "employee",
        tenant_id: req.user.tenant_id,
      });
      res.json(successResponse(employees));
    } catch {
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

router.get(
  "/test/db/counts",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const employees = await User.count({
        role: "employee",
        tenant_id: req.user.tenant_id,
      });
      const documents = await Document.countByTenant(req.user.tenant_id);

      const response: CountsResponse = {
        employees: employees ?? 0,
        documents: documents ?? 0,
        departments: 0,
        teams: 0,
      };

      res.json(successResponse(response));
    } catch {
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

router.get(
  "/test/db/documents",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const documents = await Document.findWithFilters({
        tenant_id: req.user.tenant_id,
      });
      res.json(successResponse(documents));
    } catch {
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

router.get(
  "/test/db/departments",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const departments = await Department.findAll(req.user.tenant_id);
      res.json(successResponse(departments || []));
    } catch {
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Teams endpoint
router.get(
  "/teams",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const teams = await Team.findAll(req.user.tenant_id);
      res.json(successResponse(teams || []));
    } catch {
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Admin employees endpoint
router.get(
  "/admin/employees",
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      const employees = await User.findAllByTenant(req.user.tenant_id);
      res.json(successResponse(employees));
    } catch {
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Root admins endpoint - legacy location
router.get(
  "/root/admins",
  ...security.root(),
  typed.auth(async (req, res) => {
    try {
      const admins = await User.findAll({
        role: "admin",
        tenant_id: req.user.tenant_id,
      });
      res.json(successResponse(admins || []));
    } catch (error) {
      console.error("Error fetching admins:", error);
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Root dashboard data endpoint
router.get(
  "/api/root-dashboard-data",
  ...security.root(),
  typed.auth(async (req, res) => {
    try {
      const response: RootDashboardResponse = {
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
        },
      };

      res.json(successResponse(response));
    } catch (error) {
      console.error("Error fetching root dashboard data:", error);
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Root create admin endpoint
router.post(
  "/root/create-admin",
  ...security.root(),
  typed.body<{
    username: string;
    password: string;
    email: string;
    company?: string;
  }>(async (req, res) => {
    try {
      const { username, password, email, company } = req.body;

      // Create admin user
      const newAdminId = await User.create({
        username,
        password,
        email,
        company,
        role: "admin",
        tenant_id: req.user.tenant_id,
        first_name: "",
        last_name: "",
      });

      const response: CreateAdminResponse = {
        message: "Admin created successfully",
        admin: {
          id: newAdminId,
          username,
          email,
          company,
        },
      };

      res.json(successResponse(response));
    } catch (error) {
      console.error("Error creating admin:", error);
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Root delete admin endpoint
router.delete(
  "/root/delete-admin/:id",
  ...security.root(),
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const adminId = parseInt(req.params.id, 10);
      await User.delete(adminId);

      res.json(successResponse({ message: "Admin deleted successfully" }));
    } catch (error) {
      console.error("Error deleting admin:", error);
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Documents endpoint
router.get(
  "/documents",
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const documents = await Document.findByUserId(req.user.id);
      res.json(successResponse(documents || []));
    } catch {
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Admin employees endpoint (duplicate - different response format)
router.get(
  "/admin/employees",
  ...security.admin(),
  typed.auth(async (req, res) => {
    try {
      const employees = await User.findAllByTenant(req.user.tenant_id);

      // Remove sensitive data
      const sanitizedEmployees = employees.map((user: DbUser) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        department_id: user.department_id,
        team_id: user.team_id,
        phone: user.phone,
        created_at: user.created_at,
        is_active: user.is_active,
      }));

      res.json(successResponse(sanitizedEmployees));
    } catch (error) {
      logger.error("Error fetching employees:", error);
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

// Teams endpoint (duplicate - empty response)
router.get(
  "/teams",
  ...security.user(),
  typed.auth(async (_req, res) => {
    try {
      // For now, return empty array since teams table structure needs to be defined
      // This will prevent JSON parse errors
      res.json(successResponse([]));
    } catch (error) {
      logger.error("Error fetching teams:", error);
      res.status(500).json(errorResponse("Server error", 500));
    }
  }),
);

export default router;

// CommonJS compatibility
