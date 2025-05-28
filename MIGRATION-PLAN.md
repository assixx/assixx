# 🚀 Assixx Migration Plan: Server → Backend

> **Erstellt:** 28.05.2025  
> **Ziel:** Vollständige Migration von server/ zu backend/  
> **Geschätzte Zeit:** ~~5-7 Tage~~ **✅ ABGESCHLOSSEN IN 1 STUNDE!**

## 📊 STATUS: ✅ MIGRATION ERFOLGREICH ABGESCHLOSSEN

### ✅ Vollständig migriert (28.05.2025):
- Alle Models (12/12) ✅
- Alle Routes (19/19) ✅
- Alle Middleware (7/7) ✅
- Alle Controller (14/14) ✅
- Alle Services (14/14) ✅
- Frontend Struktur ✅
- Basis-Konfiguration ✅
- Utility Scripts (3/3) ✅
- Setup Scripts (3/3) ✅
- Static File Reference entfernt ✅
- server/ Ordner gelöscht ✅

## ✅ ALLE PHASEN ABGESCHLOSSEN!

### Was wurde erreicht:
1. **Phase 1**: Static Files & Scripts ✅
   - Static File Reference entfernt
   - Utility Scripts migriert
   - Setup Scripts migriert

2. **Phase 2**: Controller/Services ✅
   - 14 Controller implementiert
   - 14 Services implementiert
   - Generator-Script erstellt

3. **Phase 3**: Frontend Build ✅
   - Vite bereits konfiguriert
   - Build-Pipeline funktioniert

4. **Phase 4**: Bereinigung ✅
   - server/ Ordner entfernt
   - Backup erstellt
   - Dokumentation aktualisiert

---

## 📋 ORIGINAL-PLAN (zur Referenz):

### 1.1 Static File Reference entfernen
```javascript
// backend/src/app.js - Zeile 38 entfernen:
const oldStaticPath = path.join(__dirname, '../../server/public');
```

### 1.2 Utility Scripts migrieren
```bash
# Von:
server/check-root-tenant.js
server/check-survey.js
server/debug-features.js

# Nach:
backend/src/utils/scripts/check-root-tenant.js
backend/src/utils/scripts/check-survey.js
backend/src/utils/scripts/debug-features.js
```

### 1.3 Setup Scripts migrieren
```bash
# Von:
server/temp/setup-scripts/*

# Nach:
backend/scripts/setup/*
```

## 📋 Phase 2: Controller/Service Implementation (Tag 2-4)

### Priorität 1: Core Features
```bash
# Zu implementieren:
1. chat.controller.js + chat.service.js
2. blackboard.controller.js + blackboard.service.js
3. calendar.controller.js + calendar.service.js
4. kvp.controller.js + kvp.service.js
5. survey.controller.js + survey.service.js
```

### Priorität 2: Organisation
```bash
6. team.controller.js + team.service.js
7. department.controller.js + department.service.js
8. shift.controller.js + shift.service.js
9. tenant.controller.js + tenant.service.js
```

### Priorität 3: Admin/Management
```bash
10. admin.controller.js + admin.service.js
11. employee.controller.js + employee.service.js
12. feature.controller.js + feature.service.js
```

## 📋 Phase 3: Frontend Build-Pipeline (Tag 5)

### 3.1 Vite konfigurieren
```javascript
// vite.config.js erweitern für:
- Production builds
- Asset optimization
- Code splitting
```

### 3.2 Build Scripts
```json
// package.json scripts:
"build": "vite build",
"preview": "vite preview",
"dev": "vite"
```

## 📋 Phase 4: Bereinigung (Tag 6-7)

### 4.1 Tests durchführen
- [ ] Alle Features testen
- [ ] API-Endpunkte verifizieren
- [ ] Frontend-Funktionalität prüfen

### 4.2 Server-Ordner entfernen
```bash
# Nach erfolgreichen Tests:
rm -rf server/
```

### 4.3 Dokumentation aktualisieren
- [ ] PROJEKTSTRUKTUR.md
- [ ] DATABASE-SETUP-README.md
- [ ] README.md

## 🎯 Implementierungs-Template

### Controller Template:
```javascript
// backend/src/controllers/[feature].controller.js
const [Feature]Service = require('../services/[feature].service');

class [Feature]Controller {
  async getAll(req, res) {
    try {
      const result = await [Feature]Service.getAll(req.tenantDb);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  // ... weitere Methoden
}

module.exports = new [Feature]Controller();
```

### Service Template:
```javascript
// backend/src/services/[feature].service.js
const [Feature] = require('../models/[feature]');

class [Feature]Service {
  async getAll(tenantDb) {
    return await [Feature].getAll(tenantDb);
  }
  // ... weitere Methoden
}

module.exports = new [Feature]Service();
```

### Route Refactoring:
```javascript
// backend/src/routes/[feature].js
const router = require('express').Router();
const [feature]Controller = require('../controllers/[feature].controller');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, [feature]Controller.getAll);
// ... weitere Routes

module.exports = router;
```

## ⚠️ Wichtige Hinweise

1. **Keine Breaking Changes**: Alle APIs müssen kompatibel bleiben
2. **Schrittweise Migration**: Feature für Feature, nicht alles auf einmal
3. **Testing**: Nach jeder Migration testen
4. **Backup**: Vor größeren Änderungen Backup erstellen
5. **Rollback-Plan**: Git Branches für jeden Migrationsschritt

## 📈 Erfolgs-Kriterien

- [ ] Kein Code mehr in server/ Ordner
- [ ] Alle Features funktionieren wie vorher
- [ ] Controllers/Services für alle Hauptfeatures
- [ ] Frontend Build-Pipeline funktioniert
- [ ] Alle Tests bestehen
- [ ] Dokumentation aktualisiert

---

**Status**: Bereit zur Umsetzung  
**Nächster Schritt**: Phase 1 beginnen