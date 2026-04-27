# HOW-TO: Lokalen Tenant-Subdomain testen

> **Scope:** Subdomain-Routing (ADR-050) lokal in der Dev-Umgebung ausprobieren.
> **Zielgruppe:** Developer die einen neuen Tenant-Slug testen müssen —
> z.B. nach Signup-Flow-Test oder wenn du gerade einen Tenant `meinefirma`
> anlegst und auf `http://meinefirma.localhost:5173/login` zugreifen willst.
> **Stand:** 2026-04-21 (Session 12c-fix)

---

## Warum überhaupt Subdomain lokal?

ADR-050 macht jeden Tenant über seinen eigenen Subdomain zugänglich
(`scs-technik.assixx.com/dashboard`). Die Architektur verlässt sich auf
Browser-native Cookie-Isolation pro Origin — ohne Subdomain läuft die
Cross-Tenant-Abwehr im Dev nicht scharf. Der Trade-off: jeder Dev-User
muss einmal `/etc/hosts` pro Tenant anfassen.

`/etc/hosts` unterstützt **keine Wildcards** — jede Subdomain muss explizit
drin stehen. glibc auf WSL2/Linux resolved `*.localhost` zwar oft auch
ohne Eintrag (systemd-resolved / nss-resolve per RFC 6761), aber das ist
nicht überall zuverlässig — der expliziteste Weg ist der sicherste.

---

## Setup-Schritte (3 Minuten, einmal pro neuem Slug)

### 1. Slug im DB-Tenants-Eintrag verifizieren

Bevor du den Eintrag machst, sicherstellen dass der Tenant **wirklich**
so heißt wie du denkst (der häufigste Fehler: Email-Domain mit
Routing-Slug verwechseln — siehe §Fallstricke unten):

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT id, subdomain, company_name FROM tenants WHERE is_active = 1 ORDER BY id;"
```

Notiere die **`subdomain`**-Spalte — das ist der Wert, den du in
`/etc/hosts` eintragen musst.

### 2. `/etc/hosts` Eintrag hinzufügen (sudo)

**Neuer Slug:** `meinefirma` — befehl:

```bash
echo "127.0.0.1 meinefirma.localhost" | sudo tee -a /etc/hosts
```

Nach `Enter` sudo-Passwort eingeben. Fertig.

**Mehrere auf einmal:**

```bash
echo "127.0.0.1 meinefirma.localhost firma-c.localhost firma-d.localhost" \
  | sudo tee -a /etc/hosts
```

> **Heredoc-Variante wenn du Markierung willst:**
>
> ```bash
> sudo tee -a /etc/hosts <<'EOF'
>
> # Assixx local subdomains
> 127.0.0.1 meinefirma.localhost firma-c.localhost
> EOF
> ```
>
> **Wichtig:** `EOF` muss ganz links stehen, kein Leerzeichen davor — sonst
> hängt die Shell. Tipp: Heredoc komplett vermeiden mit `printf`:
> `printf '127.0.0.1 meinefirma.localhost\n' | sudo tee -a /etc/hosts`.

> **WSL2-Hinweis (KRITISCH für Persistenz):** Per Default regeneriert WSL bei
> jedem Distro-Start `/etc/hosts` aus den Windows-Defaults und **überschreibt
> deinen Eintrag**. Ohne den folgenden Schritt ist dein Subdomain-Eintrag nach
> dem nächsten `wsl --shutdown` / Reboot **weg** — du erlebst dann genau das
> R15-Bouncing aus §Troubleshooting unten und denkst, der Login sei kaputt.
>
> **Einmalig setzen:**
>
> ```bash
> printf '[network]\ngenerateHosts = false\n' | sudo tee /etc/wsl.conf > /dev/null
> ```
>
> Greift erst beim nächsten WSL-Start (`wsl --shutdown` aus PowerShell oder
> Windows-Reboot). Für die laufende Session hat dein manueller `/etc/hosts`-Eintrag
> sofort Wirkung — `wsl.conf` schützt nur künftige Boots.

### 3. Verifizieren

```bash
ping -c 1 meinefirma.localhost    # → 127.0.0.1
tail -3 /etc/hosts                # → sollte deine Zeile zeigen
```

Bei mehreren Namen auf einer Zeile zeigt `ping` den **ersten** als
Canonical-Name in der Header-Zeile — das ist normal glibc-Verhalten,
die IP-Auflösung stimmt.

### 4. Im Browser aufrufen

```
http://meinefirma.localhost:5173/login
```

**Jede Subdomain ist eine eigene Browser-Origin** → eigene Cookies,
eigene Sessions. Ein vorheriger Login auf `localhost:5173` oder auf
einer anderen Subdomain gilt dort **nicht** — frisch einloggen.

### 5. Optional: Login-via-Apex-Handoff testen

ADR-050 Session 12c erlaubt Login auf dem Apex → automatischer Handoff
zum Subdomain-Origin:

1. Browser: `http://localhost:5173/login`
2. Einloggen als User aus Tenant `meinefirma`
3. Browser sollte automatisch zu `http://meinefirma.localhost:5173/root-dashboard`
   navigieren (oder `/admin-dashboard` / `/employee-dashboard` je nach Rolle)

