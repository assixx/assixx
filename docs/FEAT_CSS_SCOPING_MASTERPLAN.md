# FEAT: CSS Scoping Migration — Execution Masterplan

> **Created:** 2026-02-15
> **Version:** 0.2.0 (Double-Checked)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `todo`
> **Author:** SCS (Senior Engineer)
> **Estimated Sessions:** 12
> **Actual Sessions:** 7 / 12

---

## Changelog

| Version | Datum      | Änderung                                                |
| ------- | ---------- | ------------------------------------------------------- |
| 0.1.0   | 2026-02-15 | Initial Draft — Phase 1 + Phase 2 geplant               |
| 0.2.0   | 2026-02-15 | Double-Check: Nested @import Fix, Stays-Liste, Metriken |
| 0.3.0   | 2026-02-15 | Session 4 complete: 5 Large Files migriert              |
| 0.4.0   | 2026-02-15 | Session 5 complete: 3 XL Files migriert (Phase 1 DONE!) |
| 0.5.0   | 2026-02-15 | Session 6 complete: logs.css aufgeteilt (Phase 2 Start) |
| 0.6.0   | 2026-02-15 | Session 7 complete: password-strength.css → Komponente  |

---

## Ziel

Alle externen CSS-Dateien (`frontend/src/styles/*.css`) in Svelte `<style>` Blöcke verschieben und die externen Dateien löschen. Geteilte CSS-Dateien werden in wiederverwendbare Svelte-Komponenten extrahiert.

**Ergebnis:** Null externe CSS-Imports in Svelte-Seiten. Jede Komponente besitzt ihr eigenes scoped CSS.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] Frontend Dev Server läuft (`pnpm run dev:svelte`)
- [ ] ESLint `max-lines` Limit für `.svelte` Dateien erhöht (aktuell 750)
- [ ] Keine pending CSS-Änderungen auf anderen Branches

### 0.2 Risk Register

| #   | Risiko                                  | Impact  | Wahrscheinlichkeit  | Mitigation                                                                  | Verifikation                             |
| --- | --------------------------------------- | ------- | ------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| R1  | CSS-Klassen global referenziert von JS  | Hoch    | Niedrig             | Grep nach Klassennamen in `.ts`/`.svelte` vor Scoping                       | Grep bestätigt keine externen Referenzen |
| R2  | Scoped CSS bricht Child-Komponenten     | Hoch    | Mittel              | `:global()` für Styles die auf Child-Elemente zielen                        | Visueller Check jeder Seite im Browser   |
| R3  | Dark Mode / prefers-color-scheme bricht | Mittel  | Niedrig             | Media Queries 1:1 mitnehmen in `<style>`                                    | Dark Mode Toggle testen                  |
| R4  | ESLint max-lines Limit überschritten    | Niedrig | Hoch                | Limit vor Start erhöhen (User-Entscheidung)                                 | `pnpm run lint` nach jeder Session       |
| R5  | Geteilte CSS → Duplikation              | Mittel  | Hoch                | Phase 2: Shared CSS → eigene Svelte-Komponenten                             | Grep bestätigt 0 externe CSS-Imports     |
| R6  | Nested CSS `@import` in CSS-Dateien     | Hoch    | Niedrig (3 Dateien) | Design-System-Imports entfernen (Duplikate), `user-info-update.css` inlinen | `@import` Grep = 0 in migrierten Dateien |

### 0.3 Bestandsaufnahme

**39 externe CSS-Dateien** in `frontend/src/styles/`
**44 CSS-Imports** in **34 Svelte-Dateien**
**~11.791 CSS-Zeilen** total (9.612 1:1 inkl. user-info-update.css + 2.179 shared)

---

## Phase 1: 1:1 CSS-Dateien → `<style>` (29 Dateien)

> **Regel pro Datei:**
>
> 1. CSS-Datei lesen
> 2. Import-Zeile aus `.svelte` entfernen
> 3. CSS-Inhalt in `<style>` Block der `.svelte`-Datei einfügen
> 4. CSS-Datei löschen
> 5. Visueller Check im Browser

