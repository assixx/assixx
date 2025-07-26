# 📊 API Endpoints Decision Matrix

**Stand:** [Workshop-Datum]  
**Teilnehmer:** [Namen der Entscheider]

## 🎯 Entscheidungs-Kategorien

- **KEEP** ✅ - Endpoint bleibt unverändert
- **DEPRECATE** ⚠️ - Endpoint wird auslaufen
- **CHANGE** 🔄 - Breaking Change erforderlich
- **ADD** ➕ - Neuer Endpoint wird hinzugefügt
- **REMOVE** ❌ - Endpoint wird entfernt

## 📊 Decision Matrix

### 🔐 Authentication Endpoints

| Current Endpoint        | Test Expectation | Decision | New Endpoint | Priority | Migration Effort | Notes            |
| ----------------------- | ---------------- | -------- | ------------ | -------- | ---------------- | ---------------- |
| POST /api/auth/login    | ✅ Matches       | **KEEP** | -            | -        | None             | Funktioniert gut |
| POST /api/auth/register | ✅ Matches       | **KEEP** | -            | -        | None             | Standard OK      |
| POST /api/auth/logout   | ✅ Matches       | **KEEP** | -            | -        | None             | Standard OK      |
| GET /api/auth/validate  | ✅ Matches       | **KEEP** | -            | -        | None             | Standard OK      |

### 📅 Calendar API

| Current Endpoint         | Test Expectation                          | Decision      | New Endpoint                              | Priority   | Migration Effort | Notes                  |
| ------------------------ | ----------------------------------------- | ------------- | ----------------------------------------- | ---------- | ---------------- | ---------------------- |
| GET /api/calendar        | GET /api/calendar/events                  | **CHANGE** 🔄 | GET /api/calendar/events                  | **HIGH**   | Medium           | Tests erwarten /events |
| POST /api/calendar       | POST /api/calendar/events                 | **CHANGE** 🔄 | POST /api/calendar/events                 | **HIGH**   | Medium           | Konsistenz wichtig     |
| GET /api/calendar/:id    | GET /api/calendar/events/:id              | **CHANGE** 🔄 | GET /api/calendar/events/:id              | **HIGH**   | Medium           | RESTful pattern        |
| PUT /api/calendar/:id    | PUT /api/calendar/events/:id              | **CHANGE** 🔄 | PUT /api/calendar/events/:id              | **HIGH**   | Medium           | RESTful pattern        |
| DELETE /api/calendar/:id | DELETE /api/calendar/events/:id           | **CHANGE** 🔄 | DELETE /api/calendar/events/:id           | **HIGH**   | Medium           | RESTful pattern        |
| -                        | GET /api/calendar/availability            | **ADD** ➕    | GET /api/calendar/availability            | **MEDIUM** | Low              | Neues Feature          |
| -                        | GET /api/calendar/availability/free-slots | **ADD** ➕    | GET /api/calendar/availability/free-slots | **LOW**    | Low              | Nice to have           |

**Migration Notes:**

- Response format ändern: `data.eventId` statt komplettes Event
- Field names: `visibility_scope` → `org_level`

### 💬 Chat API

| Current Endpoint                          | Test Expectation              | Decision    | New Endpoint                  | Priority   | Migration Effort | Notes                    |
| ----------------------------------------- | ----------------------------- | ----------- | ----------------------------- | ---------- | ---------------- | ------------------------ |
| POST /api/chat/conversations              | POST /api/chat/channels       | **KEEP** ✅ | -                             | -          | -                | Conversations ist besser |
| GET /api/chat/conversations               | GET /api/chat/channels        | **KEEP** ✅ | -                             | -          | -                | Tests anpassen           |
| GET /api/chat/conversations/:id           | -                             | **KEEP** ✅ | -                             | -          | -                | Gut so                   |
| POST /api/chat/conversations/:id/messages | POST /api/chat/messages       | **KEEP** ✅ | -                             | -          | -                | Nested ist korrekt       |
| -                                         | GET /api/chat/messages        | **ADD** ➕  | GET /api/chat/messages        | **LOW**    | Medium           | Für globale Suche        |
| -                                         | PUT /api/chat/messages/:id    | **ADD** ➕  | PUT /api/chat/messages/:id    | **MEDIUM** | Low              | Edit Feature             |
| -                                         | DELETE /api/chat/messages/:id | **ADD** ➕  | DELETE /api/chat/messages/:id | **MEDIUM** | Low              | Delete Feature           |
| PUT /api/chat/conversations/:id/read      | -                             | **KEEP** ✅ | -                             | -          | -                | Sinnvolle Action         |
| GET /api/chat/attachments/:filename       | -                             | **KEEP** ✅ | -                             | -          | -                | Standard OK              |
| GET /api/chat/users                       | -                             | **KEEP** ✅ | -                             | -          | -                | Hilfreich                |
| GET /api/chat/unread-count                | -                             | **KEEP** ✅ | -                             | -          | -                | Performance              |

