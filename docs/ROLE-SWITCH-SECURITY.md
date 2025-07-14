# Role Switch Security Documentation

## Übersicht

Das Role-Switch-Feature wurde mit einem robusten Sicherheitssystem ausgestattet, das sicherstellt, dass Benutzer nur auf Seiten zugreifen können, für die sie in ihrer aktuellen Rolle berechtigt sind.

## Implementierung

### 1. Access Control Map (`/frontend/src/scripts/utils/access-control.ts`)

Definiert welche Rollen auf welche Seiten zugreifen dürfen:

- **Root-only Seiten**: `/logs`, `/manage-root-users`, `/root-features`, etc.
- **Admin & Root Seiten**: `/manage-admins`, `/departments`, `/blackboard`, etc.
- **Employee Seiten** (für alle zugänglich): `/kvp`, `/calendar`, `/chat`, etc.

### 2. Role Switch Logik

Beim Rollenwechsel wird nun automatisch geprüft:
1. Kann die neue Rolle auf die aktuelle Seite zugreifen?
2. **JA**: Die Seite wird neu geladen
3. **NEIN**: Automatische Weiterleitung zum passenden Dashboard

### 3. Automatische Zugriffsprüfung

Bei jedem Seitenaufruf wird in `auth.ts` automatisch geprüft, ob die aktuelle Rolle Zugriff hat. Bei fehlendem Zugriff erfolgt eine Weiterleitung zum Dashboard.

## Sicherheitsvorteile

1. **Verhindert unbefugten Zugriff**: Ein Admin im Employee-Modus kann nicht auf Admin-Seiten zugreifen
2. **Automatische Bereinigung**: Beim Role-Switch werden unzugängliche Seiten automatisch verlassen
3. **Konsistente User Experience**: Benutzer landen immer auf einer für sie zugänglichen Seite

## Beispiel-Szenario

```
Root User auf /logs → Switch zu Admin → Automatische Weiterleitung zu /admin-dashboard
Admin auf /kvp → Switch zu Employee → Bleibt auf /kvp (da Employee-Zugriff erlaubt)
```

## Wartung

Bei neuen Seiten muss die Access Control Map in `access-control.ts` aktualisiert werden:

```typescript
const accessMap: Record<string, UserRole[]> = {
  '/neue-seite': ['admin', 'root'], // Definiere erlaubte Rollen
  // ...
};
```