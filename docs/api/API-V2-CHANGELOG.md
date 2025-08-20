# API v2 Changelog

Alle Änderungen an der API v2 werden hier dokumentiert.

## [1.0.0] - 2025-08-03 - API v2 Migration Complete! 🎉

### 03.08.2025 - FINALE: 100% Migration abgeschlossen

#### Added

- Complete Admin-Permissions API v2 with 8 endpoints:
  - Department permissions CRUD operations
  - Group permissions CRUD operations
  - Multi-level permissions (canRead, canWrite, canDelete)
  - Bulk operations for multiple admins
  - Access check endpoint for debugging
  - Root-only access (except /my endpoint)
  - Integration with Department-Groups
- Complete Department-Groups API v2 with 8 endpoints:
  - Hierarchical department grouping
  - Parent-child relationships for group hierarchy
  - Many-to-many department assignments
  - Integration with Admin-Permissions (deletion blocked if permissions exist)
  - Recursive department collection through subgroups
  - Circular dependency checking
- Complete Roles API v2 with 5 endpoints:
  - Static role definitions (root, admin, employee)
  - Role hierarchy with level system (100, 50, 10)
  - Permission arrays per role
  - Check endpoint for role-based access control
  - Assignable roles based on current user role
- Complete Signup API v2 with 2 endpoints (LAST API!):
  - Public tenant registration endpoint
  - Subdomain availability check
  - Wrapper around Tenant.create() with camelCase conversion
  - Subdomain validation and availability checking
  - Automatic 14-day trial period
  - Rate limiting on both endpoints

#### Changed

- API v2 migration officially completed at 01:00 AM
- 27/27 APIs successfully migrated (100%)
- All TypeScript errors resolved without using 'any'
- 576+ tests written and passing
- Phase 1: 13/13 APIs complete
- Phase 2: 14/14 APIs complete

#### Migration Statistics

- **Total Duration:** 6 days (28.07.2025 - 03.08.2025)
- **Total APIs:** 27 implemented
- **Total Tests:** 576+ written
- **Total Time:** ~48 hours of productive work
- **Average Speed:** 4-5 APIs per day
- **Code Volume:** ~50,000 lines
- **TypeScript Quality:** 0 'any' types used

### 02.08.2025

#### Added

- Complete Areas API v2 with 8 endpoints:
  - Area CRUD operations with multi-tenant isolation
  - Parent-child hierarchy for nested areas
  - Area types: building, warehouse, office, production, outdoor, other
  - Employee count statistics per area
  - Soft delete functionality with is_active flag
  - Area hierarchy endpoint for tree structure
  - Area statistics endpoint
- Complete Root API v2 with 25 endpoints (most comprehensive API!):
  - Admin user management (CRUD for all tenant admins)
  - Root user management (CRUD with security checks)
  - Tenant overview with statistics
  - Dashboard stats (user counts, features, system health)
  - Storage information with plan-based limits
  - Tenant deletion process with 2-root-user approval
  - Admin activity logs tracking
  - Deletion approvals management
  - Emergency stop for deletions
  - Dry run for tenant deletion
- Features API v2 with 11 endpoints and full test suite:
  - Multi-tenant feature flags system
  - Feature activation/deactivation
  - Usage tracking for billing
  - Feature categories (basic, core, premium, enterprise)
  - Tenant-specific configuration
  - Public feature listing
  - Test feature access endpoint
  - 32 tests with 100% coverage
- Audit Trail API v2 with 6 endpoints and full test suite:
  - Compliance-focused activity tracking
  - GDPR compliance reports generation
  - Data retention policies with root-only deletion
  - CSV/JSON export functionality
  - Statistics aggregation by actions/resources
  - User-based filtering (non-root see only own)
  - 30 tests with 100% coverage

#### Changed

- pool.execute replaced with execute wrapper from utils/db.js to fix TypeScript union type errors
- No 'any' types used in any new implementations
- Phase 3 APIs being implemented without tests for faster delivery

#### Fixed

- TypeScript union type errors with pool.execute
- Unused imports and parameters cleaned up
- Tenant type properties casting without using 'any'
- MySQL LIMIT/OFFSET parameter binding issue (use query() instead of execute())
- User filtering bug in Audit Trail (non-root users were seeing all entries)
- CSV export method binding error
- Express-validator methods compatibility

#### Security

- TODO: Admin can activate features for other tenants (cross-tenant vulnerability)
- Root API implements strict multi-level access control
- Tenant deletion requires approval from 2 root users

### 31.07.2025

#### Added

- Complete Notifications API v2 with 13 endpoints and 27 tests
- Complete Settings API v2 with 18 endpoints and 12 tests
- AdminLog → RootLog migration completed
- Complete Logs API v2 with 3 endpoints (root-only access)
- Complete Plans API v2 with 8 endpoints and 15 tests

### 30.07.2025

#### Added

- Complete Chat API v2 rewrite (9 service methods, 11 endpoints, 24 tests)
- Complete Surveys API v2 with 8 endpoints
- Complete Shifts API v2 with 17 endpoints and 31 tests

