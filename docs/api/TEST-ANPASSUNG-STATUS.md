# Test-Anpassung Status Report

## Stand: 24.07.2025

### Zusammenfassung

Versuch, Tests minimal an bestehende API anzupassen, zeigt fundamentale Architektur-Probleme.

## Calendar API (/api/calendar)

### Was funktioniert:

- ✅ 6 von 40 Tests bestehen (15%)
- ✅ Basic CRUD operations
- ✅ Auth funktioniert

### Hauptprobleme:

1. **Field Mapping Chaos:**
   - API: `start_time`, `end_time`, `org_level`, `org_id`
   - DB: `start_date`, `end_date` (keine org fields)
   - Model macht Mapping, aber unvollständig

2. **Validation Issues:**
   - `org_id` darf nicht null sein
   - Felder die nicht in DB existieren werden trotzdem validiert

## Chat API (/api/chat)

### Was funktioniert:

- ✅ 1 von 60 Tests besteht (1.7%)
- ✅ GET /api/chat/conversations gibt 200

### Hauptprobleme:

1. **Komplett andere Konzepte:**
   - Tests: channels, messages als top-level
   - API: conversations mit participants
   - DB: Noch alte channel-Struktur

2. **Request Format:**
   - Tests senden: `{name, type, visibility_scope}`
   - API erwartet: `{participant_ids, is_group, name}`

## Shifts API

- Noch nicht analysiert
- 6 von 66 Tests bestehen (9%)

## Fazit

### Zahlen:

- **Gesamt:** ~40 von 502+ Tests bestehen (< 10%)
- **Tendenz:** Mit jedem Fix werden neue Probleme sichtbar

### Problem:

Die API und Tests wurden offensichtlich von verschiedenen Teams/zu verschiedenen Zeiten entwickelt ohne gemeinsame Spec.

### Empfehlung:

**STOPP der Test-Anpassungen!**

Stattdessen:

1. API-Design Workshop
2. OpenAPI Spec als Single Source of Truth
3. Entscheidung: Welche Version ist "richtig"?
4. Systematische Überarbeitung

### Zeitschätzung:

- Test-Anpassung fortsetzen: 2-3 Wochen (fragiles Ergebnis)
- API neu designen: 2-3 Wochen (nachhaltiges Ergebnis)

## Nächste Schritte

1. Management-Entscheidung einholen
2. Workshop-Termin festlegen
3. Bis dahin: Kritische Bugs in Production fixen
4. Keine weiteren Test-Anpassungen ohne klare Strategie!
