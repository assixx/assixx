# API v1 to v2 Migration Guide

This guide helps developers migrate from Assixx API v1 to the new standardized API v2.

## Overview

API v2 introduces breaking changes to improve consistency, security, and developer experience. The main changes include:

- **Standardized response format** with `success` flag
- **Field naming convention** changed from snake_case to camelCase
- **Improved error handling** with structured error codes
- **Enhanced authentication** with JWT access/refresh tokens
- **Deprecation headers** on all v1 endpoints

## Timeline

- **July 2025**: API v2 launch (Auth endpoints available)
- **August 2025**: Users API v2 available
- **September 2025**: All major endpoints migrated
- **December 31, 2025**: API v1 sunset date

## Key Changes

### 1. Base URL

```diff
- https://api.assixx.com/api/auth/login
+ https://api.assixx.com/api/v2/auth/login
```

### 2. Response Format

#### v1 Response (Inconsistent)

```json
// Success
{
  "message": "Login erfolgreich",
  "token": "jwt-token",
  "user": { ... }
}

// Error
{
  "error": "Invalid credentials"
}
```

#### v2 Response (Standardized)

```json
// Success
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "user": { ... }
  },
  "meta": {
    "timestamp": "2025-07-24T15:30:00.000Z",
    "version": "2.0"
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  },
  "meta": {
    "timestamp": "2025-07-24T15:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 3. Field Naming Convention

All field names changed from snake_case to camelCase.

**See [API v2 Quick Reference](./API-V2-QUICK-REFERENCE.md#-field-naming) for the complete field mapping table.**

### 4. Authentication Changes

#### Login Endpoint

**v1:**

```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "password123"
}
```

**v2:**

```bash
POST /api/v2/auth/login
{
  "email": "admin@example.com",
  "password": "password123"
}
```

Changes:

- Use `email` instead of `username`
- Returns both `accessToken` and `refreshToken`
- Access token expires in 15 minutes (was 24 hours)

#### Token Refresh

**New in v2:**

```bash
POST /api/v2/auth/refresh
{
  "refreshToken": "your-refresh-token"
}
```

Returns new access token without re-authentication.

### 5. Error Codes

v2 uses structured error codes:

| Code                  | Description              |
| --------------------- | ------------------------ |
| `VALIDATION_ERROR`    | Input validation failed  |
| `UNAUTHORIZED`        | Authentication required  |
| `FORBIDDEN`           | Insufficient permissions |
| `NOT_FOUND`           | Resource not found       |
| `CONFLICT`            | Resource already exists  |
| `INVALID_CREDENTIALS` | Login failed             |
| `TOKEN_EXPIRED`       | JWT token expired        |
| `INVALID_TOKEN`       | JWT token invalid        |
| `ACCOUNT_INACTIVE`    | User account suspended   |
| `SERVER_ERROR`        | Internal server error    |

### 6. Pagination

**v1:**

```
GET /api/users?page=1&limit=10
```

**v2:**

```
GET /api/v2/users?page=1&limit=20

Response includes pagination metadata:
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "pageSize": 20,
      "totalItems": 95
    }
  }
}
```

## Migration Steps

### Step 1: Update Base URLs

Update all API calls to use `/api/v2/` prefix:

```javascript
// Old
const API_BASE = "https://api.assixx.com/api";

// New
const API_BASE = "https://api.assixx.com/api/v2";
```

### Step 2: Update Response Handling

Check for `success` flag:

```javascript
// Old
if (response.error) {
  handleError(response.error);
} else {
  handleSuccess(response);
}

// New
if (response.success) {
  handleSuccess(response.data);
} else {
  handleError(response.error);
}
```

### Step 3: Update Field Names

Convert field names in requests and responses:

```javascript
// Helper function
function toSnakeCase(obj) {
  // Convert camelCase to snake_case for v1 compatibility
}

function toCamelCase(obj) {
  // Convert snake_case to camelCase for v2
}
```

### Step 4: Implement Token Refresh

Add refresh token logic:

```javascript
// Store tokens
localStorage.setItem('accessToken', response.data.accessToken);
localStorage.setItem('refreshToken', response.data.refreshToken);

// Refresh when access token expires
async function refreshAccessToken() {
  const response = await fetch('/api/v2/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken'),
    }),
  });

  if (response.success) {
    localStorage.setItem('accessToken', response.data.accessToken);
  }
}
```

### Step 5: Update Error Handling

Use structured error codes:

```javascript
function handleApiError(error) {
  switch (error.code) {
    case 'UNAUTHORIZED':
      // Redirect to login
      break;
    case 'TOKEN_EXPIRED':
      // Refresh token
      break;
    case 'VALIDATION_ERROR':
      // Show validation errors
      error.details.forEach((detail) => {
        showFieldError(detail.field, detail.message);
      });
      break;
    default:
      // Show generic error
      showError(error.message);
  }
}
```

## Deprecation Headers

All v1 endpoints include deprecation headers:

```
Deprecation: true
Sunset: 2025-12-31
Link: </api/v2>; rel="successor-version"
```

Monitor these headers and plan migration accordingly.

## Testing

1. **Use Swagger Documentation**: <http://localhost:3000/api-docs/v2>
2. **Test with curl**:

   ```bash
   curl -X POST http://localhost:3000/api/v2/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@example.com", "password": "password"}'
   ```

3. **Check Response Format**: Ensure all responses have `success` flag
4. **Verify Field Names**: All fields should be camelCase
5. **Test Error Scenarios**: Verify error codes and format

## Support

- **Documentation**: <http://localhost:3000/api-docs/v2>
- **Migration Issues**: Create issue in GitHub repository
- **Questions**: Contact <support@scs-technik.de>

## Endpoint Mapping

| v1 Endpoint                   | v2 Endpoint                      | Status         |
| ----------------------------- | -------------------------------- | -------------- |
| `POST /api/auth/login`        | `POST /api/v2/auth/login`        | ✅ Available   |
| `POST /api/auth/logout`       | `POST /api/v2/auth/logout`       | ✅ Available   |
| `GET /api/auth/user`          | `GET /api/v2/auth/me`            | ✅ Available   |
| `POST /api/signup`            | `POST /api/v2/auth/register`     | ✅ Available   |
| `GET /api/users`              | `GET /api/v2/users`              | 🚧 Coming Soon |
| `GET /api/calendar`           | `GET /api/v2/calendar/events`    | 🚧 Coming Soon |
| `GET /api/chat/conversations` | `GET /api/v2/chat/conversations` | 🚧 Coming Soon |

---

**Remember**: Start migrating early to avoid issues when v1 is sunset on December 31, 2025.
