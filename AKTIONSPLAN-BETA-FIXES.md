# 🚀 Aktionsplan für Beta-Test Vorbereitung

> **Stand:** 01.06.2025  
> **Bugs gefunden:** 29 (7 kritisch, 11 mittel, 11 klein)  
> **Neue Strategie:** Fokus auf Version 0.1.0 - Stabilität vor Features  
> **Ziel:** Stabiles System für ersten Beta-Test

## 📅 Zeitplan: 
- **Version 0.1.0:** 2-3 Wochen (Stabilisierung)
- **Version 1.0.0:** 4-5 Wochen (Features)

### PHASE 1: Version 0.1.0 - Stabilisierung (2-3 Wochen)

#### Erledigte Aufgaben ✅

1. **✅ BEHOBEN: Multi-Tenant Isolation**
   - Alle API-Endpoints mit tenant_id Filter versehen
   - Security-Audit durchgeführt
   - Tests für Multi-Tenant Isolation implementiert
   - **Status:** Vollständig behoben

2. **✅ ERLEDIGT: Docker Setup**
   - Docker-Compose für Entwicklung und Produktion
   - Automatisierte DB-Initialisierung
   - Health Checks implementiert
   - **Status:** Einsatzbereit

3. **✅ IMPLEMENTIERT: Backup System**
   - Automatische tägliche Backups
   - Backup-Strategie dokumentiert
   - Restore-Prozess getestet
   - **Status:** Funktionsfähig

#### Noch zu beheben: Kritische Bugs

1. **🔴 TypeScript Build-Prozess reparieren**
   - [ ] Frontend Build-Prozess prüfen (`npm run build`)
   - [ ] HTML-Imports von .ts auf kompilierte .js ändern
   - [ ] Vite-Konfiguration optimieren
   - **Geschätzt:** 4-6 Stunden

2. **🔴 Mitarbeiter-Erstellung API**
   - [ ] POST `/api/admin/employees` Route implementieren
   - [ ] Validierung & Error Handling
   - [ ] Integration mit Auth-System
   - [ ] Frontend-Integration testen
   - **Geschätzt:** 6-8 Stunden

3. **🔴 Fehlende API-Endpoints**
   - [ ] Schwarzes Brett API (`/api/blackboard`)
   - [ ] Dokumenten-Upload API (`/documents/upload`)
   - [ ] Multi-Tenant Endpoints (`/api/tenants`, `/api/features/status`)
   - **Geschätzt:** 8-10 Stunden

4. **🟡 JavaScript-Fehler beheben**
   - [ ] `showSection` Funktion implementieren/importieren
   - [ ] `openEntryForm` für Schwarzes Brett
   - [ ] getElementById Null-Checks
   - [ ] Session-Datum Parsing fixen
   - **Geschätzt:** 4-6 Stunden

#### Systematisches Testing & Bug-Fixing

5. **🧪 Funktionstest durchführen**
   - [ ] FUNKTIONSTEST.md systematisch durcharbeiten
   - [ ] Jeden gefundenen Bug dokumentieren in BUGS-GEFUNDEN.md
   - [ ] Bugs nach Priorität beheben
   - [ ] Nach jedem Fix erneut testen
   - **Geschätzt:** 2-3 Tage kontinuierlich

6. **🟡 Feature-Management stabilisieren**
   - [ ] Alle Features in DB registrieren
   - [ ] Feature-Aktivierung für neue Tenants
   - [ ] Survey-Feature standardmäßig aktivieren
   - [ ] Admin-Berechtigungen für KVP
   - **Geschätzt:** 6-8 Stunden

### PHASE 2: Nach Version 0.1.0 - Feature-Entwicklung (Version 1.0.0)

#### Deal-Breaker Features (Verschoben auf Phase 2)

1. **🌴 Urlaubsantrag-System** 
   - Komplettes Feature mit Genehmigungsworkflow
   - Mobile-optimiert für Mitarbeiter
   - **Zeitrahmen:** Woche 1 nach v0.1.0

