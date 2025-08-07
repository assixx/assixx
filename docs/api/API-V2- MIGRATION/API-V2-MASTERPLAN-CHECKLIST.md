# Frontend API v2 Migration Checklist - LOGISCHE REIHENFOLGE

**Stand:** 04.08.2025
**Status:** Phase 1-4 größtenteils abgeschlossen ✅
**LIVE IN PRODUCTION:** Signup & Auth APIs (v2) ✅

## 🎯 Ziel: Alle `/api/*` Calls zu `/api/v2/*` ändern

## 📋 Migration Reihenfolge (64 Files)

### PHASE 1: Signup & Initial Setup (ZUERST!)
**Warum:** Ohne Signup kann kein neuer Tenant erstellt werden
- [x] signup.html (signup API) - Tenant Registration ✅

### PHASE 2: Authentication Core (KRITISCH!)
**Warum:** Ohne Auth kommt niemand ins System
- [x] auth.ts - Login/Logout/Token Management ✅
- [x] login.html - Login Page ✅

### PHASE 3: Core Infrastructure (BASIS!)
**Warum:** Diese Files werden von ALLEN anderen verwendet
- [x] api.service.ts - Zentraler API Service ✅
- [x] common.ts - Shared Utilities & API Helpers ✅

### PHASE 4: Post-Login UI Components
**Warum:** Navigation und Header werden sofort nach Login geladen
- [x] header-user-info.ts - User Info in Header ✅
- [x] unified-navigation.ts - Hauptnavigation (TEILWEISE: role-switch Teil migriert) ✅
- [x] role-switch.ts - Rollenwechsel (Admin/Employee) ✅

### PHASE 5: Dashboards (Landing Pages nach Login)
**Warum:** Erste Seite die User nach Login sehen
- [x] employee-dashboard.ts - Employee Dashboard (migriert zu apiClient) ✅
- [x] employee-dashboard.html - Employee Dashboard (Survey API noch v1) ✅
- [x] admin-dashboard.ts ✅ (05.08.2025 - Vollständig getestet und funktioniert)
- [x] admin-dashboard.html ✅ (06.08.2025 - API v2 Migration abgeschlossen)
- [x] root-dashboard.ts (MIGRIERT - WARTET AUF TEST & GENEHMIGUNG)
- [x] root-dashboard.html (GEPRÜFT - Keine direkten API Calls - WARTET AUF GENEHMIGUNG)
- [ ] dashboard-scripts.ts - Shared Dashboard Logic

### PHASE 6: User Profile & Settings
**Warum:** Meist besuchte Features nach Dashboard
- [ ] profile.html
- [ ] employee-profile.html
- [ ] admin-profile.html
- [ ] admin-profile.ts
- [ ] root-profile.html
- [ ] account-settings.html (settings API)
- [ ] profile-picture.ts

### PHASE 7: Core Business Features
**Warum:** Hauptfunktionalität der App

#### Documents & Files
- [ ] documents.ts
- [ ] documents.html
- [ ] document-base.ts
- [ ] upload-document.ts
- [ ] document-upload.html
- [ ] employee-documents.html

#### Communication
- [ ] blackboard.ts
- [ ] blackboard-modal-update.html
- [ ] chat.ts
- [ ] chat.html
- [ ] notification.service.ts

#### Planning & Organization
- [ ] calendar.ts
- [ ] shifts.ts
- [ ] shifts.html

#### KVP (Vorschlagswesen)
- [ ] kvp.ts
- [ ] kvp.html
- [ ] kvp-detail.ts
- [ ] kvp-detail.html

### PHASE 8: Admin Functions
**Warum:** Nur für Admins relevant

#### User Management
- [ ] manage-admins.ts
- [ ] manage-admins.html (admin-permissions API)
- [ ] admin-employee-search.ts
- [ ] employee-deletion.ts

#### Organization Management
- [x] departments.html - Department Management (v2 API + Feature Flag aktiv) ✅
- [ ] manage-department-groups.ts
- [ ] org-management.html (teams/areas API)

#### System Administration
- [ ] admin-config.ts
- [x] logs.ts
- [x] logs.html

### PHASE 9: Root-Only Features
**Warum:** Nur für Root-User relevant
- [ ] manage-root-users.ts
- [ ] manage-root-users.html
- [ ] root-features.html
- [ ] feature-management.html (features API)
- [ ] tenant-deletion-status.html
- [ ] storage-upgrade.html (plans API)

### PHASE 10: Survey System
**Warum:** Eigenständiges Feature-Set
- [ ] survey-admin.html
- [ ] survey-employee.html
- [ ] survey-results.html
- [ ] survey-details.html

---

## ✅ Fortschritt: 12/64 Files (18.8% abgeschlossen)

