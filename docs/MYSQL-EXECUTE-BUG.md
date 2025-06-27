# MySQL Execute Bug Documentation

## Problem Beschreibung (21.06.2025)

Bei der Implementierung des KVP-Systems trat ein kritischer Fehler mit MySQL Prepared Statements auf.

### Fehlermeldung

```
Error: Incorrect arguments to mysqld_stmt_execute
```

### Betroffene Umgebung

- MySQL Version: 8.0.22+
- Node.js mysql2 Library
- Alle TypeScript Services die `pool.execute()` verwenden

## Ursache

MySQL 8.0.22 und höher haben einen bekannten Bug bei der Verwendung von Prepared Statements über die `execute()` Methode in der mysql2 Node.js Library.

**GitHub Issue:** https://github.com/sidorares/node-mysql2/issues/1239

### Technische Details

- Bug tritt nur bei `execute()` auf, nicht bei `query()`
- Betrifft parameterisierte Queries mit Platzhaltern (?)
- Problem liegt in der C++ Binding zwischen mysql2 und MySQL Server

## Lösung

Alle `execute()` Aufrufe wurden durch `query()` ersetzt.

### Beispiel Vorher (Fehler)

```typescript
const [results] = await pool.execute('SELECT * FROM kvp_suggestions WHERE tenant_id = ? AND id = ?', [tenantId, id]);
```

### Beispiel Nachher (Funktioniert)

```typescript
const [results] = await pool.query('SELECT * FROM kvp_suggestions WHERE tenant_id = ? AND id = ?', [tenantId, id]);
```

## Betroffene Dateien

### Backend Services (21.06.2025)

- `/backend/src/services/kvpPermission.service.ts`
- `/backend/src/controllers/kvp.controller.ts`
- Alle anderen Services mit Prepared Statements

### Spezifische Änderungen

1. **kvpPermission.service.ts**
   - `canViewSuggestion()`: execute → query
   - `canEditSuggestion()`: execute → query
   - `canDeleteSuggestion()`: execute → query

2. **kvp.controller.ts**
   - Alle Datenbank-Operationen von execute auf query umgestellt
   - Zusätzlich: Connection-level charset handling hinzugefügt

## Auswirkungen

### Vorteile der query() Methode

- ✅ Funktioniert mit MySQL 8.0.22+
- ✅ SQL Injection Schutz bleibt erhalten
- ✅ Parameterisierte Queries funktionieren weiterhin
- ✅ Keine Breaking Changes im Code

### Nachteile

- ❌ Kein Prepared Statement Caching (minimaler Performance-Verlust)
- ❌ Bei sehr hoher Last könnte execute() effizienter sein

## Performance Überlegungen

**execute() vs query() Performance:**

- `execute()`: Cached Prepared Statements, minimal schneller bei wiederholten Queries
- `query()`: Kein Caching, aber für die meisten Anwendungen ausreichend schnell

**Für Assixx Projekt:**

- Performance-Unterschied vernachlässigbar
- Stabilität wichtiger als minimale Performance-Gewinne

## Langzeit-Strategie

1. **Aktuell (21.06.2025):** `query()` für alle Datenbank-Operationen verwenden
2. **Monitoring:** MySQL Bug-Status verfolgen
3. **Zukunft:** Wenn Bug gefixt, optional auf `execute()` zurück migrieren
4. **Alternative:** Bei Performance-Problemen Connection Pooling optimieren

## Weitere Probleme

### Character Encoding

Bei der Umstellung wurde auch ein Encoding-Problem mit deutschen Umlauten festgestellt:

- Emojis und Sonderzeichen werden teilweise falsch dargestellt
- Workaround: `SET NAMES utf8mb4` auf Connection-Ebene

```typescript
const connection = await pool.getConnection();
await connection.query('SET NAMES utf8mb4');
// ... queries ...
connection.release();
```

## Lessons Learned

1. **Immer Error Handling testen** mit echten Daten
2. **MySQL Version Kompatibilität** prüfen bei Updates
3. **Alternative Methoden** bereithalten (query vs execute)
4. **GitHub Issues** checken bei kryptischen Fehlern

## Status

✅ **GELÖST** (21.06.2025)

- Alle execute() Aufrufe durch query() ersetzt
- KVP System funktioniert stabil
- Keine bekannten Probleme mit der query() Lösung

---

**Dokumentiert von:** Claude AI
**Datum:** 21.06.2025
**Kontext:** KVP System Implementation
