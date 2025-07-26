# 🌟 Best Practice API Examples

## 📋 Übersicht

Diese Sammlung zeigt Best Practices von führenden APIs, die wir für Assixx adaptieren können.

## 1️⃣ Stripe API - Der Goldstandard

### Was macht Stripe richtig?

#### Konsistente Resource Naming

```javascript
// Stripe Pattern - Immer Plural
GET /v1/customers
GET /v1/customers/:id
GET /v1/customers/:id/sources
GET /v1/customers/:id/subscriptions

// Für Assixx
GET /api/v1/employees
GET /api/v1/employees/:id
GET /api/v1/employees/:id/documents
GET /api/v1/employees/:id/shifts
```

#### Expand Pattern für Related Data

```javascript
// Stripe - Verhindert N+1 Queries
GET /v1/charges?expand[]=customer&expand[]=invoice

// Response
{
  "id": "ch_123",
  "amount": 2000,
  "customer": {
    "id": "cus_123",
    "email": "john@example.com",
    "name": "John Doe"
  },
  "invoice": {
    "id": "inv_123",
    "number": "INV-2025-001"
  }
}

// Für Assixx
GET /api/v1/calendar/events?expand[]=creator&expand[]=attendees
```

#### Idempotency Keys

```javascript
// Stripe - Verhindert doppelte Operations
POST /v1/charges
Headers: {
  "Idempotency-Key": "unique-request-id-123"
}

// Für Assixx (wichtig für Shifts/Payments)
POST /api/v1/shifts/assignments
Headers: {
  "Idempotency-Key": "shift-assign-2025-07-24-user-123"
}
```

#### Versioning über URL

```
https://api.stripe.com/v1/...
https://api.stripe.com/v2/... (future)
```

## 2️⃣ GitHub API - Developer Experience

### Was macht GitHub richtig?

#### Hypermedia Links (HATEOAS)

```javascript
// GitHub Response mit Links
{
  "id": 1,
  "name": "octocat/Hello-World",
  "issues_url": "https://api.github.com/repos/octocat/Hello-World/issues{/number}",
  "pulls_url": "https://api.github.com/repos/octocat/Hello-World/pulls{/number}",
  "contents_url": "https://api.github.com/repos/octocat/Hello-World/contents/{+path}",
  "_links": {
    "self": "https://api.github.com/repos/octocat/Hello-World",
    "owner": "https://api.github.com/users/octocat"
  }
}

// Für Assixx
{
  "id": 123,
  "title": "Team Meeting",
  "_links": {
    "self": "/api/v1/calendar/events/123",
    "attendees": "/api/v1/calendar/events/123/attendees",
    "creator": "/api/v1/users/42",
    "ics": "/api/v1/calendar/events/123.ics"
  }
}
```

#### Conditional Requests (Caching)

```javascript
// GitHub - ETag Support
GET /repos/octocat/Hello-World
Response Headers: {
  "ETag": "a1b2c3d4e5f6"
}

// Subsequent Request
GET /repos/octocat/Hello-World
Headers: {
  "If-None-Match": "a1b2c3d4e5f6"
}
Response: 304 Not Modified

// Für Assixx (spart Bandbreite)
GET /api/v1/employees
Response Headers: {
  "ETag": "emp-list-2025-07-24-checksum"
}
```

#### Rate Limit Headers

```javascript
// GitHub Response Headers
{
  "X-RateLimit-Limit": "5000",
  "X-RateLimit-Remaining": "4999",
  "X-RateLimit-Reset": "1372700873",
  "X-RateLimit-Used": "1",
  "X-RateLimit-Resource": "core"
}

// Für Assixx
{
  "X-RateLimit-Limit": "1000",
  "X-RateLimit-Remaining": "999",
  "X-RateLimit-Reset": "1627852800",
  "X-RateLimit-Window": "hour"
}
```

## 3️⃣ Slack API - Real-time & Webhooks

### Was macht Slack richtig?

#### Cursor-based Pagination

```javascript
// Slack - Besser als Offset für große Datasets
GET /api/conversations.history?channel=C1234567890&cursor=dXNlcjpVMDYxTkZUVDI=

{
  "messages": [...],
  "response_metadata": {
    "next_cursor": "dXNlcjpVMDYxTkZUVDI="
  }
}

// Für Assixx Chat
GET /api/v1/chat/messages?conversation_id=123&cursor=msg_456

{
  "messages": [...],
  "meta": {
    "next_cursor": "msg_789",
    "has_more": true
  }
}
```

#### Event Subscriptions

```javascript
// Slack Webhook Registration
POST /api/apps.event.subscriptions.create
{
  "events": ["message.channels", "user.change"],
  "url": "https://myapp.com/slack/events"
}

// Für Assixx
POST /api/v1/webhooks
{
  "events": ["shift.created", "shift.updated", "employee.absent"],
  "url": "https://client.com/assixx/webhooks",
  "secret": "webhook-secret-123"
}
```

