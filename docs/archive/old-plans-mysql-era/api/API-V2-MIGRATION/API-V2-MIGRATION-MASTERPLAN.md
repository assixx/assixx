# API v2 Migration Masterplan 🚀

## Executive Summary

Die API v2 Implementation ist zu **100% abgeschlossen** (27/27 APIs). Dieser Plan beschreibt die vollständige Migration von API v1 zu API v2, einschließlich Frontend-Anpassungen, Abschaltung der alten APIs und Rollout-Strategie.

**Ziel:** Vollständige Umstellung auf API v2 bis Ende August 2025

## 📊 Aktueller Status

### ✅ API v2 Implementation Status (100% Complete)

**27 APIs vollständig implementiert:**

#### Phase 1 APIs (13/13)

1. Auth API v2 ✅
2. Users API v2 ✅
3. Calendar API v2 ✅
4. Chat API v2 ✅
5. Departments API v2 ✅
6. Teams API v2 ✅
7. Documents API v2 ✅
8. Blackboard API v2 ✅
9. Role-Switch API v2 ✅
10. KVP API v2 ✅
11. Shifts API v2 ✅
12. Surveys API v2 ✅
13. Notifications API v2 ✅

#### Phase 2 APIs (14/14)

1. Settings API v2 ✅
2. Machines API v2 ✅
3. Logs API v2 ✅
4. Features API v2 ✅
5. Plans API v2 ✅
6. Areas API v2 ✅
7. Root API v2 ✅
8. Admin-Permissions API v2 ✅
9. Reports API v2 ✅
10. Audit Trail API v2 ✅
11. Department-Groups API v2 ✅
12. Roles API v2 ✅
13. Signup API v2 ✅
14. Admin API v2 ✅

### 🔄 Mapping: v1 → v2 APIs

| v1 Route                   | v2 Route                                         | Status    | Breaking Changes           |
| -------------------------- | ------------------------------------------------ | --------- | -------------------------- |
| `/api/auth/*`              | `/api/v2/auth/*`                                 | ✅ Ready  | Bearer Token statt Cookies |
| `/api/users/*`             | `/api/v2/users/*`                                | ✅ Ready  | camelCase Fields           |
| `/api/calendar/*`          | `/api/v2/calendar/*`                             | ✅ Ready  | Neue Response Struktur     |
| `/api/chat/*`              | `/api/v2/chat/*`                                 | ✅ Ready  | WebSocket Upgrade          |
| `/api/departments/*`       | `/api/v2/departments/*`                          | ✅ Ready  | Hierarchie Support         |
| `/api/teams/*`             | `/api/v2/teams/*`                                | ✅ Ready  | Erweiterte Stats           |
| `/api/documents/*`         | `/api/v2/documents/*`                            | ✅ Ready  | Access Control Refactored (2025-01-11)  |
| `/api/blackboard/*`        | `/api/v2/blackboard/*`                           | ✅ Ready  | Priority Levels            |
| `/api/role-switch/*`       | `/api/v2/role-switch/*`                          | ✅ Ready  | Audit Logging              |
| `/api/kvp/*`               | `/api/v2/kvp/*`                                  | ✅ Ready  | ROI Tracking               |
| `/api/shifts/*`            | `/api/v2/shifts/*`                               | ✅ Ready  | Template System            |
| `/api/surveys/*`           | `/api/v2/surveys/*`                              | ✅ Ready  | Anonyme Responses          |
| `/api/admin/*`             | `/api/v2/root/*` + `/api/v2/admin-permissions/*` | ✅ Ready  | Aufgeteilt                 |
| `/api/plans/*`             | `/api/v2/plans/*`                                | ✅ Ready  | Erweiterte Pricing         |
| `/api/machines/*`          | `/api/v2/machines/*`                             | ✅ Ready  | Wartungshistorie           |
| `/api/logs/*`              | `/api/v2/logs/*`                                 | ✅ Ready  | Filterung verbessert       |
| `/api/features/*`          | `/api/v2/features/*`                             | ✅ Ready  | Usage Tracking             |
| `/api/areas/*`             | `/api/v2/areas/*`                                | ✅ Ready  | Location Management        |
| `/api/department-groups/*` | `/api/v2/department-groups/*`                    | ✅ Ready  | Neue API                   |
| `/api/signup/*`            | `/api/v2/signup/*`                               | ✅ Ready  | Erweiterte Validierung     |
| `/api/availability/*`      | MERGED → `/api/v2/shifts/*`                      | ✅ Merged | In Shifts integriert       |
| `/api/employee/*`          | DEPRECATED                                       | ❌        | Nur Views, kein Mehrwert   |
| `/api/unsubscribe/*`       | DEPRECATED                                       | ❌        | Simple Update Operation    |

