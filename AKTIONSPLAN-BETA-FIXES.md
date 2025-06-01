# 🚀 Aktionsplan für Beta-Test Vorbereitung

> **Stand:** 31.05.2025  
> **Bugs gefunden:** 29 (7 kritisch, 11 mittel, 11 klein)  
> **Ziel:** System bereit für Beta-Test mit 5-10 Industriefirmen

## 📅 Zeitplan: 2-3 Wochen bis Beta-Ready

### WOCHE 1: Kritische Bugs & Security (5-7 Tage)

#### Tag 1-2: Security & Stabilität

1. **🔴 KRITISCH: Multi-Tenant Isolation fixen**

   - [ ] `/api/admin/documents` - Tenant-Filter hinzufügen
   - [ ] Alle API-Endpoints auf tenant_id Filter prüfen
   - [ ] Security-Audit aller Endpoints
   - [ ] Tests für Multi-Tenant Isolation
   - **Geschätzt:** 8-12 Stunden

2. **🔴 TypeScript Build-Prozess reparieren**
   - [ ] Frontend Build-Prozess prüfen (`npm run build`)
   - [ ] HTML-Imports von .ts auf kompilierte .js ändern
   - [ ] Vite-Konfiguration optimieren
   - [ ] CI/CD für automatische Builds
   - **Geschätzt:** 4-6 Stunden

#### Tag 3-4: Core APIs implementieren

3. **🔴 Mitarbeiter-Erstellung API**

   - [ ] POST `/api/admin/employees` Route implementieren
   - [ ] Validierung & Error Handling
   - [ ] Integration mit Auth-System
   - [ ] Frontend-Integration testen
   - **Geschätzt:** 6-8 Stunden

4. **🔴 Fehlende API-Endpoints**
   - [ ] Schwarzes Brett API (`/api/blackboard`)
   - [ ] Dokumenten-Upload API (`/documents/upload`)
   - [ ] Multi-Tenant Endpoints (`/api/tenants`, `/api/features/status`)
   - **Geschätzt:** 8-10 Stunden

#### Tag 5-7: Frontend-Fixes

5. **🟡 JavaScript-Fehler beheben**
   - [ ] `showSection` Funktion implementieren/importieren
   - [ ] `openEntryForm` für Schwarzes Brett
   - [ ] getElementById Null-Checks
   - [ ] Session-Datum Parsing fixen
   - **Geschätzt:** 4-6 Stunden

### WOCHE 2: Features & Mobile (5-7 Tage)

#### Tag 8-10: Feature-System

6. **🟡 Feature-Management vervollständigen**
   - [ ] Alle Features in DB registrieren
   - [ ] Feature-Aktivierung für neue Tenants
   - [ ] Survey-Feature standardmäßig aktivieren
   - [ ] Admin-Berechtigungen für KVP
   - **Geschätzt:** 6-8 Stunden

#### Tag 11-14: Mobile Optimierung

7. **📱 Mobile-First Implementation**
   - [ ] Responsive Grid-System
   - [ ] Hamburger-Menü für Mobile
   - [ ] Touch-optimierte Buttons (min. 44px)
   - [ ] Viewport Meta-Tags
   - [ ] Critical Features mobile-ready:
     - Login/Logout
     - Dashboard
     - Schichtplan
     - Chat
     - KVP
   - **Geschätzt:** 10-15 Stunden

### WOCHE 3: Testing & Polish (3-5 Tage)

#### Tag 15-16: Integration Testing

8. **🧪 Vollständige Tests nach Fixes**
   - [ ] Alle 29 Bugs erneut testen
   - [ ] Chat mit mehreren Usern
   - [ ] KVP-Erstellung
   - [ ] Schichtplan mit Mitarbeitern
   - [ ] Survey-System
   - [ ] Dokumenten-Upload/Download
   - **Geschätzt:** 8 Stunden

#### Tag 17-18: Performance & UX

9. **⚡ Performance-Optimierung**

   - [ ] Chat-Polling auf 30 Sekunden
   - [ ] Frontend-Bundle-Size reduzieren
   - [ ] Lazy Loading für Routen
   - [ ] CDN für Assets
   - **Geschätzt:** 6 Stunden

10. **🎨 Design-Konsistenz**
    - [ ] Glassmorphismus überall anwenden
    - [ ] Navigation vereinheitlichen
    - [ ] Error-States designen
    - [ ] Loading-States hinzufügen
    - **Geschätzt:** 8 Stunden

## 📊 Priorisierung nach Impact

### Must-Have für Beta (Woche 1)

- ✅ Multi-Tenant Security
- ✅ Mitarbeiter erstellen können
- ✅ Stabile Build-Pipeline
- ✅ Core Features funktionsfähig

### Should-Have für Beta (Woche 2)

- ✅ Mobile-Ansicht (Basis)
- ✅ Feature-Management
- ✅ Alle APIs funktionsfähig

### Nice-to-Have (Nach Beta)

- Design-Perfektion
- Erweiterte Mobile Features
- Performance-Feintuning

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

## 📈 Erfolgskriterien

1. **Keine kritischen Bugs** (0 von 7)
2. **Core Features funktionieren** (100%)
3. **Mobile nutzbar** (Basis-Features)
4. **Performance** (< 2s Ladezeit)
5. **Multi-Tenant sicher** (isoliert)

## 🚦 Go/No-Go Entscheidung

**Beta-Start wenn:**

- [ ] Alle kritischen Bugs behoben
- [ ] Mitarbeiter-Verwaltung funktioniert
- [ ] Mobile-Ansicht nutzbar
- [ ] Security-Audit bestanden
- [ ] 24h Stabilitätstest ohne Crashes

## 📞 Nächste Schritte

1. **Sofort beginnen mit:** Multi-Tenant Security Fix
2. **Team-Meeting:** Aufgaben verteilen
3. **Daily Standup:** Fortschritt tracken
4. **Testing-Runden:** Nach jedem Fix

---

**Geschätzte Gesamtzeit:** 15-20 Arbeitstage  
**Empfohlenes Team:** 2-3 Entwickler  
**Beta-Start möglich:** Mitte Juni 2025
