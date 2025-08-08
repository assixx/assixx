# v2 Signup 500 Error

**Datum:** 03.08.2025  
**Betroffene Version:** API v2 Migration  
**Status:** ✅ GELÖST

## Problem

Der v2 Signup Endpoint gibt einen 500 Internal Server Error zurück:

```
POST http://localhost:3000/api/v2/signup
{"success":false,"error":{"code":"REGISTRATION_FAILED","message":"Failed to complete registration"}}
```

Die v1 API funktioniert einwandfrei.

## Bisherige Debugging-Schritte

1. **Validierung überprüft**:
   - Backend erwartete `selectedPlan`, Frontend sendete `plan`
   - ✅ Behoben in validation.ts und types.ts

2. **Imports überprüft**:
   - SignupService wird korrekt importiert
   - Tenant Model wird korrekt importiert
   - Tenant.create Methode existiert

3. **TypeScript Kompilierung**:
   - Build läuft ohne Fehler durch
   - ESM imports werden korrekt konvertiert

## Nächste Schritte

1. Detaillierte Error Logs im SignupService hinzugefügt
2. Direkte Tests im Container zeigen, dass die Module korrekt geladen werden
3. Tests existieren und funktionieren (laut User)

## Lösung

Das Problem waren **UNIQUE Constraints** in der Datenbank:

1. **employee_number**: War hart auf '000001' codiert → Konflikt bei mehreren Tenants
2. **phone**: Telefonnummer muss über alle User eindeutig sein

### Fix:

In `/backend/src/models/tenant.ts`:

```typescript
// Generiere eindeutige Mitarbeiternummer
const timestamp = Date.now().toString().slice(-6);
const random = Math.floor(Math.random() * 1000)
  .toString()
  .padStart(3, "0");
const employeeNumber = `${timestamp}${random}`;
```

## Status

✅ **GELÖST** - v2 Signup funktioniert einwandfrei!

- Neue Tenants können erstellt werden
- Login mit den erstellten Accounts funktioniert
- Frontend und Backend sind kompatibel