## 🎯 Migration Strategy

### ⚡ Quick Start: Erste API in 30 Minuten migrieren

**Ziel:** Auth API als erste API sicher migrieren und testen

```bash
# 1. Feature Flag für Auth aktivieren (NUR Auth!)
echo "window.FEATURE_FLAGS = { USE_API_V2_AUTH: true };" > frontend/public/feature-flags.js

# 2. Auth Migration testen
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}'

# 3. Bei Erfolg: Frontend Code anpassen (siehe unten)
# 4. Bei Fehler: Feature Flag deaktivieren
```

### Phase 1: Frontend Preparation (1 Woche)

**Ziel:** Frontend für parallelen Betrieb vorbereiten

#### 1.1 API Client Wrapper erstellen (VEREINFACHT!)

```typescript
// frontend/src/utils/api-client.ts
class ApiClient {
  private version: 'v1' | 'v2' = 'v1'; // START MIT v1!

  async fetch(endpoint: string, options?: RequestInit) {
    // Feature Flag Check
    const featureKey = `USE_API_V2_${endpoint.split('/')[1]?.toUpperCase()}`;
    if (window.FEATURE_FLAGS?.[featureKey]) {
      this.version = 'v2';
    }

    const baseUrl = this.version === 'v2' ? '/api/v2' : '/api';
    const url = `${baseUrl}${endpoint}`;

    // v1 nutzt Cookies, v2 nutzt Bearer Token
    const headers = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.version === 'v2') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: this.version === 'v1' ? 'include' : 'omit',
    });

    // Error Handling mit Fallback
    if (!response.ok && this.version === 'v2') {
      console.error('v2 API failed, falling back to v1');
      this.version = 'v1';
      return this.fetch(endpoint, options); // Retry mit v1
    }

    const data = await response.json();

    if (this.version === 'v2') {
      if (!data.success) {
        throw new Error(data.error?.message || 'API Error');
      }
      return data.data;
    }

    return data;
  }
}

export const apiClient = new ApiClient();
```

#### 1.2 Feature Flags implementieren (EINFACHER!)

```html
<!-- frontend/public/index.html -->
<script src="/feature-flags.js"></script>
```

```javascript
// frontend/public/feature-flags.js (wird NICHT eingecheckt!)
window.FEATURE_FLAGS = {
  USE_API_V2_AUTH: false, // Phase 1: Als erstes aktivieren
  USE_API_V2_USERS: false, // Phase 1: Nach Auth
  USE_API_V2_DOCUMENTS: false, // Phase 1: Nach Users
  USE_API_V2_BLACKBOARD: false, // Phase 1: Nach Documents

  USE_API_V2_CALENDAR: false, // Phase 2
  USE_API_V2_CHAT: false, // Phase 2
  USE_API_V2_SHIFTS: false, // Phase 2
  USE_API_V2_KVP: false, // Phase 2

  // Weitere APIs...
};
```

#### 1.3 Response Adapter Pattern (NUR WENN NÖTIG!)

```typescript
// frontend/src/utils/response-adapter.ts
class ResponseAdapter {
  // Nur für APIs die wirklich Mapping brauchen
  static adaptUserResponse(v1Data: any): any {
    return {
      id: v1Data.id,
      firstName: v1Data.first_name || v1Data.firstName,
      lastName: v1Data.last_name || v1Data.lastName,
      email: v1Data.email,
      role: v1Data.role,
      // Nur die Felder mappen die wirklich anders sind!
    };
  }
}
```

