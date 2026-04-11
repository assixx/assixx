# Cloudflare Turnstile — Bot Protection

> Bot-Schutz für Login & Signup Formulare.
> Alternative zu Google reCAPTCHA — datenschutzfreundlich, kein Cookie-Banner nötig.

**Stand:** 2026-04-11
**Docs:** https://developers.cloudflare.com/turnstile/

---

## Architektur

```
Browser                         SvelteKit Server              Cloudflare
   │                                │                            │
   │  1. Turnstile Widget lädt      │                            │
   │ ◄──────────────────────────────┼────────────────────────────│
   │                                │                            │
   │  2. User löst Challenge        │                            │
   │ ────────────────────────────── │ ──────────────────────────►│
   │  3. Token zurück               │                            │
   │ ◄─────────────────────────────-┼────────────────────────────│
   │                                │                            │
   │  4. Form Submit + Token        │                            │
   │ ──────────────────────────────►│                            │
   │                                │  5. siteverify (Secret)    │
   │                                │ ──────────────────────────►│
   │                                │  6. { success: true }      │
   │                                │ ◄──────────────────────────│
   │                                │                            │
   │  7. Login/Signup fortsetzen    │                            │
   │ ◄─────────────────────────────-│                            │
```

---

## Keys

| Key                         | Wo                              | Zweck                             |
| --------------------------- | ------------------------------- | --------------------------------- |
| `PUBLIC_TURNSTILE_SITE_KEY` | `frontend/.env` + Doppler       | Client-seitig, Widget rendern     |
| `TURNSTILE_SECRET_KEY`      | `frontend/.env.local` + Doppler | Server-seitig, Token verifizieren |

**Cloudflare Dashboard:** https://dash.cloudflare.com → Turnstile → Widget auswählen

---

## Dateien

| Datei                                          | Zweck                                                       |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `frontend/src/lib/components/Turnstile.svelte` | Wiederverwendbare Svelte 5 Komponente                       |
| `frontend/src/lib/server/turnstile.ts`         | Server-seitige Token-Verifizierung via `siteverify` API     |
| `frontend/src/routes/api/turnstile/+server.ts` | POST-Endpoint für Signup-Verifizierung                      |
| `frontend/src/app.d.ts`                        | TypeScript-Typen (`TurnstileApi`, `TurnstileRenderOptions`) |
| `frontend/svelte.config.js`                    | CSP-Direktiven (`script-src`, `frame-src`)                  |

### Wo integriert

| Seite     | Verifizierung                                      | Action   |
| --------- | -------------------------------------------------- | -------- |
| `/login`  | In `+page.server.ts` Form Action                   | `login`  |
| `/signup` | Via `/api/turnstile` Endpoint vor `registerUser()` | `signup` |

---

## Komponente verwenden

```svelte
<script lang="ts">
  import Turnstile from '$lib/components/Turnstile.svelte';

  let turnstileToken = $state('');
  let turnstileRef: { reset: () => void } | undefined;
</script>

<Turnstile bind:this={turnstileRef} bind:token={turnstileToken} action="meine-action" />

<!-- Token prüfen bevor Submit erlaubt wird -->
<button disabled={turnstileToken === ''}>Absenden</button>
```

**Props:**

| Prop     | Typ                 | Beschreibung                                    |
| -------- | ------------------- | ----------------------------------------------- |
| `action` | `string`            | Action-Name — muss server-seitig übereinstimmen |
| `token`  | `$bindable<string>` | Verifizierungstoken, leer = noch nicht gelöst   |

**Methoden (via `bind:this`):**

| Methode   | Beschreibung                                       |
| --------- | -------------------------------------------------- |
| `reset()` | Widget zurücksetzen (nach fehlgeschlagenem Submit) |

---

## Server-seitige Verifizierung

### In Form Actions (wie Login)

```typescript
import { verifyTurnstile } from '$lib/server/turnstile';

// Token aus FormData extrahieren
const turnstileToken = formData.get('turnstileToken');
const ip = request.headers.get('x-forwarded-for') ?? '';

const valid = await verifyTurnstile(tokenValue, ip, 'login');
if (!valid) {
  return fail(403, { error: 'Sicherheitsprüfung fehlgeschlagen.' });
}
```

### Via API-Endpoint (wie Signup)

```typescript
const res = await fetch('/api/turnstile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: turnstileToken, action: 'signup' }),
});

if (!res.ok) {
  // Turnstile fehlgeschlagen
  turnstileRef?.reset();
  return;
}
```

---

## Lokale Entwicklung

### Domain freischalten

Cloudflare Dashboard → Turnstile → Widget → **Allowed Domains** → `localhost` hinzufügen.

Nur `localhost` eingeben — ohne Protokoll, ohne Port, ohne Pfad. Cloudflare matcht automatisch alle Ports und Pfade.

### Test-Keys (Alternative)

Cloudflare stellt offizielle Test-Keys bereit die auf jeder Domain funktionieren:

| Key        | Wert                                  | Verhalten                          |
| ---------- | ------------------------------------- | ---------------------------------- |
| Site Key   | `1x00000000000000000000AA`            | Challenge immer bestanden          |
| Site Key   | `2x00000000000000000000AB`            | Challenge immer geblockt           |
| Site Key   | `3x00000000000000000000FF`            | Interaktive Challenge erzwingen    |
| Secret Key | `1x0000000000000000000000000000000AA` | Verifizierung immer erfolgreich    |
| Secret Key | `2x0000000000000000000000000000000AB` | Verifizierung immer fehlgeschlagen |

### Kein Secret Key konfiguriert?

Wenn `TURNSTILE_SECRET_KEY` leer ist, überspringt `verifyTurnstile()` die Prüfung und gibt `true` zurück. Das Widget wird trotzdem angezeigt (Site Key reicht), aber die Server-Verifizierung entfällt.

---

## CSP (Content Security Policy)

Turnstile benötigt zwei CSP-Einträge in `svelte.config.js`:

```javascript
csp: {
  directives: {
    'script-src': ['self', 'https://challenges.cloudflare.com'],
    'frame-src': ['https://challenges.cloudflare.com'],
  }
}
```

- `script-src` — Turnstile JavaScript laden
- `frame-src` — Challenge-Widget rendert in einem iframe

---

## Fehler-Referenz

| Error Code         | Ursache                       | Lösung                                                            |
| ------------------ | ----------------------------- | ----------------------------------------------------------------- |
| `110200`           | Domain nicht erlaubt          | `localhost` im Cloudflare Dashboard als Allowed Domain hinzufügen |
| `110100`           | Ungültiger Site Key           | Key im Dashboard prüfen                                           |
| Token leer         | Script nicht geladen          | CSP `script-src` + `frame-src` prüfen                             |
| `siteverify` false | Ungültiger/abgelaufener Token | Token ist single-use — nach Fehler `reset()` aufrufen             |

---

## Doppler

```bash
# Keys anzeigen
doppler secrets get PUBLIC_TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY --project assixx --config dev

# Keys setzen
doppler secrets set PUBLIC_TURNSTILE_SITE_KEY="<site-key>" --project assixx --config dev
doppler secrets set TURNSTILE_SECRET_KEY="<secret-key>" --project assixx --config dev

# Production
doppler secrets set PUBLIC_TURNSTILE_SITE_KEY="<site-key>" --project assixx --config prd
doppler secrets set TURNSTILE_SECRET_KEY="<secret-key>" --project assixx --config prd
```