### Session 1: Small Files (7 Dateien, ~194 Zeilen)

| #   | CSS-Datei            | Zeilen | Svelte-Ziel                   |
| --- | -------------------- | ------ | ----------------------------- |
| 1   | manage-employees.css | 5      | manage-employees/+page.svelte |
| 2   | manage-root.css      | 21     | manage-root/+page.svelte      |
| 3   | manage-teams.css     | 25     | manage-teams/+page.svelte     |
| 4   | manage-admins.css    | 27     | manage-admins/+page.svelte    |
| 5   | root-dashboard.css   | 32     | root-dashboard/+page.svelte   |
| 6   | account-settings.css | 36     | account-settings/+page.svelte |
| 7   | rate-limit.css       | 48     | rate-limit/+page.svelte       |

**DoD Session 1:**

- [x] 7 CSS-Imports entfernt
- [x] 3 `<style>` Blöcke hinzugefügt (4 Dateien hatten nur Kommentare, kein CSS)
- [x] 7 CSS-Dateien gelöscht
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)

### Session 2: Medium Files A (7 Dateien, ~1.143 Zeilen)

| #   | CSS-Datei              | Zeilen | Svelte-Ziel                     |
| --- | ---------------------- | ------ | ------------------------------- |
| 1   | admin-profile.css      | 82     | admin-profile/+page.svelte      |
| 2   | employee-profile.css   | 82     | employee-profile/+page.svelte   |
| 3   | manage-assets.css      | 100    | manage-assets/+page.svelte      |
| 4   | documents-explorer.css | 141    | documents-explorer/+page.svelte |
| 5   | root-profile.css       | 146    | root-profile/+page.svelte       |
| 6   | survey-results.css     | 197    | survey-results/+page.svelte     |
| 7   | storage-upgrade.css    | 215    | storage-upgrade/+page.svelte    |

**DoD Session 2:**

- [x] 7 CSS-Imports entfernt
- [x] 7 `<style>` Blöcke hinzugefügt (manage-assets + documents-explorer mit `:global()`)
- [x] 7 CSS-Dateien gelöscht
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] svelte-check: 0 Errors, 0 Warnings (`pnpm exec svelte-check` ✓)
- [x] 26 Unused CSS Selektoren entfernt (survey-results: 3, documents-explorer: 23)

### Session 3: Medium Files B (7 Dateien, ~1.808 Zeilen)

| #   | CSS-Datei           | Zeilen | Svelte-Ziel                  |
| --- | ------------------- | ------ | ---------------------------- |
| 1   | survey-admin.css    | 216    | survey-admin/+page.svelte    |
| 2   | admin-dashboard.css | 211    | admin-dashboard/+page.svelte |
| 3   | survey-employee.css | 233    | survey-employee/+page.svelte |
| 4   | features.css        | 240    | features/+page.svelte        |
| 5   | vacation-rules.css  | 244    | vacation/rules/+page.svelte  |
| 6   | login.css           | 274    | login/+page.svelte           |
| 7   | kvp.css             | 370    | kvp/+page.svelte             |

**Achtung kvp.css:** Enthält `@import './user-info-update.css'` (81 Zeilen). Svelte `<style>` unterstützt kein CSS `@import`. Inhalt von `user-info-update.css` muss **inline** in den `<style>` Block kopiert werden. Danach **beide** Dateien löschen (kvp.css + user-info-update.css).

**DoD Session 3:**

- [x] 7 CSS-Imports entfernt
- [x] 7 `<style>` Blöcke hinzugefügt
- [x] 8 CSS-Dateien gelöscht (7 + user-info-update.css inline in kvp)
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] svelte-check: 0 Errors, 0 Warnings (`pnpm exec svelte-check` ✓)
- [x] 15 Unused CSS Selektoren behoben:
  - kvp: `.upload-box` + `.photo-preview-item` Selektoren → `:global()` (Child-Komponente KvpCreateModal)
  - kvp: `#breadcrumb-container + .alert` entfernt (Dead CSS)
  - survey-employee: `.loading-spinner` + `@keyframes spin` entfernt (Dead CSS)
  - login: 11 `.alert*` Selektoren entfernt (Dead CSS — Template nutzt `.toast*`)