**Migration Notes:**

- Tests müssen "conversations" akzeptieren, nicht "channels"
- Message endpoints als Ergänzung, nicht Ersatz

### 👥 Employee/Admin API

| Current Endpoint                            | Test Expectation | Decision         | New Endpoint               | Priority   | Migration Effort | Notes                    |
| ------------------------------------------- | ---------------- | ---------------- | -------------------------- | ---------- | ---------------- | ------------------------ |
| POST /api/admin/employees                   | ✅ Matches       | **KEEP**         | -                          | -          | None             | Standard OK              |
| GET /api/admin/employees                    | ✅ Matches       | **KEEP**         | -                          | -          | None             | Standard OK              |
| GET /api/admin/employees/:id                | ✅ Matches       | **KEEP**         | -                          | -          | None             | Standard OK              |
| PUT /api/admin/employees/:id                | ✅ Matches       | **KEEP**         | -                          | -          | None             | Standard OK              |
| POST /api/admin/upload-document/:employeeId | -                | **DEPRECATE** ⚠️ | POST /api/documents/upload | **MEDIUM** | High             | Zu documents verschieben |
| GET /api/admin/dashboard-stats              | ✅ Matches       | **KEEP**         | -                          | -          | None             | Nützlich                 |

### 📋 Blackboard API

| Current Endpoint     | Test Expectation           | Decision   | New Endpoint               | Priority | Migration Effort | Notes          |
| -------------------- | -------------------------- | ---------- | -------------------------- | -------- | ---------------- | -------------- |
| GET /api/blackboard  | ✅ Matches                 | **KEEP**   | -                          | -        | None             | Funktioniert   |
| POST /api/blackboard | ✅ Matches                 | **KEEP**   | -                          | -        | None             | Multipart OK   |
| -                    | PUT /api/blackboard/:id    | **ADD** ➕ | PUT /api/blackboard/:id    | **LOW**  | Low              | Update Feature |
| -                    | DELETE /api/blackboard/:id | **ADD** ➕ | DELETE /api/blackboard/:id | **LOW**  | Low              | Delete Feature |

### 💡 KVP API

| Current Endpoint           | Test Expectation | Decision | New Endpoint | Priority | Migration Effort | Notes           |
| -------------------------- | ---------------- | -------- | ------------ | -------- | ---------------- | --------------- |
| GET /api/kvp               | ✅ Matches       | **KEEP** | -            | -        | None             | Standard OK     |
| POST /api/kvp              | ✅ Matches       | **KEEP** | -            | -        | None             | Standard OK     |
| GET /api/kvp/categories    | ✅ Matches       | **KEEP** | -            | -        | None             | Hilfreich       |
| GET /api/kvp/stats         | ✅ Matches       | **KEEP** | -            | -        | None             | Dashboard       |
| GET /api/kvp/:id           | ✅ Matches       | **KEEP** | -            | -        | None             | Standard OK     |
| GET /api/kvp/:id/comments  | ✅ Matches       | **KEEP** | -            | -        | None             | Sub-resource OK |
| POST /api/kvp/:id/comments | ✅ Matches       | **KEEP** | -            | -        | None             | Sub-resource OK |

### 📅 Shifts API