### Phase 2: Schrittweise Migration

**Strategie:** Eine API nach der anderen migrieren

#### Migration Reihenfolge (NEUE STRATEGIE!)

**PHASE 1: Signup (Tag 1)**

```bash
# ZUERST Signup testen - neue Tenants müssen funktionieren!
# 1. signup.html anpassen
# 2. Test: Neuen Tenant registrieren
# 3. Verifizieren: Tenant wurde in DB erstellt
```

**PHASE 2: Auth & Infrastructure (Tag 2-3)**

```typescript
// REIHENFOLGE WICHTIG:
// 1. api.service.ts - Zentrale API Logic
// 2. common.ts - Shared Functions
// 3. auth.ts - Login/Logout
// 4. login.html - Login Page
// auth.ts Beispiel:
import { apiClient } from './api-service';

// NEUE zentrale API

export async function login(email: string, password: string) {
  // Feature Flag Check entfernt - wir migrieren ALLES
  const response = await apiClient.post('/auth/login', {
    email,
    password,
  });

  // v2 Response - Tokens speichern
  localStorage.setItem('accessToken', response.accessToken);
  localStorage.setItem('refreshToken', response.refreshToken);
  localStorage.setItem('user', JSON.stringify(response.user));

  return response;
}

// SCHRITT 3: Logout anpassen
export async function logout() {
  try {
    await apiClient.fetch('/auth/logout', { method: 'POST' });

    if (window.FEATURE_FLAGS?.USE_API_V2_AUTH) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }

    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
    // Trotzdem ausloggen
    window.location.href = '/login';
  }
}
```

**PHASE 3: Post-Login UI (Tag 4)**

```typescript
// Diese MÜSSEN nach Auth migriert werden:
// 1. header-user-info.ts - User Info anzeigen
// 2. unified-navigation.ts - Navigation
// 3. role-switch.ts - Rollenwechsel

// WICHTIG: Testen nach Migration:
// - Wird User Name im Header angezeigt?
// - Funktioniert die Navigation?
// - Kann zwischen Admin/Employee gewechselt werden?
```

**PHASE 4: Dashboards (Tag 5-6)**

```typescript
// Reihenfolge:
// 1. index.html - Haupt-Landing
// 2. employee-dashboard.ts/html - Mitarbeiter
// 3. admin-dashboard.ts/html - Admins
// 4. root-dashboard.ts/html - Root User

// Nach Migration testen:
// - Lädt das richtige Dashboard basierend auf Rolle?
// - Werden alle Widgets/Stats angezeigt?
// - Keine 401 Errors?
```

**PHASE 5: Core Features (Tag 7-10)**

```typescript
// Priorität nach Nutzung:
// 1. Documents (upload/download)
// 2. Blackboard (Ankündigungen)
// 3. Calendar (Termine)
// 4. Chat (Kommunikation)
// 5. Shifts (Schichtplanung)

// WICHTIG: Jedes Feature einzeln testen!
```

### Phase 3: Testing & Stabilization

#### 3.1 Test-Driven Migration Approach

**WICHTIG:** Teste JEDE API einzeln bevor du zur nächsten gehst!

```bash
# Test Script für jede API Migration
#!/bin/bash
# test-api-migration.sh

API_NAME=$1
echo "Testing $API_NAME API migration..."

# 1. Feature Flag aktivieren
echo "window.FEATURE_FLAGS.USE_API_V2_${API_NAME^^} = true;" >> frontend/public/feature-flags.js

# 2. Backend Health Check
curl -s http://localhost:3000/api/v2/$API_NAME/health || echo "No health endpoint"

# 3. Frontend Test
npm run test -- --testNamePattern="$API_NAME"

# 4. Manual Test Checklist
echo "
MANUAL TEST CHECKLIST für $API_NAME:
[ ] Alle CRUD Operationen funktionieren
[ ] Fehlerbehandlung funktioniert
[ ] Performance ist gleich oder besser
[ ] Keine Console Errors
[ ] Daten werden korrekt angezeigt
"
```