- [x] Scoping-Muster:
  - survey-admin: MIXED — Sections scoped, Question/Option/Stats mit `:global()` (Child: SurveyFormModal)
  - admin-dashboard: Scoped + `:global(body:not(.loaded))` (FOUC prevention)
  - survey-employee: Scoped (rating-button, question-item, response-\* direkt im Template)
  - features: Scoped (plan-badge, addon-_, summary-_ direkt im Template)
  - vacation-rules: ALL `:global()` (Orchestrator — kein CSS im eigenen Template)
  - login: Scoped (back-button, login-\*, help-button direkt im Template)
  - kvp: Scoped + `:global()` für KvpCreateModal-Klassen + user-info-update.css inlined

### Session 4: Large Files (5 Dateien, ~2.838 Zeilen)

| #   | CSS-Datei                  | Zeilen | Svelte-Ziel                         |
| --- | -------------------------- | ------ | ----------------------------------- |
| 1   | tenant-deletion-status.css | 321    | tenant-deletion-status/+page.svelte |
| 2   | employee-dashboard.css     | 490    | employee-dashboard/+page.svelte     |
| 3   | signup.css                 | 559    | signup/+page.svelte                 |
| 4   | index.css                  | 734    | +page.svelte (Root Landing)         |
| 5   | calendar.css               | 734    | calendar/+page.svelte               |

**DoD Session 4:**

- [x] 5 CSS-Imports entfernt
- [x] 5 `<style>` Blöcke hinzugefügt/erweitert
- [x] 5 CSS-Dateien gelöscht
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] svelte-check: 0 Errors, 0 Warnings (`pnpm exec svelte-check` ✓)
- [x] 6 Unused CSS Selektoren entfernt:
  - index: `.subdomain-suffix`, `.signup-modal small/label/input[checkbox]`, `.form-name-grid` (2x) — Dead CSS aus altem Modal
  - tenant-deletion-status: `.progress-section` + `.progress-section h4` — Dead CSS (kein Element im Template)
- [x] Scoping-Muster:
  - tenant-deletion-status: Scoped (alle Elemente im Template), `.action-buttons :global(.btn)` nur in responsive
  - employee-dashboard: Scoped + `@keyframes float/float-down` auto-scoped
  - signup: Scoped + `:global(body:has(#signupForm))` (Body-Targeting), dead `@keyframes fade-in-up` entfernt
  - index: Scoped (alles im Template), `.hero > :global(*)` für z-index auf Kinder
  - calendar: ALL `:global()` — Orchestrator-Muster (90%+ zielt auf @event-calendar Library + Child-Komponenten)

### Session 5: XL Files (3 Dateien, ~3.829 Zeilen)

| #   | CSS-Datei              | Zeilen | Svelte-Ziel          |
| --- | ---------------------- | ------ | -------------------- |
| 1   | chat.css               | 1.161  | chat/+page.svelte    |
| 2   | unified-navigation.css | 1.319  | (app)/+layout.svelte |
| 3   | shifts.css             | 1.349  | shifts/+page.svelte  |

**Achtung:** Diese 3 Dateien sind massiv. Besondere Sorgfalt bei `:global()` nötig, da Navigation-CSS auf Child-Routen wirken muss.

**Nested `@import` Handling:**

- `unified-navigation.css` hat 2 `@import`s: `modal.base.css` und `confirm-modal.css` — beide sind bereits global geladen via `app.css → design-system/index.css`. **Zeilen entfernen**, nicht inlinen.
- `blackboard.css` (Phase 2, Session 10) hat `@import '../design-system/primitives/sticky-note/sticky-note.css'` — ebenfalls bereits global geladen. **Zeile entfernen**.