Wenn das NICHT passiert: siehe §Troubleshooting.

---

## Was automatisch funktioniert (kein Handeln nötig)

| Thema                            | Warum läuft es                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| **Vite `allowedHosts`**          | `vite.config.ts` setzt `allowedHosts: ['.localhost']` (Session 12c) → jeder Subdomain ok                                                          |
| **Backend CORS**                 | `DEV_ORIGIN_REGEX` in `main.ts` erlaubt `http://*.localhost:5173\|5174` UND bare `http://*.localhost` (Production-Profile, Port 80)               |
| **`extractSlug('*.localhost')`** | Resolved Slug → DB-Lookup → `hostTenantId` → R14/R15 Cross-Check aktiv (Session 12c-fix)                                                          |
| **Branding endpoint**            | `GET /api/v2/tenants/branding/:slug` liefert Tenant-Namen für Login-Page-Titel                                                                    |
| **OAuth Handoff**                | Redis-Keyspace `oauth:handoff:{token}` wird korrekt gegen Subdomain cross-checked (R15)                                                           |
| **Cloudflare Turnstile**         | Test-Keys oder `localhost`-Allowed-Domain-Match funktionieren auf allen `*.localhost`                                                             |
| **Production-Profile (`:80`)**   | Nginx `server_name localhost *.localhost;` matcht Wildcard, alle 5 `proxy_pass` Blöcke setzen `X-Forwarded-Host $host;` (ADR-050 Amendment 2026-04-27) |
| **adapter-node SSR Subdomain**   | `PROTOCOL_HEADER=x-forwarded-proto` + `HOST_HEADER=x-forwarded-host` ENV-Vars (statt statisch `ORIGIN`) → `event.url` per-request korrekt          |
| **Cookie `Secure` Flag**         | `frontend/src/lib/server/auth-cookies.ts` leitet `secure` aus `url.protocol` ab — HTTP-local-prod-test droppt keine Cookies mehr (RFC 6265bis §4.1.2.5) |

---

## Fallstricke

### 1. Email-Domain ≠ Routing-Slug

Ein User mit Email `admin@testfirma.de` gehört zum Tenant mit
**`tenants.subdomain = 'testfirma'`** — NICHT `testfirma.de`.

Die URL lautet `http://testfirma.localhost:5173`, NICHT
`http://testfirma.de.localhost:5173`. Der `.de` ist Teil der Email-Domain,
nicht des Routing-Slugs.

Wenn du versehentlich `testfirma.de.localhost` einträgst:

- `extractSlug()` resolved das zu `null` (nested, single-label-only-Regel)
- Vite's `allowedHosts: ['.localhost']` matcht es und servet die Seite
- Aber Backend-Middleware sieht `hostTenantId = null`
- Handoff-Cross-Check wirft `HANDOFF_HOST_MISMATCH` 403

**Wenn Login fehlschlägt mit `?oauth=handoff-host-mismatch`:** als allererstes
URL-Bar prüfen — sind da Extra-Labels? Meistens ja.

### 2. Cookies aus vorherigem Login stören

Wenn du vorher auf `localhost:5173` eingeloggt warst und dann direkt
`meinefirma.localhost:5173/login` öffnest, sieht Browser das als **neue**
Origin. Die alten Cookies gelten nicht — du musst frisch einloggen.