| Current Endpoint          | Test Expectation  | Decision       | New Endpoint | Priority | Migration Effort | Notes              |
| ------------------------- | ----------------- | -------------- | ------------ | -------- | ---------------- | ------------------ |
| GET /api/shifts/templates | ?                 | **ANALYZE** 🔍 | TBD          | **HIGH** | Unknown          | Tests analysieren  |
| GET /api/shifts/plans     | ?                 | **ANALYZE** 🔍 | TBD          | **HIGH** | Unknown          | Tests analysieren  |
| -                         | Various endpoints | **ANALYZE** 🔍 | TBD          | **HIGH** | Unknown          | 60/66 Tests failed |

### 🏢 Departments & Teams API

| Current Endpoint         | Test Expectation | Decision | New Endpoint | Priority | Migration Effort | Notes      |
| ------------------------ | ---------------- | -------- | ------------ | -------- | ---------------- | ---------- |
| All department endpoints | ✅ Matches       | **KEEP** | -            | -        | None             | RESTful OK |
| All team endpoints       | ✅ Matches       | **KEEP** | -            | -        | None             | RESTful OK |

## 📈 Priorisierung

### 🔴 Critical (Sofort)

- Keine identifiziert

### 🟠 High Priority (Sprint 1-2)

1. Calendar API Migration zu `/events`
2. Shifts API Analyse und Fixes
3. Validation Error Format vereinheitlichen

### 🟡 Medium Priority (Sprint 3-4)

1. Chat message edit/delete endpoints
2. Document upload consolidation
3. Calendar availability features

### 🟢 Low Priority (Backlog)

1. Blackboard edit/delete
2. Global message search
3. Calendar free-slots

## 💰 Impact Analysis

### Frontend Impact

| Area       | Affected Components     | Effort | Risk   |
| ---------- | ----------------------- | ------ | ------ |
| Calendar   | CalendarView, EventForm | HIGH   | Medium |
| Chat       | Tests only              | LOW    | Low    |
| Validation | All forms               | MEDIUM | Low    |

### Backend Impact

| Area            | Affected Code      | Effort | Risk |
| --------------- | ------------------ | ------ | ---- |
| Calendar Routes | 5 endpoints        | MEDIUM | Low  |
| Response Format | Middleware         | LOW    | Low  |
| Tests           | All calendar tests | HIGH   | Low  |

## 🚀 Migration Plan

### Phase 1: Preparation (Week 1)

- [ ] Update OpenAPI Spec
- [ ] Create migration guide
- [ ] Setup feature flags

### Phase 2: Backend (Week 2-3)

- [ ] Implement new endpoints
- [ ] Add deprecation headers
- [ ] Update tests

### Phase 3: Frontend (Week 3-4)

- [ ] Update API calls
- [ ] Test thoroughly
- [ ] Update documentation

### Phase 4: Cleanup (Week 5)

- [ ] Remove old endpoints
- [ ] Final testing
- [ ] Go-live

## 📝 Notes & Discussions

### Calendar API

- **Pro RESTful:** Klare Struktur, Standard-konform
- **Contra:** Breaking Change für Frontend
- **Entscheidung:** Migration wert für Konsistenz

### Chat Terminology

- **"Conversations" vs "Channels":** Conversations ist moderner
- **Entscheidung:** Bei Conversations bleiben, Tests anpassen

### Validation Errors

- **"field" vs "path":** Field ist klarer für Frontend
- **Entscheidung:** Auf "field" standardisieren

## ✅ Action Items

| Action                   | Owner         | Due Date | Status |
| ------------------------ | ------------- | -------- | ------ |
| Update OpenAPI Spec      | Backend Lead  | [Date]   | 🔲     |
| Create Migration Guide   | Tech Lead     | [Date]   | 🔲     |
| Update Calendar Tests    | QA Lead       | [Date]   | 🔲     |
| Frontend Impact Analysis | Frontend Lead | [Date]   | 🔲     |
| Communication Plan       | Product Owner | [Date]   | 🔲     |

---

**Letztes Update:** [Timestamp]  
**Nächstes Review:** [Date]