**DoD Session 5:**

- [x] 3 CSS-Imports entfernt (chat, shifts, unified-navigation)
- [x] 3 `<style>` Blöcke hinzugefügt (ALL `:global()` — Orchestrator pattern)
- [x] 3 CSS-Dateien gelöscht (chat.css, shifts.css, unified-navigation.css)
- [x] 2 `@import`-Zeilen entfernt aus unified-navigation.css (modal.base.css, confirm-modal.css)
- [x] `html:not(.dark)` und `body:has()` Selektoren korrekt mit `:global()` gewrapped
- [x] `@keyframes` mit `-global-` Prefix (pulse-banner, typing-bounce, pulse-warning)
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] svelte-check: 0 Errors, 0 Warnings ✓
- [x] **Phase 1 ABGESCHLOSSEN!** Alle 29 1:1 CSS-Dateien migriert.

### Phase 1 — Definition of Done

- [ ] 29 CSS-Dateien in `<style>` Blöcke verschoben (+ `user-info-update.css` inline in kvp.css)
- [ ] 30 CSS-Dateien gelöscht (29 + `user-info-update.css`)
- [ ] 29 Import-Zeilen entfernt
- [ ] 3 nested `@import`-Zeilen entfernt (kvp.css, unified-navigation.css)
- [ ] Frontend kompiliert fehlerfrei (`pnpm run dev:svelte`)
- [ ] ESLint-Check: `cd frontend && pnpm run lint` (Fehler nur durch max-lines, keine funktionalen Fehler)
- [ ] Alle Seiten visuell geprüft (kein CSS-Bruch)

---

## Phase 2: Geteilte CSS-Dateien → Svelte-Komponenten (5 Dateien)

> **Abhängigkeit:** Phase 1 complete
> **Prinzip:** CSS die in mehreren Seiten importiert wird → eigene Svelte-Komponente mit eigenem `<style>`

### Session 6: logs.css → LogsFilter Komponente (97 Zeilen)

**Aktuell importiert in:**

- `(root)/logs/+page.svelte`
- `(root)/root-dashboard/+page.svelte`

**Aktion:** CSS in beide Svelte-Seiten als `<style>` kopieren (nur 97 Zeilen, Duplikation vertretbar). CSS-Datei löschen.

**Alternative:** Wenn die Styles an ein gemeinsames Markup gebunden sind → `LogsFilter.svelte` Komponente in `$lib/components/`.

**DoD Session 6:**

- [x] 2 CSS-Imports entfernt (logs/+page.svelte, root-dashboard/+page.svelte)
- [x] 1 `<style>` Block hinzugefügt (logs), 1 erweitert (root-dashboard)
- [x] 1 CSS-Datei gelöscht (logs.css)
- [x] CSS sauber aufgeteilt: `#activity-logs-table` Selektoren → root-dashboard, `.data-table` Selektoren → logs
- [x] Scoping: Fully scoped, kein `:global()` nötig
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] svelte-check: 0 Errors, 0 Warnings ✓

### Session 7: password-strength.css → PasswordStrengthIndicator.svelte (219 Zeilen)

**Aktuell importiert in 7 Seiten:**

- `signup/+page.svelte`
- `manage-admins/+page.svelte`
- `manage-root/+page.svelte`
- `root-profile/+page.svelte`
- `admin-profile/+page.svelte`
- `manage-employees/+page.svelte`
- `employee-profile/+page.svelte`

**Aktion:**

1. Neues `frontend/src/lib/components/PasswordStrengthIndicator.svelte` erstellen
2. HTML-Markup für Password-Strength aus allen 7 Seiten extrahieren
3. CSS (219 Zeilen) in `<style>` der neuen Komponente
4. Props definieren: `score`, `feedback`, `crackTime`, `isLoading`
5. Alle 7 Seiten: Import der Komponente statt CSS + Markup
6. `password-strength.css` löschen

