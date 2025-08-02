# Frontend API v2 Migration Checklist - LOGISCHE REIHENFOLGE

## 🎯 Ziel: Alle `/api/*` Calls zu `/api/v2/*` ändern

## 📋 Migration Reihenfolge (65 Files)

### PHASE 1: Signup & Initial Setup (ZUERST!)
**Warum:** Ohne Signup kann kein neuer Tenant erstellt werden
- [ ] signup.html (signup API) - Tenant Registration

### PHASE 2: Authentication Core (KRITISCH!)
**Warum:** Ohne Auth kommt niemand ins System
- [ ] auth.ts - Login/Logout/Token Management
- [ ] login.html - Login Page

### PHASE 3: Core Infrastructure (BASIS!)
**Warum:** Diese Files werden von ALLEN anderen verwendet
- [ ] api.service.ts - Zentraler API Service
- [ ] common.ts - Shared Utilities & API Helpers

### PHASE 4: Post-Login UI Components
**Warum:** Navigation und Header werden sofort nach Login geladen
- [ ] header-user-info.ts - User Info in Header
- [ ] unified-navigation.ts - Hauptnavigation
- [ ] role-switch.ts - Rollenwechsel (Admin/Employee)

### PHASE 5: Dashboards (Landing Pages nach Login)
**Warum:** Erste Seite die User nach Login sehen
- [ ] index.html - Main Landing
- [ ] employee-dashboard.ts
- [ ] employee-dashboard.html
- [ ] admin-dashboard.ts
- [ ] admin-dashboard.html
- [ ] root-dashboard.ts
- [ ] root-dashboard.html
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
- [ ] departments.html
- [ ] manage-department-groups.ts
- [ ] org-management.html (teams/areas API)

#### System Administration
- [ ] admin-config.ts
- [ ] logs.ts
- [ ] logs.html

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

## ✅ Fortschritt: 0/65 Files

## 🎯 Test-Strategie nach jeder Phase:

### Nach Phase 1-2 (Signup & Auth):
1. Neuen Tenant erstellen
2. Login/Logout testen
3. Token in localStorage prüfen

### Nach Phase 3-4 (Infrastructure):
1. API Calls funktionieren
2. Navigation wird angezeigt
3. User Info im Header korrekt

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
Alle 27 Backend v2 APIs sind durch diese 65 Files abgedeckt.
Einzige Ausnahme: `machines` API hat keine Frontend Implementation.