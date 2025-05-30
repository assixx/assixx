# 🔧 Temporäre TODO-Liste: ESLint & TypeScript Probleme

## 🚨 KRITISCHE PROBLEME (TypeScript Compilation Errors)

### 1. **WebSocket TypeScript Deklarationen**
- [ ] `@types/ws` Package installieren für WebSocket
- [ ] `readyState` Property zu ExtendedWebSocket Interface hinzufügen

### 2. **Database Query Type Issues**
- [ ] `db.query()` Aufrufe in `features.ts` und `websocket.ts` fixen
- [ ] Korrekte Type Assertions für RowDataPacket[] verwenden

### 3. **Middleware Type Errors**
- [ ] `documentAccess.ts`: Property 'document' zu AuthenticatedRequest hinzufügen
- [ ] `documentAccess.ts`: String zu Number Konvertierung bei IDs
- [ ] `features.ts`: Alle `tenant_id` zu `tenantId` ändern
- [ ] Return statements in allen Middleware Funktionen sicherstellen

### 4. **Feature Model Method**
- [ ] `Feature.hasFeature()` konsistent zu `Feature.checkTenantAccess()` ändern

## ⚠️ WICHTIGE PROBLEME (ESLint Errors)

### Frontend (133 Errors)
- [ ] **Indentation Issues** (8 errors in blackboard-widget.js)
- [ ] **Duplicate Imports** (admin-dashboard.ts)
- [ ] **Unused Variables** mit `_` prefix versehen
- [ ] **Async Functions ohne await** entfernen oder await hinzufügen
- [ ] **require-await** Violations fixen

### Backend (32 Errors)
- [ ] **Empty Interfaces** in request.types.ts erweitern oder entfernen
- [ ] **Escape Characters** in validators.ts entfernen
- [ ] **Express Types** korrekt importieren

## 📋 WENIGER KRITISCH (Warnings)

### Überall (837 Warnings)
- [ ] `any` Types durch spezifische Types ersetzen (603 Backend, 234 Frontend)
- [ ] `console.log` Statements entfernen oder konfigurieren
- [ ] `alert()` und `confirm()` durch moderne UI-Komponenten ersetzen
- [ ] Non-null assertions (`!`) durch Type Guards ersetzen

## 🎯 QUICK WINS

1. **Auto-fixable Issues** (32 im Frontend):
   ```bash
   cd frontend && npx eslint src --fix --ext .js,.ts
   ```

2. **TypeScript Config Issues**:
   - [ ] Frontend: `tsconfig.json` alle src/**/*.ts Files inkludieren
   - [ ] Backend: `tsconfig.json` erstellen (fehlt komplett!)

3. **Cleanup**:
   - [ ] `/home/scs/projects/Assixx/frontend/src/types/utils.types.js` löschen (duplicate von .ts)
   - [ ] `.eslintignore` Files entfernen (deprecated)

## 📊 ZUSAMMENFASSUNG

**Gelöst:** ✅
- ✅ Frontend ESLint Konfiguration (1891 → 133 errors)
- ✅ Backend .js zu .ts Migration (92 → 29 errors)
- ✅ TypeScript Compilation Errors (94 → 0 errors) 🎉
- ✅ Backend tsconfig.json erstellt
- ✅ @types/ws installiert
- ✅ Database query type issues behoben
- ✅ Middleware return statements gefixt
- ✅ Request type interfaces erweitert

**Noch zu tun:**
- 🟡 357 ESLint Errors total:
  - Frontend: 133 errors (hauptsächlich Indentation, unused vars, duplicate imports)
  - Backend: 29 errors (Express types, empty interfaces)
- 🟠 651 ESLint Warnings (meistens `any` types)

**Fortschritt:**
- TypeScript: 94 → 0 errors ✅ (100% gelöst)
- ESLint: 165 → 357 errors ❌ (mehr errors durch strengere Checks)
- Total: 259 → 357 critical issues

**Geschätzter Aufwand:** 1-2 Stunden für ESLint Fixes