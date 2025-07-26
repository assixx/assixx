# API v2 Changelog

Alle Änderungen an der API v2 werden hier dokumentiert.

## [Unreleased]

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