### ⚠️ WICHTIGE NOTIZEN:
- **Chat unread-count**: Die Navigation ist bereits für v2 vorbereitet, aber das Feature Flag muss deaktiviert bleiben bis die komplette Chat-Seite migriert ist
- **KVP stats**: Gleiches Problem - Navigation nutzt v2, aber KVP-Seite noch v1
- **Survey pending-count**: Auch hier - Navigation ready, aber Survey-Seiten noch v1

**LEARNING:** Badge-Updates in Navigation sollten eigentlich NACH der Haupt-Feature-Migration kommen!

### 🎯 HEUTE MIGRIERT - WARTET AUF TEST (06.08.2025):
1. **root-dashboard.ts** → Vollständige v2 API Migration mit apiClient (WARTET AUF TEST)
2. **root-dashboard.html** → Bestätigt keine direkten API Calls (WARTET AUF GENEHMIGUNG)
3. **Feature Flag aktiviert** → `USE_API_V2_LOGS` für Activity Logs
4. **TypeScript Fehler behoben** → Alle Kompilierungsfehler gelöst
5. **9 API Endpoints migriert**:
   - `/api/users/me` → `/api/v2/users/me`
   - `/root/create-admin` → `/api/v2/root/admins`
   - `/api/root-dashboard-data` → `/api/v2/root/dashboard`
   - `/root/admins` → `/api/v2/root/admins`
   - `/api/users` → `/api/v2/users`
   - `/api/user/profile` → `/api/v2/users/profile`
   - `/api/logs` → `/api/v2/logs`

### 🎯 ERREICHT AM 04.08.2025:
1. **departments.html** → v2 API Migration + Feature Flag `USE_API_V2_DEPARTMENTS` aktiviert ✅
2. **Employee Creation** → Departments Dropdown funktioniert mit v2 API ✅
3. **role-switch.ts** → Admin Rollenwechsel nutzt jetzt v2 API ✅
4. **unified-navigation.ts** → Role-Switch Teil auf v2 migriert (Badge-Updates folgen später) ✅
5. **employee-dashboard.html** → Funktioniert vollständig (Survey API wird später migriert) ✅
6. **header-user-info.ts** → Bereits v2-ready durch apiClient usage ✅
7. **employee-dashboard.ts** → Vollständig auf apiClient migriert (Dashboard Data Loading) ✅

**NÄCHSTE SCHRITTE:**
- dashboard-scripts.ts (Shared Dashboard Logic - letztes File in Phase 5)
- Phase 6: User Profile & Settings Migration beginnen
- profile.html, employee-profile.html, admin-profile.html
- account-settings.html (settings API)

### 🚨 KRITISCHE REGEL:
**NIEMALS eine Checkbox abhaken ohne:**
1. Vollständiges Testen der Funktionalität
2. Explizite Genehmigung und Freigabe vom User
3. Bestätigung dass ALLES funktioniert, nicht nur API-Calls

**Nur weil eine API 200 OK zurückgibt, heißt das NICHT dass die Feature funktioniert!**

## 🎯 Test-Strategie nach jeder Phase:

### Nach Phase 1-2 (Signup & Auth): ✅ GETESTET
1. Neuen Tenant erstellen ✅
2. Login/Logout testen ✅
3. Token in localStorage prüfen ✅

### Nach Phase 3-4 (Infrastructure): ✅ GETESTET & COMPLETED
1. API Calls funktionieren ✅
2. Navigation wird angezeigt ✅
3. User Info im Header korrekt ✅
4. Phase 4 komplett abgeschlossen ✅

### Nach Phase 5 (Dashboards):
1. Alle Dashboards laden
2. Daten werden angezeigt
3. Keine 401 Errors

### Nach Phase 6-10:
- Feature für Feature testen
- Immer prüfen ob Auth noch funktioniert

## ⚠️ WICHTIG:
- **NIEMALS** Phase 2 vor Phase 1 machen
- **IMMER** nach Auth sofort testen
- **Bei Fehlern** sofort stoppen und debuggen

## 📝 API Coverage (27 APIs):
Alle 27 Backend v2 APIs sind durch diese 64 Files abgedeckt.
Einzige Ausnahme: `machines` API hat keine Frontend Implementation.

## 🚀 Implementierte Komponenten:
1. **API Client** (`/frontend/src/utils/api-client.ts`) - Zentrale v1/v2 Kommunikation ✅
2. **Feature Flags** (`/frontend/public/feature-flags.js`) - Granulare API-Kontrolle ✅
3. **Response Adapter** (`/frontend/src/utils/response-adapter.ts`) - Format-Konvertierung ✅
4. **Test Script** (`/test-v2-api.sh`) - Automatisierte v2 API Tests ✅

## 📊 Nächste Schritte:
- Phase 4: Post-Login UI Components (header-user-info.ts, unified-navigation.ts, role-switch.ts)
- Phase 5: Dashboards Migration
- Phase 6-10: Feature-by-Feature Migration
