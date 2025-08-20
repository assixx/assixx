# 🔄 Role-Switch System Analyse

> **Datum:** 10.07.2025  
> **Autor:** Claude AI  
> **Status:** Sicherheitsanalyse und Brainstorming

## 🎯 Aktuelle Situation

### Konzept verstanden

- **Root User** = IT-Admin der Firma (hat Signup gemacht)
- Root ist aber auch möglicherweise ein **Bereichsleiter** (Admin-Rolle)
- Root ist definitiv auch ein **Mitarbeiter** der Firma
- Das System erlaubt flexible Rollenwechsel für realistische Szenarien

### Aktuelle Implementierung

```
Root → Admin View ✅
Root → Employee View ✅
Admin → Employee View ✅
Und jeweils zurück ✅
```

## 🔍 Sicherheitsanalyse

### ✅ Was gut funktioniert

1. **Token-basierte Authentifizierung**
   - JWT enthält `role` (Original) und `activeRole` (aktuelle Ansicht)
   - `isRoleSwitched` Flag zeigt an, ob gewechselt wurde
   - Token läuft nach 8h ab (Standard SaaS)

2. **Audit Logging**
   - Alle Rollenwechsel werden in `admin_logs` protokolliert
   - Nachvollziehbar wer wann welche Rolle angenommen hat

3. **Permission Checks**
   - Nur Root/Admin können switchen
   - Rückkehr nur zur originalen Rolle möglich

4. **Multi-Tenant Isolation**
   - tenant_id bleibt bei Rollenwechsel erhalten
   - Keine Cross-Tenant Zugriffe möglich

## ⚠️ Potenzielle Sicherheitslücken

### 1. **Fehlende Einschränkungen in Employee-View**

- **Problem:** Ein Root/Admin könnte als Employee getarnt kritische Aktionen durchführen
- **Szenario:** Root wechselt zu Employee → Löscht "versehentlich" wichtige Daten
- **Empfehlung:** Bestimmte kritische Aktionen in Employee-View blockieren wenn `isRoleSwitched = true`

### 2. **Multi-Tab/Browser Verwirrung**

- **Problem:** User hat mehrere Tabs mit unterschiedlichen Rollen offen
- **Szenario:** Tab 1 = Root View, Tab 2 = Employee View → Verwirrung
- **Empfehlung:** Visueller Indikator + Session-Sync zwischen Tabs

### 3. **Kein automatisches Timeout**

- **Problem:** User vergisst zurückzuwechseln
- **Szenario:** Admin wechselt zu Employee, geht Mittagessen, Kollege nutzt PC
- **Empfehlung:** Nach 30 Min Inaktivität automatisch zur Original-Rolle

### 4. **Fehlende Restrictions für kritische Operationen**

- **Problem:** Als Employee getarnter Admin könnte Vertrauen missbrauchen
- **Beispiel:** Urlaubsanträge anderer einsehen, private Nachrichten lesen
- **Empfehlung:** Privacy-Mode für geswitchte Rollen

## 🎭 Vergessene Szenarien

### 1. **Delegation/Stellvertretung**

- **Szenario:** Admin ist im Urlaub, möchte temporär einem Employee Admin-Rechte geben
- **Aktuell:** Nicht möglich
- **Lösung:** Temporäre Rollen-Erhöhung mit Zeitlimit

### 2. **Emergency Access**

- **Szenario:** Root-User nicht erreichbar, kritisches Problem
- **Aktuell:** Kein Fallback
- **Lösung:** Break-Glass Prozess mit Multi-Admin Genehmigung

### 3. **Onboarding/Training Mode**

- **Szenario:** Neuer Admin soll Employee-Perspektive verstehen
- **Aktuell:** Funktioniert, aber nicht explizit
- **Lösung:** "Training Mode" mit eingeschränkten Schreibrechten

### 4. **Compliance/Audit Requirements**

- **Szenario:** Betriebsrat möchte sicherstellen, dass Admins nicht heimlich mitlesen
- **Aktuell:** Logs vorhanden, aber nicht leicht zugänglich
- **Lösung:** Audit-Dashboard für Rollenwechsel

## 🛡️ Empfohlene Sicherheitsmaßnahmen

### 1. **UI/UX Verbesserungen**

```javascript
// Visueller Indikator für aktive Rolle
if (user.isRoleSwitched) {
  showBanner("Sie agieren als: " + user.activeRole);
  document.body.classList.add("role-switched-mode");
}
```

### 2. **Einschränkungen implementieren**

```javascript
// In sensitiven Endpoints prüfen
if (req.user.isRoleSwitched && req.user.activeRole === "employee") {
  // Blockiere Zugriff auf private Daten anderer
  if (requestedUserId !== req.user.id) {
    return res.status(403).json({
      message: "Im Employee-Modus nur eigene Daten einsehbar",
    });
  }
}
```

### 3. **Session Management**

```javascript
// Automatisches Timeout nach Inaktivität
const ROLE_SWITCH_TIMEOUT = 30 * 60 * 1000; // 30 Minuten

if (user.isRoleSwitched && Date.now() - user.lastActivity > ROLE_SWITCH_TIMEOUT) {
  // Automatisch zur Original-Rolle zurück
  await revertToOriginalRole(user);
}
```

### 4. **Erweiterte Audit-Logs**

```sql
-- Neue Spalten für admin_logs
ALTER TABLE admin_logs ADD COLUMN viewed_data JSON;
ALTER TABLE admin_logs ADD COLUMN was_role_switched BOOLEAN DEFAULT FALSE;
```

## 📋 Implementierungs-Checkliste

### Kurzfristig (Sicherheit)

- [ ] Visueller Indikator für Rollenwechsel
- [ ] Einschränkungen für geswitchte Rollen
- [ ] Automatisches Timeout nach Inaktivität
- [ ] Erweiterte Logging für Compliance

### Mittelfristig (Features)

- [ ] Delegation/Stellvertretung System
- [ ] Training Mode für Onboarding
- [ ] Audit-Dashboard für Betriebsrat
- [ ] Multi-Tab Session Sync

### Langfristig (Enterprise)

- [ ] Break-Glass Emergency Access
- [ ] Role-based Feature Flags
- [ ] Temporary Permission Elevation
- [ ] Integration mit AD/LDAP Rollen

## 🎯 Fazit

Das aktuelle System ist funktional und sicher für Basis-Anforderungen. Für Enterprise-Kunden sollten jedoch zusätzliche Sicherheitsmaßnahmen und Compliance-Features implementiert werden.

**Priorität:** Visueller Indikator und Einschränkungen für geswitchte Rollen sollten als erstes umgesetzt werden.
