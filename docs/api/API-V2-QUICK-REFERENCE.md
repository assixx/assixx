# API v2 Quick Reference

## 🚀 Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-07-24T15:30:00.000Z",
    "version": "2.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [...]  // Optional validation errors
  },
  "meta": {
    "timestamp": "2025-07-24T15:30:00.000Z",
    "requestId": "uuid"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "timestamp": "2025-07-24T15:30:00.000Z",
    "version": "2.0",
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "pageSize": 20,
      "totalItems": 95
    }
  }
}
```

## 🔑 Authentication

### Request Header

```
Authorization: Bearer <jwt-token>
```

### Token Types

- **Access Token**: 15 minutes expiry
- **Refresh Token**: 7 days expiry

## 📝 Field Naming

| Database (snake_case) | API (camelCase) |
| --------------------- | --------------- |
| first_name            | firstName       |
| last_name             | lastName        |
| created_at            | createdAt       |
| updated_at            | updatedAt       |
| tenant_id             | tenantId        |
| is_active             | isActive        |
| employee_number       | employeeNumber  |

## 🚨 Error Codes

| Code             | HTTP Status | Description              |
| ---------------- | ----------- | ------------------------ |
| VALIDATION_ERROR | 400         | Invalid input data       |
| UNAUTHORIZED     | 401         | Authentication required  |
| INVALID_TOKEN    | 401         | Invalid or expired token |
| FORBIDDEN        | 403         | Insufficient permissions |
| NOT_FOUND        | 404         | Resource not found       |
| CONFLICT         | 409         | Resource already exists  |
| SERVER_ERROR     | 500         | Internal server error    |

## 📋 Common Endpoints

### Auth v2

- `POST /api/v2/auth/login` - User login
- `POST /api/v2/auth/register` - Create user (admin)
- `POST /api/v2/auth/logout` - User logout
- `POST /api/v2/auth/refresh` - Refresh token
- `GET /api/v2/auth/verify` - Verify token
- `GET /api/v2/auth/me` - Current user

### Users v2 (Coming Soon)

- `GET /api/v2/users` - List users
- `POST /api/v2/users` - Create user
- `GET /api/v2/users/:id` - Get user
- `PUT /api/v2/users/:id` - Update user
- `DELETE /api/v2/users/:id` - Delete user

## 🛡️ Middleware Stack

```
1. Deprecation Headers (for v1)
2. Authentication (JWT validation)
3. Authorization (role check)
4. Rate Limiting
5. Input Validation
6. Controller Logic
```

## 🔧 Helper Functions

### Response Helpers

```typescript
import { successResponse, errorResponse, paginatedResponse } from "@/utils/apiResponse";

// Success
res.json(successResponse(data, "Optional message"));

// Error
res.status(400).json(errorResponse("ERROR_CODE", "Message", details));

// Paginated
res.json(paginatedResponse(data, paginationMeta));
```

### Field Mapping

```typescript
import { dbToApi, apiToDb } from "@/utils/fieldMapping";

// Database → API (outgoing)
const apiData = dbToApi(dbResult);

// API → Database (incoming)
const dbData = apiToDb(req.body);
```

## 📊 Pagination

### Request

```
GET /api/v2/users?page=2&limit=20
```

### Parameters

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

## 🚦 Rate Limits

| Endpoint Type | Limit   | Window |
| ------------- | ------- | ------ |
| Auth          | 5 req   | 15 min |
| General API   | 100 req | 15 min |
| Upload        | 10 req  | 15 min |

## 🔍 Testing

### Swagger UI

```
http://localhost:3000/api-docs/v2
```

### Example cURL

```bash
# Login
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Authenticated Request
curl -X GET http://localhost:3000/api/v2/auth/me \
  -H "Authorization: Bearer <token>"
```

## 📚 Documentation

- [Developer Guide](./API-V2-DEVELOPER-GUIDE.md)
- [Migration Guide](./MIGRATION-GUIDE-V1-TO-V2.md)
- [API Status](./API-V2-STATUS.md)
- [Changelog](./API-V2-CHANGELOG.md)
