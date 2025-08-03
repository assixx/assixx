# v2 API Cookie-Auth Kompatibilität Bug

**Datum:** 03.08.2025  
**Betroffene Version:** API v2 Migration  
**Status:** ✅ Gelöst

## Problem

Nach erfolgreichem Login mit der v2 API konnte das Dashboard nicht geladen werden. Der Fehler war:

```
[Login] Using v2 API at /api/v2/auth/login
POST http://localhost:3000/api/v2/auth/login [200 OK]
GET http://localhost:3000/root-dashboard [401 Unauthorized]
{"error":"Authentication token required"}
```

## Ursache

Die v2 API verwendet Bearer Tokens (JWT), die im localStorage gespeichert werden. Die Server-seitige Seiten-Protection (`pageAuth.ts`) erwartet jedoch Authentifizierung über Cookies.

Die `pageAuth.ts` Middleware sucht nach Tokens in dieser Reihenfolge:
1. Cookie mit Namen "token"
2. Authorization Header (Bearer Token)

Da HTML-Seiten direkt vom Server geladen werden (keine API-Calls), können sie keinen Authorization Header senden. Daher muss ein Cookie gesetzt werden.

## Lösung

### 1. login.html anpassen

```javascript
// Nach erfolgreichem v2 Login
if (useV2) {
  // ... Token speichern ...
  
  // Set cookie for server-side page protection (temporary compatibility)
  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}
```

### 2. auth.ts anpassen

**setAuthToken Funktion:**
```javascript
if (useV2) {
  localStorage.setItem('accessToken', token);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
  localStorage.setItem('token', token);
  
  // Set cookie for server-side page protection
  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}
```

**removeAuthToken Funktion:**
```javascript
// Clear cookie for server-side page protection
document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
```

## Cookie-Einstellungen

- `path=/` - Cookie ist für alle Pfade gültig
- `max-age=604800` - 7 Tage Gültigkeit
- `SameSite=Lax` - CSRF-Schutz

## Wichtige Hinweise

1. Diese Lösung ist als "temporary compatibility" markiert
2. Langfristig sollte die Server-seitige Protection auch Bearer Tokens unterstützen
3. Das Cookie wird parallel zum localStorage Token gesetzt
4. Beim Logout werden beide gelöscht

## Test-Prozedur

1. Feature Flags aktivieren:
   ```javascript
   window.migrationHelpers.enableApi('auth');
   window.migrationHelpers.enableApi('signup');
   ```

2. Browser-Cache leeren (Ctrl+Shift+R)

3. Login durchführen

4. Prüfen ob Dashboard lädt

## Zukünftige Verbesserungen

- Server-seitige pageAuth.ts könnte erweitert werden um Bearer Tokens aus einem Custom Header zu lesen
- Oder HTML-Seiten könnten client-seitig gerendert werden (SPA-Ansatz)
- Cookie könnte HttpOnly sein für bessere Sicherheit (erfordert Server-seitige Änderungen)