#### 3.2 Monitoring während Migration

```typescript
// frontend/src/utils/migration-monitor.ts
class MigrationMonitor {
  static logApiCall(endpoint: string, version: 'v1' | 'v2', success: boolean, responseTime: number) {
    const stats = JSON.parse(localStorage.getItem('migrationStats') || '{}');

    if (!stats[endpoint]) {
      stats[endpoint] = { v1: { calls: 0, errors: 0, avgTime: 0 }, v2: { calls: 0, errors: 0, avgTime: 0 } };
    }

    const versionStats = stats[endpoint][version];
    versionStats.calls++;
    if (!success) versionStats.errors++;
    versionStats.avgTime = (versionStats.avgTime * (versionStats.calls - 1) + responseTime) / versionStats.calls;

    localStorage.setItem('migrationStats', JSON.stringify(stats));

    // Alert bei hoher Fehlerrate
    const errorRate = versionStats.errors / versionStats.calls;
    if (errorRate > 0.05 && versionStats.calls > 10) {
      console.error(`HIGH ERROR RATE for ${endpoint} ${version}: ${(errorRate * 100).toFixed(1)}%`);
    }
  }

  static getReport() {
    const stats = JSON.parse(localStorage.getItem('migrationStats') || '{}');
    console.table(stats);
    return stats;
  }
}
```

### Phase 4: Rollout & Deprecation

#### 4.1 Sicherer Rollout Plan

```javascript
// frontend/src/config/rollout.js
const ROLLOUT_CONFIG = {
  // Start mit einzelnen Test-Usern
  testUsers: ['admin@test.com', 'developer@test.com'],

  // Dann Abteilungen
  departments: {
    IT: true, // IT zuerst
    HR: false, // HR später
    Production: false, // Production zuletzt
  },

  // Rollout Funktion
  shouldUseV2(userEmail, department) {
    // Test User? -> v2
    if (this.testUsers.includes(userEmail)) return true;

    // Department aktiviert? -> v2
    if (this.departments[department]) return true;

    // Sonst -> v1
    return false;
  },
};
```

#### 4.2 Notfall-Rollback

```javascript
// frontend/src/utils/emergency-rollback.js
function emergencyRollback() {
  // 1. Alle Feature Flags deaktivieren
  window.FEATURE_FLAGS = Object.keys(window.FEATURE_FLAGS).reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

  // 2. Tokens löschen
  localStorage.clear();

  // 3. Seite neu laden
  window.location.reload();
}

// Global verfügbar machen
window.emergencyRollback = emergencyRollback;
```

## 📋 Breaking Changes & Migration Guide

### 1. Authentication

```javascript
// v1
fetch('/api/auth/login', {
  credentials: 'include',
  // Cookie-based auth
});

// v2
fetch('/api/v2/auth/login', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### 2. Response Format

```javascript
// v1
{
  "users": [...],
  "total": 100
}

// v2
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "pageSize": 20
    }
  }
}
```

### 3. Field Naming

```javascript
// v1 (snake_case)
{
  "user_id": 1,
  "first_name": "John",
  "created_at": "2025-01-01"
}