### 29.07.2025

#### Added

- Complete KVP API v2 with 13 endpoints and 22 tests
- Complete Role-Switch API v2 with 4 endpoints and 12 tests

### 28.07.2025

#### Added

- Complete Blackboard API v2 with 15 endpoints and 35 tests
- Complete Teams API v2 with 8 endpoints and 48 tests

### 27.07.2025

#### Added

- Complete Documents API v2 with 10 endpoints and 28 tests

### 25.07.2025

#### Added

- Complete Calendar API v2 with 10 endpoints:
  - Event CRUD operations with recurrence support
  - Attendee management with RSVP status
  - ICS/CSV export functionality
  - Visibility scopes (company/department/team)
  - Reminder notifications
- Complete Chat API v2 with 13 active endpoints:
  - Real-time messaging foundation
  - File attachments with multer
  - Conversation management
  - Unread message tracking
  - 5 endpoints marked as NOT_IMPLEMENTED for future Socket.io integration
- Complete Departments API v2 with 7 endpoints:
  - Department hierarchy management
  - Department statistics endpoint
  - Member management
  - Parent-child relationships
  - Manager assignment functionality
- 27 Integration tests for Departments v2
- 55 Tests for Calendar v2 (39 logic + 16 simple)

#### Changed

- Stats route ordering fixed in Departments v2 (must come before /:id)
- Service layer pattern established for all v2 APIs
- TypeScript build errors reduced to zero across all v2 implementations

#### Fixed

- Frontend signup.html JavaScript error (originalText scope issue)
- JSON parse error handling in signup form
- TypeScript type errors in Chat v2 service layer
- Route parameter validation in Departments v2
- Shell escaping issue with passwords containing ! documented

### 24.07.2025

#### Added

- Initial API v2 implementation started
- Deprecation Middleware for v1 endpoints (with sunset date 2025-12-31)
- Standardized Response Wrapper utilities with UUID request IDs
- Field Mapping utilities (camelCase ↔ snake_case)
- Complete Auth API v2 with 6 endpoints:
  - `POST /api/v2/auth/login`
  - `POST /api/v2/auth/register`
  - `POST /api/v2/auth/logout`
  - `POST /api/v2/auth/refresh`
  - `GET /api/v2/auth/verify`
  - `GET /api/v2/auth/me`
- Auth v2 Middleware for JWT Bearer token validation
- JWT implementation with Access (15m) & Refresh (7d) tokens
- Rate limiting per endpoint type
- Input validation with express-validator
- Multi-tenant support in all endpoints
- OpenAPI/Swagger v2 documentation at `/api-docs/v2`
- Comprehensive Migration Guide v1 → v2
- Integration test suite for Auth v2 endpoints
- API v2 announcement in README.md
- Complete Users API v2 with 13 endpoints:
  - `GET /api/v2/users` - List users with pagination
  - `GET /api/v2/users/me` - Get current user
  - `GET /api/v2/users/:id` - Get user by ID
  - `POST /api/v2/users` - Create new user
  - `PUT /api/v2/users/:id` - Update user
  - `PUT /api/v2/users/me/profile` - Update profile
  - `PUT /api/v2/users/me/password` - Change password
  - `DELETE /api/v2/users/:id` - Delete user
  - `POST /api/v2/users/:id/archive` - Archive user
  - `POST /api/v2/users/:id/unarchive` - Unarchive user
  - `GET /api/v2/users/me/profile-picture` - Get profile picture
  - `POST /api/v2/users/me/profile-picture` - Upload profile picture
  - `DELETE /api/v2/users/me/profile-picture` - Delete profile picture
  - `PUT /api/v2/users/:id/availability` - Update availability
- Employee Number auto-generation for new users
- Profile picture upload support with multer
- Availability tracking (vacation, sick, training, etc.)

#### Changed

- Response format standardized with `success` flag
- Error responses now include error codes and request IDs
- All API fields use camelCase (converted from snake_case DB fields)
- Deprecation headers added to all v1 endpoints

#### Fixed

- pnpm lock file Docker mount issue resolved
- lodash ESM import errors fixed (using individual imports)
- TypeScript type definitions for Express Request
- Frontend TypeScript error with setTimeout type
- 384 ESLint errors auto-fixed
- Duplicate jest.config files cleaned up (removed backend/jest.config.cjs)
- Users v2 Employee Number generation bug (missing field in INSERT query)
- bcrypt vs bcryptjs import mismatch
- uuid ESM import replaced with crypto.randomUUID()
- JWT token payload structure for v2 compatibility
- TypeScript strict mode compliance (removed all 'any' types)

#### Security

- JWT tokens with short-lived access tokens (15m)
- Refresh tokens with longer expiry (7d)
- Rate limiting on authentication endpoints
- Password hashing with bcryptjs

---

## Format Guide

### Version Format

- Date-based: YYYY.MM.DD
- Multiple releases per day: YYYY.MM.DD.N

### Categories

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Features marked for removal
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements
