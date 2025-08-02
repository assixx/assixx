# Frontend API v2 Migration Checklist

## 🎯 Ziel: Alle `/api/*` Calls zu `/api/v2/*` ändern

## 📌 Backend v2 APIs (27 Total):
auth, users, calendar, chat, departments, teams, documents, blackboard, role-switch, kvp, shifts, surveys, notifications, settings, machines, logs, features, plans, areas, root, admin-permissions, reports, audit-trail, department-groups, roles, signup

### Core Scripts (WICHTIG - Zuerst!)
- [ ] auth.ts
- [ ] common.ts  
- [ ] header-user-info.ts

### Dashboard Scripts
- [ ] admin-dashboard.ts
- [ ] employee-dashboard.ts
- [ ] root-dashboard.ts
- [ ] dashboard-scripts.ts

### Feature Scripts  
- [ ] blackboard.ts
- [ ] calendar.ts
- [ ] chat.ts
- [ ] shifts.ts
- [ ] upload-document.ts
- [ ] profile-picture.ts

### Admin Scripts
- [ ] manage-admins.ts
- [ ] manage-department-groups.ts
- [ ] admin-profile.ts
- [ ] admin-config.ts
- [ ] admin-employee-search.ts
- [ ] manage-root-users.ts
- [ ] employee-deletion.ts
- [ ] logs.ts

### Component Scripts
- [ ] unified-navigation.ts
- [ ] role-switch.ts

### Service Scripts
- [ ] api.service.ts
- [ ] notification.service.ts (notifications API)

### Page Scripts (Vergessen!)
- [ ] kvp.ts
- [ ] kvp-detail.ts
- [ ] documents.ts
- [ ] document-base.ts

### HTML Files mit inline Scripts (Am Ende prüfen)
- [ ] login.html
- [ ] signup.html
- [ ] index.html
- [ ] profile.html
- [ ] admin-profile.html
- [ ] root-profile.html
- [ ] root-features.html (features API)
- [ ] root-dashboard.html (root API)
- [ ] admin-dashboard.html
- [ ] employee-dashboard.html
- [ ] document-upload.html
- [ ] documents.html (documents API)
- [ ] storage-upgrade.html (plans API)
- [ ] survey-admin.html (surveys API)
- [ ] survey-employee.html (surveys API)
- [ ] survey-results.html (surveys API)
- [ ] survey-details.html (surveys API)
- [ ] departments.html
- [ ] employee-documents.html
- [ ] feature-management.html (features API)
- [ ] org-management.html (teams/areas API)
- [ ] account-settings.html (settings API)
- [ ] employee-profile.html
- [ ] tenant-deletion-status.html (root API)
- [ ] manage-root-users.html (root API)
- [ ] manage-admins.html (admin-permissions API)
- [ ] kvp.html (kvp API)
- [ ] kvp-detail.html (kvp API)
- [ ] logs.html (logs API)
- [ ] shifts.html (shifts API)
- [ ] chat.html (chat API)
- [ ] blackboard-modal-update.html (blackboard API)

---

## ✅ Fertig: 0/65 Files

## ✅ API Coverage Check (alle 27 v2 APIs):
- ✅ admin-permissions → manage-admins.html, manage-admins.ts
- ✅ areas → org-management.html
- ⚠️ audit-trail → Wahrscheinlich in admin-dashboard.ts
- ✅ auth → auth.ts, login.html, signup.html
- ✅ blackboard → blackboard.ts, blackboard-modal-update.html
- ✅ calendar → calendar.ts
- ✅ chat → chat.ts, chat.html
- ✅ department-groups → manage-department-groups.ts
- ✅ departments → departments.html
- ✅ documents → documents.ts, documents.html, upload-document.ts, document-base.ts
- ✅ features → root-features.html, feature-management.html
- ✅ kvp → kvp.ts, kvp-detail.ts, kvp.html, kvp-detail.html
- ✅ logs → logs.ts, logs.html
- ⚠️ machines → KEINE Frontend Implementation gefunden!
- ✅ notifications → notification.service.ts
- ✅ plans → storage-upgrade.html
- ⚠️ reports → Wahrscheinlich in admin-dashboard.ts
- ✅ role-switch → role-switch.ts
- ✅ roles → role-switch.ts (gleiche Datei)
- ✅ root → root-dashboard.ts, root-dashboard.html, manage-root-users.html, tenant-deletion-status.html
- ✅ settings → account-settings.html
- ✅ shifts → shifts.ts, shifts.html
- ✅ signup → signup.html
- ✅ surveys → survey-admin.html, survey-employee.html, survey-results.html, survey-details.html
- ✅ teams → org-management.html
- ✅ users → viele Dateien (profile, employee-dashboard, etc.)

## 🚧 In Arbeit: -

## 📝 Notizen:
- 