// v2 (camelCase)
{
  "userId": 1,
  "firstName": "John",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### 4. Error Handling

```javascript
// v1
if (response.status !== 200) {
  // handle error
}

// v2
const data = await response.json();
if (!data.success) {
  handleError(data.error);
}
```

### 5. Documents API - Access Control Refactoring (2025-01-11)

**CRITICAL: Complete access control system redesign!**

```javascript
// v1 (OLD - AMBIGUOUS)
{
  "recipientType": "user",      // Unclear: user/team/department/company
  "userId": 123,                 // Unclear purpose
  "teamId": 456,                 // Unclear purpose
  "departmentId": 789,           // Unclear purpose
  "year": 2025,                  // Only for payroll
  "month": "1"                   // Only for payroll (string!)
}

// v2 (NEW - SEMANTIC & CLEAN)
{
  "accessScope": "personal",     // WHO can see: personal/team/department/company/payroll
  "ownerUserId": 123,            // CLEAR: Who owns this (for personal/payroll)
  "targetTeamId": 456,           // CLEAR: Which team (for team documents)
  "targetDepartmentId": 789,     // CLEAR: Which department (for department documents)
  "salaryYear": 2025,            // CLEAR: Salary year (for payroll, integer)
  "salaryMonth": 1               // CLEAR: Salary month 1-12 (for payroll, integer)
}
```

**Upload Request Changes:**

```javascript
// v1 Upload
const formData = new FormData();
formData.append('document', file);
formData.append('recipientType', 'user');
formData.append('userId', '123');
formData.append('category', 'general');

// v2 Upload
const formData = new FormData();
formData.append('document', file);
formData.append('accessScope', 'personal');  // Direct mapping!
formData.append('ownerUserId', '123');       // Semantic name
formData.append('category', 'general');
```

**Frontend Sidebar Filtering:**

```javascript
// v1 (BROKEN - Required complex mapping)
const categoryMap = { user: 'personal', team: 'team', ... };
if (category === 'payroll') {
  return doc.category.includes('gehalt');  // String matching = fragile!
}
return categoryMap[doc.recipientType] === category;

// v2 (PERFECT - Direct 1:1 mapping)
if (category === 'all') return true;
return doc.accessScope === category;  // Direct comparison!
```

**Migration Impact:**
- ✅ Zero translation layers - Direct 1:1 mapping
- ✅ Self-documenting field names
- ✅ Type-safe with TypeScript enums
- ✅ Payroll is first-class citizen (not string matching hack)
- ⚠️ **Breaking:** All upload forms must use new field names
- ⚠️ **Breaking:** Sidebar filtering logic completely changed

## 🛡️ Risk Management & Rollback Strategy

### Rollback Triggers

1. **Error Rate > 5%** → Immediate Rollback
2. **Response Time > 2x v1** → Performance Review
3. **Critical Bug in Production** → Feature Flag Disable
4. **User Complaints > 10** → Evaluation Meeting

### Rollback Plan

```javascript
// Quick Rollback via Feature Flags
const EMERGENCY_ROLLBACK = {
  USE_API_V2: false,
  REDIRECT_TO_V1: true,
  SHOW_MAINTENANCE_MESSAGE: true,
};
```

### Backup Strategy

1. **Database Snapshots** vor jeder Migration Phase
2. **v1 API Code** in separatem Branch behalten
3. **Config Backups** für schnelles Rollback
4. **User Session Backup** für Auth Migration

## 📊 Success Metrics

### Technical Metrics

- **API Response Time:** < 200ms (p95)
- **Error Rate:** < 0.1%
- **Uptime:** 99.9%
- **Test Coverage:** > 80%

### Business Metrics

- **User Satisfaction:** > 90%
- **Support Tickets:** < 5 per day
- **Feature Adoption:** > 80% in 4 weeks
- **Performance Improvement:** > 20%

## 🗓️ Migration Phasen

| Phase       | Fokus                  | APIs                               | Status          |
| ----------- | ---------------------- | ---------------------------------- | --------------- |
| **Phase 1** | Authentication & Core  | Auth, Users, Documents, Blackboard | 🔄 Start hier   |
| **Phase 2** | Business Features      | Calendar, Chat, Shifts, KVP        | 📅 Nach Phase 1 |
| **Phase 3** | Admin & Reports        | Admin, Reports, Audit Trail        | 📋 Nach Phase 2 |
| **Phase 4** | Cleanup & Optimization | Alle APIs final                    | 🎯 Abschluss    |

## 🔧 Technical Requirements

### Frontend Changes Needed

1. **API Client Library** - Zentrale API Verwaltung
2. **Token Management** - JWT Storage & Refresh
3. **Error Handling** - Standardisierte Error Messages
4. **Loading States** - Konsistente UX
5. **Type Definitions** - TypeScript Interfaces für v2

### Backend Preparations

1. **Rate Limiting** - DDoS Protection
2. **Caching Layer** - Redis Integration
3. **Monitoring** - Prometheus/Grafana
4. **Logging** - Structured Logging
5. **Documentation** - OpenAPI Updates

## 🚨 Critical Path Items

1. ✅ **Documents API Refactoring** - COMPLETED 2025-01-11 (Access control system redesigned)
2. **JWT Token Migration** - Höchste Priorität
3. **WebSocket Upgrade** - Chat Functionality
4. **File Upload Changes** - Documents API (⚠️ Updated for new accessScope fields)
5. **Multi-Tenant Validation** - Security Critical
6. **Performance Testing** - Before Go-Live

**Documents API Update (2025-01-11):**
- Database: Old columns removed, new semantic columns added
- Backend: 4 layers refactored (Model, Service, Controller, Validation)
- Frontend: 5 modules refactored (Types, Upload, API, State, Sidebar)
- Build: Zero TypeScript errors
- Status: Code complete, manual testing in progress

## 📞 Support & Communication

### Internal Communication

- **Slack Channel:** #api-v2-migration
- **Daily Standup:** 09:00 Uhr
- **Weekly Review:** Freitags 15:00 Uhr

### User Communication

- **Email Campaign:** 2 Wochen vor Rollout
- **In-App Notifications:** 1 Woche vor Rollout
- **Help Center Articles:** Already prepared
- **Video Tutorials:** In production

## ✅ Pre-Migration Checklist

- [ ] Frontend API Client implementiert
- [ ] Feature Flags konfiguriert
- [ ] Response Adapter erstellt
- [ ] Token Management ready
- [ ] Error Handling standardisiert
- [ ] E2E Tests geschrieben
- [ ] Performance Baseline gemessen
- [ ] Rollback Plan getestet
- [ ] Monitoring Dashboard erstellt
- [ ] Documentation aktualisiert
- [ ] Team Training abgeschlossen
- [ ] User Communication vorbereitet

## 🚀 Quick Start Guide

### Tag 1: Setup & Erste Migration

```bash
# 1. Frontend vorbereiten
cd frontend
mkdir -p src/utils
# Kopiere api-client.ts aus diesem Dokument

# 2. Feature Flags erstellen
echo 'window.FEATURE_FLAGS = { USE_API_V2_AUTH: false };' > public/feature-flags.js

# 3. Auth API testen
# Terminal 1: Backend starten
cd /home/scs/projects/Assixx/docker && docker-compose up -d

# Terminal 2: Frontend starten
cd frontend && npm run dev

# 4. Feature Flag aktivieren
# Editiere public/feature-flags.js: USE_API_V2_AUTH: true

# 5. Browser Test
# - Login funktioniert?
# - Token in localStorage?
# - Geschützte Seiten erreichbar?
```

### Häufige Probleme & Lösungen

**Problem 1: "401 Unauthorized" nach Login**

```javascript
// Lösung: Token wird nicht mitgesendet
// Prüfe in Network Tab: Authorization Header vorhanden?
// Prüfe localStorage: accessToken gespeichert?
```

**Problem 2: "CORS Error"**

```javascript
// Lösung: credentials Policy prüfen
// v1: credentials: 'include' (Cookies)
// v2: credentials: 'omit' (Bearer Token)
```

**Problem 3: "Cannot read property 'data' of undefined"**

```javascript
// Lösung: Response Format prüfen
// v1: response = { users: [...] }
// v2: response = { success: true, data: { users: [...] } }
```

## 🎯 Next Steps

1. **Quick Win:** Auth API in 30 Minuten migrieren
2. **Test:** Mit 2-3 Test Usern validieren
3. **Expand:** Users API als nächstes
4. **Monitor:** Migration Stats im Browser prüfen

---

**Document Version:** 2.0  
**Last Updated:** 03.08.2025  
**Author:** API v2 Migration Team  
**Status:** READY FOR IMPLEMENTATION
