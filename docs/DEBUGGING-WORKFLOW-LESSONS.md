# Debugging Workflow - Wichtige Lektionen

## 🎯 Goldene Regeln

### 1. One-by-One Approach
- **IMMER** ein Problem nach dem anderen lösen
- Workflow: Fix → Test → Gut? → Nächstes Problem
- Niemals mehrere Probleme gleichzeitig angehen

### 2. Test = Produktion
- Code MUSS identisch funktionieren in Test und Produktion
- `NODE_ENV === 'test'` Checks sind eine **KATASTROPHALE Anti-Pattern**
- Umgebungen anpassen, nicht den Code!

### 3. Erst verstehen, dann handeln
- **NIEMALS** blind loslegen ohne Logs/Fehlermeldungen
- Workflow:
  1. Problem verstehen (Logs analysieren)
  2. Root Cause identifizieren
  3. Fix planen und abstimmen
  4. Implementieren
  5. Lokal UND in CI/CD testen

### 4. Abstimmung ist Pflicht
- Jede Änderung muss lokal funktionieren
- Vor Änderungen fragen: "Funktioniert das auch lokal?"
- Tests sind wertlos wenn sie anderen Code testen

## ❌ Anti-Patterns

```typescript
// NIEMALS SO:
if (process.env.NODE_ENV === 'test') {
  // Anderer Code für Tests
} else {
  // Produktions-Code
}
```

## ✅ Best Practice

```typescript
// Code der IMMER gleich funktioniert
// Unterschiede nur in Konfiguration (DB-Name, URLs, etc.)
```

## 🔍 Debug-Checkliste

1. [ ] GitHub Actions Logs analysiert?
2. [ ] Problem lokal reproduzierbar?
3. [ ] Fix funktioniert lokal?
4. [ ] Fix funktioniert in Tests?
5. [ ] Kein environment-spezifischer Code?

## 📝 Vor jedem Commit/Push

**IMMER diese Befehle ausführen:**

```bash
# TypeScript Check
docker exec assixx-backend pnpm run type-check

# ESLint + Prettier
docker exec assixx-backend pnpm run lint:fix

# Nochmal TypeScript zur Sicherheit
docker exec assixx-backend pnpm run type-check
```

Erst wenn ALLE grün sind → committen und pushen!