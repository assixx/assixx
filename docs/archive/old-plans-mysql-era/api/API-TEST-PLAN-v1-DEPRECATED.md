# API Test Plan for Assixx (v1 - DEPRECATED)

> ⚠️ **DEPRECATED**: Dieses Dokument bezieht sich auf API v1.
> Für API v2 siehe: `/docs/api/API-IMPLEMENTATION-ROADMAP.md`
> Status: Wird durch API v2 ersetzt (Timeline: 12 Wochen)

## Overview

This document outlines the comprehensive API testing strategy for all Assixx endpoints. Each endpoint will have tests covering:

- ✅ Successful operations
- 🔐 Authentication and authorization
- 🏢 Multi-tenant isolation
- ❌ Error handling
- 🔍 Input validation
- 📊 Performance benchmarks

## Test Coverage Status

### 🔴 Critical Endpoints (Must Test)

#### 1. **Tenant Creation** - `/api/signup`

- [ ] POST /api/signup - Create new tenant with admin user
- [ ] GET /api/check-subdomain/:subdomain - Check subdomain availability
- **Critical Tests:**
  - Successful tenant creation
  - Duplicate subdomain rejection
  - Invalid data validation
  - Admin user creation verification
  - Trial period setup

#### 2. **Authentication** - `/api/auth`

- [ ] POST /api/auth/login - User login
- [ ] POST /api/auth/logout - User logout
- [ ] GET /api/auth/me - Get current user
- [ ] POST /api/auth/refresh - Refresh token
- **Critical Tests:**
  - Valid login with JWT generation
  - Invalid credentials rejection
  - Multi-tenant user isolation
  - Token expiration handling
  - Session management

#### 3. **Document Management** - `/api/documents`

- [ ] POST /api/documents/upload - Upload document
- [ ] GET /api/documents - List documents
- [ ] GET /api/documents/:id - Get specific document
- [ ] DELETE /api/documents/:id - Delete document
- [ ] GET /api/documents/download/:id - Download document
- **Critical Tests:**
  - File upload with virus scanning
  - Multi-tenant document isolation
  - Access control (personal/department/company)
  - File type validation
  - Storage quota enforcement

### 🟡 Important Endpoints

#### 4. **User Management** - `/api/users`

- [ ] GET /api/users - List users
- [ ] POST /api/users - Create user
- [ ] GET /api/users/:id - Get user details
- [ ] PUT /api/users/:id - Update user
- [ ] DELETE /api/users/:id - Delete user
- **Key Tests:**
  - User creation within tenant
  - Role-based access control
  - Password security requirements
  - Department assignment

#### 5. **Blackboard** - `/api/blackboard`

- [ ] GET /api/blackboard - List entries
- [ ] POST /api/blackboard - Create entry
- [ ] PUT /api/blackboard/:id - Update entry
- [ ] DELETE /api/blackboard/:id - Delete entry
- **Key Tests:**
  - Visibility scopes (company/department/team)
  - Priority handling
  - Read status tracking

#### 6. **Calendar** - `/api/calendar`

- [ ] GET /api/calendar/events - List events
- [ ] POST /api/calendar/events - Create event
- [ ] PUT /api/calendar/events/:id - Update event
- [ ] DELETE /api/calendar/events/:id - Delete event
- **Key Tests:**
  - Event visibility scopes
  - Recurring events
  - Conflict detection

#### 7. **KVP (Suggestions)** - `/api/kvp`

- [ ] GET /api/kvp/suggestions - List suggestions
- [ ] POST /api/kvp/suggestions - Create suggestion
- [ ] PUT /api/kvp/suggestions/:id - Update suggestion
- [ ] POST /api/kvp/suggestions/:id/comment - Add comment
- **Key Tests:**
  - Anonymous submission
  - Status workflow
  - Attachment handling

#### 8. **Shift Planning** - `/api/shifts`