2. **💰 Gehaltsabrechnung Upload**
   - Sichere Dokumentenverwaltung
   - Mitarbeiter-spezifische Zugriffsrechte
   - **Zeitrahmen:** Woche 1-2 nach v0.1.0

3. **🔧 TPM-System (Total Productive Maintenance)**
   - Wartungsplanung und -verfolgung
   - Maschinenverwaltung
   - **Zeitrahmen:** Woche 2-3 nach v0.1.0

4. **📱 Mobile/PWA Optimierung**
   - Progressive Web App Features
   - Offline-Funktionalität
   - Push-Benachrichtigungen
   - **Zeitrahmen:** Parallel zu anderen Features

#### Nice-to-Have Features

- Performance-Feintuning
- Erweiterte Reporting-Features
- Design-Perfektion
- Erweiterte Mobile Features

## 📊 Priorisierung für Version 0.1.0

### Must-Have für v0.1.0 (Stabilität)

- ✅ Multi-Tenant Security ✅ BEHOBEN
- ✅ Docker Setup ✅ ERLEDIGT
- ✅ Backup System ✅ IMPLEMENTIERT
- ⏳ Mitarbeiter erstellen können
- ⏳ Stabile Build-Pipeline
- ⏳ Core Features funktionsfähig
- ⏳ Alle kritischen Bugs behoben

### Should-Have für v0.1.0

- ⏳ Feature-Management stabilisiert
- ⏳ Alle APIs funktionsfähig
- ⏳ Basis-Tests durchgeführt

### Verschoben auf v1.0.0

- Deal-Breaker Features (Urlaub, Gehalt, TPM)
- Mobile/PWA Vollausbau
- Performance-Optimierung
- Design-Perfektion

## 🛠️ Technische Details

### 1. Multi-Tenant Fix (backend/src/services/document.service.ts)

```typescript
// Beispiel für tenant_id Filter
const documents = await db.query(
  'SELECT * FROM documents WHERE tenant_id = ? AND deleted_at IS NULL',
  [req.user.tenant_id]
);
```

### 2. Build-Fix (frontend/src/pages/\*.html)

```html
<!-- Alt (falsch): -->
<script type="module" src="/scripts/admin-dashboard.ts"></script>

<!-- Neu (korrekt): -->
<script type="module" src="/scripts/admin-dashboard.js"></script>
```

### 3. Mobile CSS (frontend/src/styles/base/responsive.css)

```css
/* Mobile-First Approach */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }
  .sidebar.active {
    transform: translateX(0);
  }
  .main-content {
    margin-left: 0;
  }
}
```

## 📈 Erfolgskriterien für Version 0.1.0

1. **Keine kritischen Bugs** (aktuell 3 von 7 behoben)
2. **Core Features stabil** (Login, Dashboard, Mitarbeiter)
3. **Alle Tests bestanden** (FUNKTIONSTEST.md)
4. **Build-Prozess funktioniert** (Frontend & Backend)
5. **Multi-Tenant sicher** ✅ BEREITS BEHOBEN

## 🚦 Go/No-Go Entscheidung für v0.1.0

**Version 0.1.0 Release wenn:**

- [ ] Alle kritischen Bugs behoben
- [ ] Mitarbeiter-Verwaltung funktioniert
- [ ] TypeScript Build stabil
- [ ] Systematische Tests durchgeführt
- [ ] 48h Stabilitätstest ohne Crashes

## 📞 Nächste Schritte

1. **Sofort beginnen mit:** TypeScript Build-Fix
2. **Dann:** Mitarbeiter-API implementieren
3. **Parallel:** Systematische Tests mit FUNKTIONSTEST.md
4. **Kontinuierlich:** Bugs dokumentieren und beheben

---

**Version 0.1.0 Timeline:** 2-3 Wochen (Stabilisierung)  
**Version 1.0.0 Timeline:** 4-5 Wochen (inkl. Features)  
**Empfohlenes Vorgehen:** Stabilität vor Features  
**Beta-Start möglich:** Nach v0.1.0 Release