**DoD Session 7:**

- [x] 7 CSS-Imports entfernt (4 Seiten + 3 Parent-Seiten die nur für Cascade importierten)
- [x] `PasswordStrengthIndicator.svelte` erstellt in `$lib/components/` mit vollständigem scoped CSS (219 Zeilen)
- [x] Komponente in 7 Dateien eingebunden (4 Seiten direkt + 3 Child-Modals)
- [x] 3 Dead-Code derived Variablen entfernt (employee-profile: hasWarning, hasSuggestions, hasPasswordFeedback)
- [x] 1 CSS-Datei gelöscht (password-strength.css)
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] svelte-check: 0 neue Errors (2 pre-existing in kvp-categories, unrelated)

### Session 8: vacation.css → Scoped in beide Seiten (411 Zeilen)

**Aktuell importiert in:**

- `(admin)/vacation/overview/+page.svelte`
- `(shared)/vacation/+page.svelte`

**Aktion:** Analyse welche CSS-Klassen wo genutzt werden. Nicht-geteilte Klassen direkt in jeweilige Seite. Geteilte Klassen → gemeinsame Komponente in `vacation/_lib/`.

**DoD Session 8:**

- [x] 2 CSS-Imports entfernt (overview/+page.svelte, shared/vacation/+page.svelte)
- [x] Klassen sauber aufgeteilt: Calendar/Legend/Blackout → overview, Filter/Request/Detail/Balance → shared
- [x] Dead CSS identifiziert: `.balance-stat*` Klassen waren Duplikat (bereits scoped in EntitlementBadge.svelte)
- [x] `:global()` für Design-System Dropdown-Selektoren korrekt eingesetzt
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] CSS-Datei gelöscht (vacation.css) ✓

### Session 9: kvp-detail.css → Scoped + Komponenten (531 Zeilen)

**Aktuell importiert in:**

- `(shared)/kvp-detail/+page.svelte`
- `(shared)/blackboard/[uuid]/+page.svelte`

**Aktion:** Analyse der geteilten Klassen. Statt DetailLayout-Komponente: Styles direkt in jede Seite + Child-Komponenten scoped.

**DoD Session 9:**

- [x] 2 CSS-Imports entfernt (kvp-detail/+page.svelte, blackboard/[uuid]/+page.svelte)
- [x] 3 Child-Komponenten mit eigenen `<style>` Blöcken versehen:
  - CommentsSection.svelte (7 comment-\* Klassen)
  - DetailSidebar.svelte (sidebar, attachment, action Klassen)
  - ShareModal.svelte (`:global()` Dropdown-Overrides)
- [x] Geteilte Layout-Klassen (detail-container, detail-main, etc.) in beide Seiten dupliziert
- [x] Seiten-spezifische Klassen korrekt zugewiesen (lightbox → kvp-detail, expires → blackboard)
- [x] `:global()` für Design-System Klassen und Child-Elemente korrekt eingesetzt
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] CSS-Datei gelöscht (kvp-detail.css) ✓

### Session 10: blackboard.css → Scoped + Komponenten (921 Zeilen)

**Aktuell importiert in:**

- `(shared)/blackboard/+page.svelte`
- `(shared)/blackboard/_lib/BlackboardEditModal.svelte`

**Aktion:** Beide Dateien sind im selben Modul. CSS aufteilen + massiver Dead-CSS-Cleanup.

**DoD Session 10:**

- [x] 2 CSS-Imports entfernt (+page.svelte, BlackboardEditModal.svelte)
- [x] 4 Komponenten mit scoped Styles versehen:
  - +page.svelte (container, cork texture, pinboard-grid, zoom, fullscreen)
  - BlackboardEntry.svelte (pinboard-item)
  - BlackboardEntryModal.svelte (color-picker + swatch variants)
  - BlackboardEditModal.svelte (Import entfernt, keine eigenen Klassen)