- [ ] GET /api/shifts/templates - List templates
- [ ] POST /api/shifts/plans - Create shift plan
- [ ] PUT /api/shifts/plans/:id - Update plan
- [ ] POST /api/shifts/assignments - Assign shifts
- **Key Tests:**
  - Conflict prevention
  - Required staff validation
  - Department isolation

### 🟢 Standard Endpoints

#### 9. **Departments** - `/api/departments`

- [ ] GET /api/departments - List departments
- [ ] POST /api/departments - Create department
- [ ] PUT /api/departments/:id - Update department
- [ ] DELETE /api/departments/:id - Delete department

#### 10. **Teams** - `/api/teams`

- [ ] GET /api/teams - List teams
- [ ] POST /api/teams - Create team
- [ ] PUT /api/teams/:id - Update team
- [ ] DELETE /api/teams/:id - Delete team

#### 11. **Chat** - `/api/chat`

- [ ] GET /api/chat/conversations - List conversations
- [ ] POST /api/chat/conversations - Create conversation
- [ ] POST /api/chat/messages - Send message
- [ ] GET /api/chat/messages/:conversationId - Get messages

#### 12. **Surveys** - `/api/surveys`

- [ ] GET /api/surveys - List surveys
- [ ] POST /api/surveys - Create survey
- [ ] POST /api/surveys/:id/responses - Submit response
- [ ] GET /api/surveys/:id/results - Get results

### 🔵 Administrative Endpoints

#### 13. **Admin Operations** - `/api/admin`

- [ ] GET /api/admin/tenants - List all tenants
- [ ] PUT /api/admin/tenants/:id - Update tenant
- [ ] GET /api/admin/statistics - System statistics
- [ ] POST /api/admin/backup - Trigger backup

#### 14. **Root Operations** - `/api/root`

- [ ] POST /api/root/tenants - Create tenant (admin)
- [ ] DELETE /api/root/tenants/:id - Delete tenant
- [ ] POST /api/root/maintenance - Toggle maintenance mode

## Test Implementation Strategy

### Phase 1: Critical Path (Week 1)

1. Tenant Creation Tests
2. Authentication Tests
3. Document Upload Tests
4. Basic User Management Tests

### Phase 2: Core Features (Week 2)

1. Blackboard Tests
2. Calendar Tests
3. KVP Tests
4. Department/Team Tests

### Phase 3: Advanced Features (Week 3)

1. Shift Planning Tests
2. Chat Tests
3. Survey Tests
4. Admin/Root Tests

### Phase 4: Integration & E2E (Week 4)

1. Multi-tenant isolation scenarios
2. Role-based access scenarios
3. Performance benchmarks
4. Load testing

## Test Utilities Needed

### 1. Test Data Factories

```typescript
-createTestTenant() -
  createTestUser(role, tenantId) -
  createTestDocument(category, targetId) -
  createTestDepartment(tenantId);
```

### 2. Authentication Helpers

```typescript
-getAuthToken(username, password) - withAuth(request, token) - expectUnauthorized(response);
```

### 3. Multi-tenant Assertions

```typescript
-expectTenantIsolation(resource, tenantId) - expectCrossTenantRejection(request);
```

### 4. File Upload Helpers

```typescript
-createTestFile(type, size) - uploadFile(endpoint, file, metadata);
```

## Success Metrics

- **Coverage**: >80% of all API endpoints
- **Multi-tenant**: 100% tenant isolation verification
- **Security**: All auth paths tested
- **Performance**: <200ms average response time
- **Reliability**: All tests pass consistently

## Swagger Integration

The API is already documented with Swagger/OpenAPI. We should:

1. Ensure all endpoints have proper Swagger annotations
2. Set up Swagger UI at `/api-docs`
3. Generate API client from OpenAPI spec
4. Use schema validation in tests

## Next Steps

1. Create test utilities and helpers
2. Implement Phase 1 critical path tests
3. Set up CI/CD test reporting
4. Create performance benchmarks
5. Document test patterns for team