## 4️⃣ Twilio API - Error Handling

### Was macht Twilio richtig?

#### Detailed Error Responses

```javascript
// Twilio Error Format
{
  "code": 20003,
  "message": "Authenticate",
  "more_info": "https://www.twilio.com/docs/errors/20003",
  "status": 401,
  "details": {
    "your_request_id": "req_123",
    "support_ticket_url": "https://support.twilio.com/ticket/new"
  }
}

// Für Assixx
{
  "success": false,
  "error": {
    "code": "SHIFT_CONFLICT",
    "message": "Mitarbeiter ist bereits für diese Schicht eingeteilt",
    "details": {
      "employee_id": 123,
      "shift_id": 456,
      "existing_shift": 789
    },
    "help_url": "https://docs.assixx.com/errors/SHIFT_CONFLICT"
  },
  "request_id": "req_abc123"
}
```

## 5️⃣ Shopify API - Bulk Operations

### Was macht Shopify richtig?

#### Bulk Operations

```javascript
// Shopify GraphQL Bulk Operation
mutation {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            id
            title
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
      url
    }
  }
}

// Für Assixx - Bulk Shift Assignment
POST /api/v1/shifts/bulk-assign
{
  "assignments": [
    { "shift_id": 1, "employee_id": 10 },
    { "shift_id": 2, "employee_id": 11 },
    { "shift_id": 3, "employee_id": 12 }
  ],
  "validate_only": false
}

// Response
{
  "success": true,
  "results": [
    { "shift_id": 1, "status": "assigned" },
    { "shift_id": 2, "status": "assigned" },
    { "shift_id": 3, "status": "failed", "error": "Employee unavailable" }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

## 6️⃣ Spotify API - OAuth & Scopes

### Was macht Spotify richtig?

#### Granular Permission Scopes

```javascript
// Spotify OAuth Scopes
GET https://accounts.spotify.com/authorize?
  client_id=123&
  scope=user-read-private user-read-email playlist-modify-public

// Für Assixx
GET /api/v1/oauth/authorize?
  client_id=abc&
  scope=employees:read shifts:write documents:read calendar:manage

// Token Response
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "employees:read shifts:write",
  "tenant_id": 1
}
```

## 🎯 Key Takeaways für Assixx

### 1. Konsistenz ist König

- **Stripe:** Immer Plural für Resources
- **Anwendung:** `/employees`, `/shifts`, `/documents`

### 2. Developer Experience

- **GitHub:** Hypermedia Links für Discoverability
- **Anwendung:** `_links` Object in Responses

### 3. Performance

- **Slack:** Cursor-based Pagination für große Datasets
- **GitHub:** ETags für Caching
- **Anwendung:** Beides für Chat und große Listen

### 4. Error Handling

- **Twilio:** Maschinen- und Menschen-lesbare Errors
- **Anwendung:** Error Codes + Help URLs

### 5. Bulk Operations

- **Shopify:** Effiziente Bulk-Operationen
- **Anwendung:** Bulk Shift Assignments

### 6. Security

- **Spotify:** Granulare Permissions
- **Anwendung:** Scope-based Access Control

## 📊 Vergleichstabelle

| Feature       | Stripe | GitHub      | Slack  | Twilio   | Shopify | Assixx (Ziel) |
| ------------- | ------ | ----------- | ------ | -------- | ------- | ------------- |
| Versioning    | URL    | Header      | URL    | URL      | URL     | **URL**       |
| Pagination    | Cursor | Link Header | Cursor | Page     | Cursor  | **Mixed**     |
| Error Format  | Simple | Simple      | Simple | Detailed | Simple  | **Detailed**  |
| Rate Limiting | ✅     | ✅          | ✅     | ✅       | ✅      | **✅**        |
| Webhooks      | ✅     | ✅          | ✅     | ✅       | ✅      | **✅**        |
| Bulk Ops      | ❌     | ❌          | ❌     | ✅       | ✅      | **✅**        |
| HATEOAS       | ❌     | ✅          | ❌     | ❌       | ❌      | **Partial**   |
| Idempotency   | ✅     | ❌          | ✅     | ✅       | ✅      | **✅**        |

## 🚀 Implementierungs-Prioritäten

### Phase 1: Basics (Must Have)

1. Konsistente Resource Naming (Stripe-Style)
2. Standard Error Format (Twilio-Style)
3. Pagination (GitHub-Style für klein, Slack-Style für groß)

### Phase 2: Performance (Should Have)

1. ETag Support (GitHub-Style)
2. Expand Pattern (Stripe-Style)
3. Rate Limiting Headers

### Phase 3: Advanced (Nice to Have)

1. Bulk Operations (Shopify-Style)
2. Webhooks (Slack-Style)
3. HATEOAS Links (GitHub-Style)

---

**Zusammenstellung:** API Design Workshop Team  
**Letzte Aktualisierung:** [Date]