Wenn du beide Origins parallel offen hältst: der `accessTokenExp`-Cookie
kann zwischen den beiden divergieren. Das ist **gewollt** (ADR-050
Cookie-Isolation) — kein Bug.

### 3. Turnstile scheint zu hängen

Wenn Turnstile-Widget nicht rendert: Cloudflare Dashboard → Turnstile
→ Widget → Allowed Domains prüfen. Für Dev reicht `localhost` — CF
matcht das loose für `*.localhost` (nicht offiziell dokumentiert,
funktioniert aber). Alternativ Test-Keys:
`PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` in Doppler setzen.

Details: [HOW-TO-CLOUDFLARE-TURNSTILE.md](./HOW-TO-CLOUDFLARE-TURNSTILE.md).

### 4. Vite Dev-Server muss laufen

Wenn du keinen aktiven `pnpm run dev:svelte`-Prozess hast:
`meinefirma.localhost:5173` schlägt mit Connection-Refused fehl. Kein
Bug — Vite dient auf 5173, ohne Prozess ist da nichts.

---

## Troubleshooting

### Symptom: `ping meinefirma.localhost` → "Name or service not known"

`/etc/hosts` Eintrag nicht aktiv. Nochmal `tail -3 /etc/hosts` prüfen.
Falls leer: sudo-Command hat nicht geklappt (falsches Passwort, Heredoc-
Syntax-Fehler, o.ä.) — mit `echo "..." | sudo tee -a` Version wiederholen.

### Symptom: `testfirma.localhost:5173` zeigt "Blocked host" Vite-Error

Vite-Server wurde vor Session 12c gestartet, Config-Änderung
`allowedHosts: ['.localhost']` nicht gelesen. Dev-Server neu starten:
`Ctrl+C` im Terminal wo `dev:svelte` läuft, dann `pnpm run dev:svelte`
nochmal.

### Symptom: Login leitet zu `?oauth=handoff-host-mismatch`

R15 Cross-Check greift. Ursachen (Reihenfolge der Wahrscheinlichkeit):

1. URL-Typo (siehe §Fallstricke #1)
2. User gehört zu anderem Tenant als der Subdomain-Slug — das ist **gewollt**,
   cross-tenant Login schützt vor Routing-Verwechslung
3. Backend wurde nach Code-Änderung an `extract-slug.ts` / `jwt-auth.guard.ts` /
   `oauth-handoff.controller.ts` nicht neu gestartet:
   `cd docker && doppler run -- docker-compose restart backend`

### Symptom: Browser-URL ist korrekt, aber API-Calls kommen mit `CORS origin not allowed`

Backend sieht den Origin nicht in seiner Allowlist. Fast immer: Backend
läuft noch eine alte Version ohne die aktuelle `DEV_ORIGIN_REGEX`.
Restart Backend und Browser-Cache leeren.

---

## Cleanup (wenn du einen Tenant nicht mehr brauchst)

`/etc/hosts` ist append-only in den obigen Befehlen. Zum Aufräumen manuell
editieren:

```bash
sudo nano /etc/hosts
# Die Zeile(n) mit `127.0.0.1 <alter-slug>.localhost` löschen. Ctrl+O, Ctrl+X.
```

Alte Einträge **schaden nicht** — sie zeigen einfach ins Nichts wenn der
Tenant DB-seitig gelöscht ist (backend-middleware returnt `hostTenantId = null`
bei Slug ohne DB-Treffer).

---

## Verwandtes

- [ADR-050](../infrastructure/adr/ADR-050-tenant-subdomain-routing.md) — Architektur + R14/R15 Security-Model
- [FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN](../FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md) — Session 12c / 12c-fix Changelog
- [HOW-TO-CLOUDFLARE-TURNSTILE](./HOW-TO-CLOUDFLARE-TURNSTILE.md) — Bot-Protection für Login/Signup
- `backend/src/nest/common/utils/extract-slug.ts` — Canonical Parser (Source of Truth)
- `frontend/src/lib/utils/extract-slug.ts` — Frontend-Twin (D5-Duplicate, byte-nahe identisch)
