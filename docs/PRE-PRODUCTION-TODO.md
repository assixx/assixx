# Pre-Production TODO

**Erstellt:** 8. März 2026
**Quelle:** Code Audit (Maßnahmen #16, #17, #18)
**Branch:** `refactor/code-audit`

---

## #17 — Storage-Upgrade: Echte Speichernutzung vom Backend

**Aufwand:** 1–2h | **Typ:** Feature-Vervollständigung

**Problem:** Speichernutzung ist hardcoded `used: 0, percentage: 0` — UI zeigt immer 0%.

**Betroffene Dateien:**

| Datei                                                               | Zeile | Aktueller Code                                           |
| ------------------------------------------------------------------- | ----- | -------------------------------------------------------- |
| `frontend/src/routes/(app)/(admin)/storage-upgrade/+page.server.ts` | 86    | `used: 0, // TODO: Get actual used storage from backend` |
| `frontend/src/routes/(app)/(admin)/storage-upgrade/+page.svelte`    | 149   | `used: 0, // TODO: Get actual used storage from backend` |

**Was fehlt:**

1. Backend-Endpoint der die tatsächliche Speichernutzung eines Tenants berechnet (z.B. Summe aller Dateigrößen in `uploads/`)
2. Frontend: `used` und `percentage` aus Backend-Response statt hardcoded `0`

**Auswirkung ohne Fix:** Speicher-Fortschrittsbalken zeigt immer 0%. Warnfarben (70% orange, 90% rot) triggern nie. Feature ist funktional nutzlos.

---

## #18 — Survey-Results: PDF-Export

**Aufwand:** 3–4h | **Typ:** Feature-Vervollständigung

**Problem:** PDF-Export-Button existiert, zeigt aber nur `showAlert('PDF-Export wird implementiert...')`.

**Betroffene Datei:**

| Datei                                                           | Zeile   | Aktueller Code                                                                          |
| --------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `frontend/src/routes/(app)/(admin)/survey-results/+page.svelte` | 103-106 | `function handleExportPDF(): void { // TODO: Implement PDF export; showAlert('...'); }` |

**Was fehlt:**

1. PDF-Library auswählen (z.B. `pdfmake`, `jspdf`, oder serverseitiger PDF-Generator)
2. PDF-Template mit Umfrage-Header, Statistik-Grid, Frage-Ergebnisse (Balken, Sterne, Text)
3. Analog zu `handleExportExcel()` implementieren (Loading-State, Error-Handling, Download-Trigger)

**Kontext:** Excel-Export (`exportToExcel` in `_lib/api.ts`) funktioniert bereits — PDF-Export sollte gleiches Pattern folgen.

**Auswirkung ohne Fix:** Button täuscht Funktionalität vor. User-Erwartung wird enttäuscht.

---

## ~~#16 — Nonce-based CSP (Content Security Policy)~~ — ERLEDIGT (2026-03-08)

**Ergebnis der Analyse:** CSP war **bereits nonce-basiert implementiert** in SvelteKit (`frontend/svelte.config.js`, `csp.mode: 'nonce'`). Das TODO in `main.ts` war irreführend.

**Was gemacht wurde:**

1. Redundante CSP-Konfiguration aus `fastify-helmet` entfernt (`contentSecurityPolicy: false`)
2. Backend setzt keine eigene CSP mehr — API gibt JSON zurück, CSP wirkt nur auf HTML-Dokumente
3. Helmet bleibt aktiv für andere Security-Headers (X-Content-Type-Options, HSTS, etc.)
4. `style-src: 'unsafe-inline'` in SvelteKit ist korrekt — benötigt für Svelte Transitions (dokumentiert in SvelteKit-Docs)

**CSP-Architektur (final):**

| Schicht                        | Verantwortung                                               |
| ------------------------------ | ----------------------------------------------------------- |
| SvelteKit (`svelte.config.js`) | Nonce-basierte CSP für HTML-Pages (automatisch per Request) |
| Backend (`main.ts`)            | Keine CSP — nur JSON-API-Responses                          |
| Nginx                          | Leitet SvelteKit-CSP-Header durch                           |