- [x] ~600+ Zeilen Dead CSS identifiziert und NICHT migriert (legacy entry-card, entry-detail-_, search-_, badge level-_, progress-bar-_, etc.)
- [x] `:global()` für fullscreen body-Selektoren + light-mode cork texture
- [x] `@import sticky-note.css` redundant — bereits in Design System index.css
- [x] Frontend kompiliert fehlerfrei (`pnpm run build` ✓)
- [x] CSS-Datei gelöscht (blackboard.css) ✓

### Phase 2 — Definition of Done

- [x] 3 CSS-Dateien gelöscht (vacation.css, kvp-detail.css, blackboard.css) ✓
- [x] `PasswordStrengthIndicator.svelte` erstellt und in 7 Seiten eingebunden (Session 7)
- [x] Alle geteilten Styles aufgelöst (scoped oder in Child-Komponenten)
- [x] 0 externe CSS-Imports verbleibend (Grep-Verifikation ✓)
- [x] Frontend kompiliert fehlerfrei
- [ ] Visueller Check aller betroffenen Seiten

---

## Phase 3: Cleanup + Verifikation

### Session 11: Finale Verifikation

- [x] `grep -r "import.*styles/.*\.css" frontend/src/routes/` = 0 Treffer ✓
- [x] 3 CSS-Dateien gelöscht: vacation.css, kvp-detail.css, blackboard.css ✓
- [x] `ls frontend/src/styles/` = nur `tailwind.css`, `style.css`, `alerts.css`, `blackboard-widget.css`, `lib/` und `tailwind/` ✓
- [ ] Alle Seiten visuell geprüft (systematisch durchklicken)
- [ ] ESLint: `cd frontend && pnpm run lint`
- [ ] svelte-check: `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json`

### Session 12: Dokumentation

- [x] TODO.md Abschnitt "CSS Scoping" als erledigt markiert ✓
- [x] PROJEKTSTRUKTUR.md existiert nicht — kein Update nötig

---

## Übersicht: CSS-Dateien die NICHT migriert werden

Diese Dateien bleiben in `frontend/src/styles/`:

| Datei                     | Grund                                                |
| ------------------------- | ---------------------------------------------------- |
| `tailwind.css`            | Tailwind v4 Entry Point — globales Styling           |
| `style.css`               | Legacy globale Styles (separate Migration nötig)     |
| `alerts.css`              | Globale Alert-Styles (Utility, nicht seitengebunden) |
| `blackboard-widget.css`   | Global importiert in `app.css` — Dashboard-Widget    |
| `lib/fontawesome.min.css` | FontAwesome Icons — global importiert in `app.css`   |
| `tailwind/`               | Tailwind Layer-Dateien (base, components, utilities) |

---

## Metriken

| Metrik                    | Geplant |
| ------------------------- | ------- |
| Sessions                  | 12      |
| CSS-Dateien migriert      | 34      |
| CSS-Dateien gelöscht      | 35      |
| CSS-Zeilen verschoben     | ~11.791 |
| Neue Komponenten          | 1-3     |
| Betroffene Svelte-Dateien | 34      |

> **35 gelöscht, 34 migriert:** `user-info-update.css` wird nicht eigenständig migriert, sondern inline in `kvp.css` absorbiert und dann gelöscht.

---

## Known Limitations (V1)

1. **max-lines Limit wird überschritten** — Bewusste Entscheidung. Wird vom User erhöht. Komponenten-Splitting kommt danach als separates Projekt.
2. **Kein Refactoring des CSS selbst** — CSS wird 1:1 verschoben, nicht optimiert oder modernisiert.
3. **Kein Komponenten-Splitting** — Nur CSS verschieben. Aufteilen in Sub-Komponenten ist ein separater Task.
4. **`:global()` möglicherweise nötig** — Einige CSS-Regeln zielen auf Design-System-Klassen oder Child-Elemente. Diese brauchen `:global()` um weiter zu funktionieren.

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
