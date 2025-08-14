# API v2 Developer Guide

This guide helps developers implement new API v2 endpoints following our established patterns and standards.

## 🏗️ Architecture Overview

API v2 follows a consistent architecture:

```
/api/v2/{resource}/{action}
    ↓
Route Definition (with validation)
    ↓
Middleware (Auth, Rate Limiting)
    ↓
Controller (Business Logic)
    ↓
Service Layer (Database Access)
    ↓
Response Wrapper (Standardized Format)
```

## 📁 File Structure

For each new API resource, create:

```
backend/src/routes/v2/{resource}/
├── index.ts              # Route definitions
├── {resource}.controller.ts   # Business logic
└── {resource}.validation.ts   # Input validation
```

## 🚀 Step-by-Step Implementation

### 1. Create Route Definition

```typescript
// backend/src/routes/v2/users/index.ts
import express, { Router } from "express";
import { authenticateV2, requireRoleV2 } from "../../../middleware/v2/auth.middleware";
import { rateLimiter } from "../../../middleware/rateLimiter";
import { typed } from "../../../utils/routeHandlers";
import { usersController } from "./users.controller";
import { usersValidation } from "./users.validation";

const router: Router = express.Router();

// List users (protected, admin only)
router.get(
  "/",
  authenticateV2,
  requireRoleV2(["admin", "root"]),
  usersValidation.list,
  typed.auth(usersController.listUsers),
);

// Create user (protected, admin only)
router.post(
  "/",
  authenticateV2,
  requireRoleV2(["admin", "root"]),
  rateLimiter.auth,
  usersValidation.create,
  typed.body(usersController.createUser),
);

export default router;
```

### 2. Create Validation Rules

```typescript
// backend/src/routes/v2/users/users.validation.ts
import { body, query, param, ValidationChain } from "express-validator";

export const usersValidation = {
  list: [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1-100"),
    query("search").optional().isString().trim(),
    query("role").optional().isIn(["employee", "admin", "root"]),
  ],

  create: [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("firstName").isString().trim().notEmpty().withMessage("First name required"),
    body("lastName").isString().trim().notEmpty().withMessage("Last name required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("role").optional().isIn(["employee", "admin"]).withMessage("Invalid role"),
  ],

  update: [
    param("id").isInt().withMessage("Valid user ID required"),
    body("firstName").optional().isString().trim().notEmpty(),
    body("lastName").optional().isString().trim().notEmpty(),
    body("role").optional().isIn(["employee", "admin"]),
  ],
};
```

### 3. Create Controller

```typescript
// backend/src/routes/v2/users/users.controller.ts
import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse, paginatedResponse } from "../../../utils/apiResponse";
import { dbToApi, apiToDb } from "../../../utils/fieldMapping";
import { userService } from "../../../services/user.service";
import { AuthenticatedRequest } from "../../../types/request.types";

export const usersController = {
  async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", errors.array()));
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const role = req.query.role as string;

      // Get users from service
      const result = await userService.getUsers({
        tenantId: req.tenantId!,
        page,
        limit,
        search,
        role,
      });

      // Convert to camelCase for API
      const users = result.users.map((user) => dbToApi(user));

      res.json(
        paginatedResponse(users, {
          currentPage: page,
          totalPages: Math.ceil(result.total / limit),
          pageSize: limit,
          totalItems: result.total,
        }),
      );
    } catch (error) {
      console.error("[Users v2] List error:", error);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to fetch users"));
    }
  },

  async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", errors.array()));
        return;
      }

      // Convert from camelCase to snake_case for DB
      const userData = apiToDb({
        ...req.body,
        tenantId: req.tenantId,
        createdBy: req.userId,
      });

      // Create user
      const newUser = await userService.createUser(userData);

      // Convert back to camelCase for response
      res.status(201).json(successResponse(dbToApi(newUser), "User created successfully"));
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        res.status(409).json(errorResponse("CONFLICT", "Email already exists"));
        return;
      }

      console.error("[Users v2] Create error:", error);
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create user"));
    }
  },
};
```

### 4. Register Routes

```typescript
// backend/src/routes/v2/index.ts
import express, { Router } from "express";
import authRoutes from "./auth";
import usersRoutes from "./users"; // Add this

const router: Router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes); // Add this

export default router;
```

## 📋 Checklist for New Endpoints

- [ ] Route definition with proper middleware order
- [ ] Input validation rules
- [ ] Controller with error handling
- [ ] Service layer integration
- [ ] Response uses standardized format
- [ ] Field mapping (camelCase ↔ snake_case)
- [ ] Multi-tenant isolation enforced
- [ ] Rate limiting applied where needed
- [ ] Authentication/authorization configured
- [ ] OpenAPI documentation updated
- [ ] Integration tests written
- [ ] Error scenarios handled

## 🔧 Common Patterns

### Pagination

```typescript
// In validation
(query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 }));

// In controller
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 20;
const offset = (page - 1) * limit;

// Use paginatedResponse helper
res.json(paginatedResponse(data, paginationMeta));
```

### Error Handling

```typescript
// Validation errors
if (!errors.isEmpty()) {
  res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", errors.array()));
  return;
}

// Not found
res.status(404).json(errorResponse("NOT_FOUND", "Resource not found"));

// Conflict (duplicate)
res.status(409).json(errorResponse("CONFLICT", "Resource already exists"));

// Server error
res.status(500).json(errorResponse("SERVER_ERROR", "An error occurred"));
```

### Multi-Tenant Isolation

Always filter by tenant:

```typescript
// In queries
WHERE tenant_id = ?

// In controller
const result = await service.getResource({
  tenantId: req.tenantId!,
  ...otherParams
});
```

### Field Mapping

```typescript
// API → DB (incoming requests)
const dbData = apiToDb(req.body);

// DB → API (outgoing responses)
const apiData = dbToApi(dbResult);
```

## 🧪 Testing

Create integration tests for each endpoint:

```typescript
// backend/src/routes/__tests__/users-v2.test.ts
describe("Users API v2", () => {
  describe("GET /api/v2/users", () => {
    it("should return paginated users list", async () => {
      const response = await request(app)
        .get("/api/v2/users")
        .set("Authorization", `Bearer ${validToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        meta: {
          pagination: {
            currentPage: 1,
            pageSize: 10,
            totalPages: expect.any(Number),
            totalItems: expect.any(Number),
          },
        },
      });
    });

    it("should enforce authentication", async () => {
      const response = await request(app).get("/api/v2/users");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
```

## 🔍 Debugging Tips

1. **Check middleware order**: Auth → Rate Limit → Validation → Controller
2. **Verify field mapping**: Log before/after transformation
3. **Test with Swagger**: Use `/api-docs/v2` for quick testing
4. **Check tenant isolation**: Verify queries include tenant_id
5. **Monitor rate limits**: Check headers for rate limit info

## 📚 Resources

- [API Standards](./API-WORKSHOP-MATERIALS/workshop-decisions.md)
- [Migration Guide](./MIGRATION-GUIDE-V1-TO-V2.md)
- [TypeScript Architecture](../../docs/TYPESCRIPT-STANDARDS.md)
- [Response Types](../../backend/src/utils/apiResponse.ts)

## 🎯 Next Steps

When implementing a new v2 endpoint:

1. Follow this guide step-by-step
2. Use existing Auth v2 as reference
3. Update OpenAPI documentation
4. Write integration tests
5. Update API changelog

Remember: Consistency is key! Follow the established patterns for a cohesive API.
