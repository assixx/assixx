# ESLint Frontend Issues

> Stand: 2026-02-16 | Regel: `max-lines` (Maximum 700 Zeilen für `.svelte`)

## Übersicht

- **14 Dateien** über dem Limit (**14 erledigt** — ALLE DONE ✅)
- **~2.839 Zeilen** über Limit gesamt (vor Layout-Refactoring)
- Alle Verstöße: `max-lines` (File has too many lines)
- Kommentare und leere Zeilen zählen nicht mit

## Dateien nach Schwere

| #   | Datei                                          | Zeilen                            | Über Limit       | Priorität       | Status          |
| --- | ---------------------------------------------- | --------------------------------- | ---------------- | --------------- | --------------- |
| 1   | ~~`(app)/+layout.svelte`~~                     | ~~1473~~ → **576**                | ~~+773~~ → **0** | ~~🔴 Kritisch~~ | ✅ **ERLEDIGT** |
| 2   | ~~`(shared)/shifts/+page.svelte`~~             | ~~1404~~ → **489**                | ~~+704~~ → **0** | ~~🔴 Kritisch~~ | ✅ **ERLEDIGT** |
| 3   | ~~`routes/+page.svelte` (Landing)~~            | ~~1133~~ → **349**                | ~~+433~~ → **0** | ~~🔴 Kritisch~~ | ✅ **ERLEDIGT** |
| 4   | ~~`(shared)/vacation/+page.svelte`~~           | ~~1120~~ → **655**                | ~~+420~~ → **0** | ~~🔴 Kritisch~~ | ✅ **ERLEDIGT** |
| 5   | ~~`(shared)/calendar/+page.svelte`~~           | ~~1067~~ → **640**                | ~~+367~~ → **0** | ~~🔴 Kritisch~~ | ✅ **ERLEDIGT** |
| 6   | ~~`signup/+page.svelte`~~                      | ~~1051~~ → **627**                | ~~+351~~ → **0** | ~~🔴 Kritisch~~ | ✅ **ERLEDIGT** |
| 7   | ~~`(shared)/chat/+page.svelte`~~               | ~~1020~~ → **351**                | ~~+320~~ → **0** | ~~🔴 Kritisch~~ | ✅ **ERLEDIGT** |
| 8   | ~~`(shared)/kvp-detail/+page.svelte`~~         | ~~834~~ → **612**                 | ~~+134~~ → **0** | ~~🟡 Mittel~~   | ✅ **ERLEDIGT** |
| 9   | ~~`(shared)/employee-dashboard/+page.svelte`~~ | ~~823~~ → **602**                 | ~~+123~~ → **0** | ~~🟡 Mittel~~   | ✅ **ERLEDIGT** |
| 10  | ~~`(admin)/vacation/overview/+page.svelte`~~   | ~~802~~ → **495**                 | ~~+102~~ → **0** | ~~🟡 Mittel~~   | ✅ **ERLEDIGT** |
| 11  | ~~`(shared)/kvp/+page.svelte`~~                | ~~795~~ → **825** (effektiv <700) | ~~+95~~ → **0**  | ~~🟡 Mittel~~   | ✅ **ERLEDIGT** |
| 12  | ~~`(admin)/features/+page.svelte`~~            | ~~757~~ → **605**                 | ~~+57~~ → **0**  | ~~🟢 Leicht~~   | ✅ **ERLEDIGT** |
| 13  | ~~`(admin)/manage-machines/+page.svelte`~~     | ~~744~~ → **810** (effektiv <700) | ~~+44~~ → **0**  | ~~🟢 Leicht~~   | ✅ **ERLEDIGT** |
| 14  | ~~`(shared)/survey-employee/+page.svelte`~~    | ~~734~~ → **736** (effektiv <700) | ~~+34~~ → **0**  | ~~🟢 Leicht~~   | ✅ **ERLEDIGT** |
| 15  | ~~`(root)/root-profile/+page.svelte`~~         | ~~720~~ → **702**                 | ~~+20~~ → **0**  | ~~🟢 Leicht~~   | ✅ **ERLEDIGT** |

---

## Refactoring-Strategie

**Svelte Best Practice:** Jede Komponente besitzt ihre eigenen **scoped Styles**. KEINE separaten CSS-Dateien, KEIN `:global` vom Parent. Styles gehören IN die Komponente, die sie verwendet.

Referenz: https://svelte.dev/docs/svelte/scoped-styles

### Techniken

| Technik                                     | Wann                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| `_lib/`-Subkomponenten mit scoped Styles    | Große UI-Blöcke (Modals, Formulare, Tabellen, Sektionen) |
| `:global` CSS → scoped in Child verschieben | Parent stylt Kinder von außen (Anti-Pattern auflösen)    |
| `.svelte.ts` State-Dateien                  | Komplexe Reaktivität / Business-Logik                    |
| `{#snippet}`                                | Wiederholte Template-Blöcke innerhalb derselben Datei    |
| Utility-Funktionen (`.ts`)                  | Reine Datenverarbeitung, Formatter, Validierung          |

---

## Detailplan Top 3

### 1. `shifts/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

1233 Zeilen `:global` CSS aus dem Parent in 8 bestehende Child-Komponenten als scoped `<style>` verschoben. Zusätzlich `{#snippet}` in beiden Modals eingesetzt um wiederholte 3-Spalten Drop-Zone Templates zu deduplizieren.

**Ergebnis (tatsächlich):**

| Datei                        | Vorher | Nachher | Änderung          |
| ---------------------------- | ------ | ------- | ----------------- |
| `+page.svelte` (Parent)      | 1682   | **489** | -1193 Zeilen      |
| `ShiftScheduleGrid.svelte`   | 283    | 756     | +473 (CSS)        |
| `FilterDropdowns.svelte`     | 406    | 644     | +238 (CSS)        |
| `EmployeeSidebar.svelte`     | 132    | 374     | +242 (CSS)        |
| `ShiftControls.svelte`       | 98     | 154     | +56 (CSS)         |
| `WeekNavigation.svelte`      | 42     | 56      | +14 (CSS)         |
| `AdminActions.svelte`        | 134    | 143     | +9 (CSS)          |
| `CustomRotationModal.svelte` | 685    | 733     | +48 (CSS+snippet) |
| `RotationSetupModal.svelte`  | 695    | 765     | +70 (CSS+snippet) |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (alle 9 Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- Alle Styles scoped in Svelte-Komponenten ✅
- Parent behält nur: `.main-planning-area`, `.department-notice`, `.notice-icon` ✅

---

### 2. `+layout.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

1163 Zeilen `:global` CSS und 238 Zeilen Template aus dem Layout in 7 Komponenten extrahiert. Header, Banner, Modal als neue Komponenten; Sidebar-CSS als scoped Styles in `AppSidebar.svelte`; User-Card und Storage-Widget als Sub-Komponenten der Sidebar. Dead CSS eliminiert (`.sidebar-title`, `.sidebar-collapsed`, `.user-full-name`, `.user-employee-number`, `.mr-2`).

**Ergebnis (tatsächlich):**

| Datei                         | Vorher | Nachher | Änderung              |
| ----------------------------- | ------ | ------- | --------------------- |
| `+layout.svelte` (Parent)     | 1912   | **576** | -1336 Zeilen          |
| `AppHeader.svelte`            | NEU    | 350     | Header + CSS          |
| `AppSidebar.svelte`           | 380    | 801     | +421 (scoped CSS)     |
| `LogoutModal.svelte`          | NEU    | 51      | Modal (Design-System) |
| `RoleSwitchBanner.svelte`     | NEU    | 121     | Banner + CSS          |
| `SidebarUserCard.svelte`      | NEU    | 183     | User-Card + CSS       |
| `SidebarStorageWidget.svelte` | NEU    | 98      | Storage-Widget + CSS  |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (alle 7 Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- Alle Styles scoped in Svelte-Komponenten ✅
- Parent behält nur: `.layout-container`, `.sidebar-backdrop`, Cross-Component Logo-Selektor ✅

---

### 3. `routes/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

3 eigenständige Template-Sektionen (Features, Security, Pricing) MIT ihren scoped Styles in neue `_lib/` Komponenten extrahiert. Keine Props nötig — SecuritySection und PricingSection importieren `resolve` intern.

**Ergebnis (tatsächlich):**

| Datei                    | Vorher | Nachher | Änderung                   |
| ------------------------ | ------ | ------- | -------------------------- |
| `+page.svelte` (Parent)  | 1255   | **349** | -906 Zeilen                |
| `FeaturesGrid.svelte`    | NEU    | 140     | Features + CSS             |
| `SecuritySection.svelte` | NEU    | 293     | Security + CSS             |
| `PricingSection.svelte`  | NEU    | 536     | Pricing + Comparison + CSS |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (alle 4 Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- Alle Styles scoped in Svelte-Komponenten ✅
- Parent behält nur: Header, Hero, Footer, Modal + Responsive ✅

### 4. `(shared)/vacation/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

4 inline Modals (Create, Detail, Edit, Respond) aus dem Parent in eigenständige `_lib/` Komponenten extrahiert. RespondModal übernimmt eigene UI-State (responseNote, isSpecialLeave, respondCapacity) und fetcht Capacity-Analyse selbst on mount. CreateModal/EditModal wrappen RequestForm mit eigenem formRef. DetailModal enthält formatDate/getHalfDayInfo Helfer und detail-grid Styles. Parent-Respond-Logik vereinfacht: handleApproveClick+handleDenyClick → eine openRespondModal Funktion.

**Ergebnis (tatsächlich):**

| Datei                   | Vorher | Nachher | Änderung                     |
| ----------------------- | ------ | ------- | ---------------------------- |
| `+page.svelte` (Parent) | 1299   | **799** | -500 Zeilen (655 effektiv)   |
| `CreateModal.svelte`    | NEU    | 95      | Modal + formRef              |
| `EditModal.svelte`      | NEU    | 101     | Modal + formRef + edit-props |
| `DetailModal.svelte`    | NEU    | 212     | Detail-Grid + Helfer + CSS   |
| `RespondModal.svelte`   | NEU    | 183     | Capacity-Fetch + UI-State    |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (alle 5 Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- Alle Styles scoped in Svelte-Komponenten ✅
- Parent behält nur: filter-row, request-list, load-more, balance-summary, progress-bar ✅

### 5. `(shared)/calendar/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

~645 Zeilen `:global` CSS aus dem Parent in 3 Kinder verteilt. Neuer `CalendarView.svelte` Wrapper für `@event-calendar/core` mit allen ec-_ Library-Overrides, Shift/Vacation Indicators und Fullscreen-Mode Styles. EventList-Styles (event-item, event-date, event-level-_) als scoped CSS in `EventList.svelte` verschoben. EventDetailModal-Styles (detail-item, attendee-item:hover, #eventDetailContent Typografie) in `EventDetailModal.svelte` gemergt (Duplikate eliminiert). Parent exponiert refetch via Interface statt any-Typ.

**Ergebnis (tatsächlich):**

| Datei                     | Vorher | Nachher | Änderung                        |
| ------------------------- | ------ | ------- | ------------------------------- |
| `+page.svelte` (Parent)   | 1287   | **640** | -647 Zeilen (CSS verteilt)      |
| `CalendarView.svelte`     | NEU    | 423     | ec-\* + Indicators + Fullscreen |
| `EventList.svelte`        | 101    | 221     | +120 (scoped event-list CSS)    |
| `EventDetailModal.svelte` | 266    | 359     | +93 (merged detail CSS, dedupe) |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (alle 4 Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- ec-\* `:global` CSS lebt jetzt in CalendarView (neben dem Calendar-Component) ✅
- Parent behält nur: Legend CSS (scoped) ✅

---

### 6. `signup/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

4 neue `_lib/` Komponenten extrahiert: SubdomainInput (Subdomain-Feld + `.assixx.com` Suffix + Validierung), CountryPhoneInput (Telefon + Länder-Dropdown + click-outside + Emoji-Font), PlanSelect (Plan-Dropdown + click-outside), SignupNav (Zurück-Button + Hilfe-Button). Parent behält Form-Validierung (`isFormValid` derived), Submit-Handler und Layout-CSS. Kinder nutzen `$bindable()` für Two-Way-Binding mit Parent-State.

**Ergebnis (tatsächlich):**

| Datei                      | Vorher | Nachher | Änderung                           |
| -------------------------- | ------ | ------- | ---------------------------------- |
| `+page.svelte` (Parent)    | 1197   | **627** | -570 Zeilen                        |
| `SubdomainInput.svelte`    | NEU    | 106     | Subdomain + Validierung + CSS      |
| `CountryPhoneInput.svelte` | NEU    | 251     | Telefon + Länder-Dropdown + CSS    |
| `PlanSelect.svelte`        | NEU    | 183     | Plan-Dropdown + CSS                |
| `SignupNav.svelte`         | NEU    | 110     | Zurück-Button + Hilfe-Button + CSS |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (alle 5 Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- Alle Styles scoped in Svelte-Komponenten ✅
- Parent behält nur: body:has(#signupForm), Header, Form-Grid, Bottom-Section, Responsive ✅

**Hinweis:** ESLint `@typescript-eslint/no-useless-default-assignment` kollidiert mit Svelte `$bindable()` — Regel per eslint-disable mit Begründung unterdrückt. `$bindable()` ist ein Svelte-Semantic-Marker, kein JS-Default.

---

### 7. `(shared)/chat/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

~1100 Zeilen `:global` CSS aus dem Parent in 4 bestehende Child-Komponenten als scoped Styles verteilt. Neuer `ChatAttachment.svelte` extrahiert aus MessagesArea um Attachment-Rendering (modern + legacy + scheduled) zu kapseln und MessagesArea unter 700 Zeilen zu halten. Dead CSS eliminiert: `#chat-avatar`, `.status-indicator.*`, `.conversation-last-message`, `.message-avatar`, `.message-header`, `.message-sender`, `.message-meta`, `.message-status`, `.message.archived`. `:global()` nur noch für `{@html}`-injizierte Links/Search-Highlights in MessagesArea und dynamisch gesetzte `.sidebar-collapsed` Klasse in Parent.

**Ergebnis (tatsächlich):**

| Datei                     | Vorher | Nachher | Änderung                              |
| ------------------------- | ------ | ------- | ------------------------------------- |
| `+page.svelte` (Parent)   | 1273   | **351** | -922 Zeilen (CSS verteilt + dead CSS) |
| `ChatSidebar.svelte`      | 232    | 378     | +146 (scoped sidebar CSS)             |
| `ChatHeader.svelte`       | 144    | 231     | +87 (scoped header + search CSS)      |
| `MessageInputArea.svelte` | 148    | 363     | +215 (scoped input + file-preview)    |
| `MessagesArea.svelte`     | 658    | 629     | -29 (template shrunk, CSS added)      |
| `ChatAttachment.svelte`   | NEU    | 316     | Attachment rendering + scoped CSS     |

**Verifizierung:**

- `svelte-check --fail-on-warnings`: 0 Errors, 0 Warnings ✅
- `ESLint` (alle 6 Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- Alle Styles scoped in Svelte-Komponenten ✅
- Parent behält nur: page-layout, chat-container, chat-main, typing-indicator, connection-lost-banner, empty-state, keyframes ✅
- `:global()` minimal: `{@html}`-Links/Highlights in MessagesArea + `.sidebar-collapsed` in Parent ✅

---

### 8. `(shared)/kvp-detail/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

PhotoGallery.svelte als neue `_lib/` Komponente extrahiert. Enthält Thumbnail-Grid, Lightbox-Overlay mit Prev/Next-Navigation, Counter und Keyboard-Handling (Escape/ArrowLeft/ArrowRight). `authReady`-State für SSR-Hydration und `getAttachmentPreviewUrl` Import leben jetzt in PhotoGallery. Parent entfernt: `onMount`, `lightboxIndex`, `lightboxUrl`, `authReady`, 4 Handler-Funktionen, Photo-Template, Lightbox-Template, ~125 Zeilen CSS.

**Ergebnis (tatsächlich):**

| Datei                   | Vorher | Nachher | Änderung                        |
| ----------------------- | ------ | ------- | ------------------------------- |
| `+page.svelte` (Parent) | 1026   | **771** | -255 Zeilen (612 effektiv)      |
| `PhotoGallery.svelte`   | NEU    | 269     | Thumbnail-Grid + Lightbox + CSS |

**Verifizierung:**

- `svelte-check --fail-on-warnings`: 0 Errors, 0 Warnings ✅
- `ESLint` (beide Dateien): 0 Errors ✅
- KEINE separaten CSS-Dateien erstellt ✅
- Alle Styles scoped in Svelte-Komponenten ✅
- Parent behält nur: Layout, Header, Content-Sections, Data-List, Dropdown-Override, Responsive ✅

### 9. `(shared)/employee-dashboard/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

WelcomeHero.svelte bereits in vorheriger Session extrahiert. Verifiziert: 602 effektive Zeilen — unter 700, kein weiterer Eingriff nötig.

---

### 10. `(admin)/vacation/overview/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

Gesamte Kalender-Sektion (Template + CSS + Helfer-Funktionen) in CalendarGrid.svelte extrahiert. Keine Props nötig — liest direkt aus `overviewState`. Unnötige `:global()` auf `.info-item`, `.info-label`, `.dropdown` Selektoren entfernt (waren bereits im eigenen Template-Scope).

**Ergebnis (tatsächlich):**

| Datei                   | Vorher | Nachher | Änderung                         |
| ----------------------- | ------ | ------- | -------------------------------- |
| `+page.svelte` (Parent) | 968    | **495** | -473 Zeilen                      |
| `CalendarGrid.svelte`   | NEU    | 473     | Kalender-Template + CSS + Helfer |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (beide Dateien): 0 Errors ✅

---

### 11. `(shared)/kvp/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

`:global(.upload-box)` und `:global(.photo-preview-item)` CSS-Blöcke (~71 Zeilen) vom Parent in KvpCreateModal.svelte verschoben (Anti-Pattern: Parent stylt Kinder). Dead CSS entfernt: `.user-departments-badge` (6 Varianten, ~53 Zeilen), `.header-actions` — nicht im Template referenziert.

**Ergebnis (tatsächlich):**

| Datei                   | Vorher | Nachher                 | Änderung                      |
| ----------------------- | ------ | ----------------------- | ----------------------------- |
| `+page.svelte` (Parent) | 951    | **825** (effektiv <700) | -126 Zeilen                   |
| `KvpCreateModal.svelte` | 556    | 621                     | +65 (scoped upload/photo CSS) |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (beide Dateien): 0 Errors ✅

---

### 12. `(admin)/features/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

3 Addon-Resource-Cards (Mitarbeiter, Admins, Speicher) in AddonResources.svelte extrahiert. `adjustAddon`-Funktion lebt im Kind. `$bindable()` für Two-Way-Binding von `pendingAddons`. Addon-Card CSS, Light-Mode Override, Reduced-Motion Media Query — alles scoped im Kind.

**Ergebnis (tatsächlich):**

| Datei                   | Vorher | Nachher | Änderung            |
| ----------------------- | ------ | ------- | ------------------- |
| `+page.svelte` (Parent) | 877    | **605** | -272 Zeilen         |
| `AddonResources.svelte` | NEU    | 267     | 3 Addon-Cards + CSS |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (beide Dateien): 0 Errors ✅

---

### 13. `(admin)/manage-machines/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

Dropdown Multi-Select CSS (`.dropdown__menu--multi`, `.dropdown__option--checkbox`, etc.) in MachineFormModal.svelte verschoben. `:global()` von Search-Result Selektoren entfernt (waren im eigenen Template-Scope). `resolvePath`-Wrapper entfernt (direkt `resolve()` genutzt). `buildAvailabilityPayload` in `saveAvailability` inlined. `validateAvailabilityForm` als separate Funktion beibehalten (Complexity-Constraint max 10).

**Ergebnis (tatsächlich):**

| Datei                     | Vorher | Nachher                 | Änderung                  |
| ------------------------- | ------ | ----------------------- | ------------------------- |
| `+page.svelte` (Parent)   | 872    | **810** (effektiv <700) | -62 Zeilen                |
| `MachineFormModal.svelte` | 459    | ~510                    | +51 (scoped dropdown CSS) |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (beide Dateien): 0 Errors ✅

---

### 14. `(shared)/survey-employee/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

Response-Viewing-Modal (Antwort-Anzeige + CSS) in ResponseModal.svelte extrahiert. Ungenutzte Imports (`formatDateTimeGerman`, `formatSurveyDate`) aus Parent entfernt.

**Ergebnis (tatsächlich):**

| Datei                   | Vorher | Nachher                 | Änderung            |
| ----------------------- | ------ | ----------------------- | ------------------- |
| `+page.svelte` (Parent) | 867    | **736** (effektiv <700) | -131 Zeilen         |
| `ResponseModal.svelte`  | NEU    | 131                     | Antwort-Modal + CSS |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (beide Dateien): 0 Errors ✅

---

### 15. `(root)/root-profile/+page.svelte` — ✅ ERLEDIGT (2026-02-16)

**Was wurde gemacht:**

Approval-Sektion (Template + CSS + approve/reject-Funktionen) in ApprovalSection.svelte extrahiert. Dead CSS entfernt: `.profile-picture-container` (nicht im Template referenziert). Ungenutzte Imports entfernt: `formatDate`, `apiApproveRequest`, `apiRejectRequest`.

**Ergebnis (tatsächlich):**

| Datei                    | Vorher | Nachher | Änderung                          |
| ------------------------ | ------ | ------- | --------------------------------- |
| `+page.svelte` (Parent)  | 882    | **702** | -180 Zeilen                       |
| `ApprovalSection.svelte` | NEU    | 163     | Approval-Template + CSS + Actions |

**Verifizierung:**

- `svelte-check --threshold error`: 0 Errors ✅
- `ESLint` (beide Dateien): 0 Errors ✅

---

## svelte-check Warnings (Dead CSS) — Behoben 2026-02-16

Während des Refactorings wurden tote CSS-Selektoren identifiziert und entfernt:

| Datei                                | Toter Selektor         | Ursache                                                        | Fix                |
| ------------------------------------ | ---------------------- | -------------------------------------------------------------- | ------------------ |
| `shifts/_lib/FilterDropdowns.svelte` | `.favorites-header h3` | Markup verwendet `<span class="favorites-label">`, kein `<h3>` | CSS-Regel entfernt |
| `shifts/_lib/ShiftControls.svelte`   | `.rotation-edit-btn`   | Kein Element im Template nutzt diese Klasse                    | CSS-Regel entfernt |

**Verifizierung:** `svelte-check --threshold warning` — 0 Warnings nach Fix ✅

---

## Reihenfolge

1. ~~**shifts** — CSS in bestehende Kinder verteilen (meiste Wirkung, kein neuer Code)~~ ✅ ERLEDIGT
2. ~~**Landing** — Template+CSS in neue Komponenten (einfach, keine Props)~~ ✅ ERLEDIGT
3. ~~**Layout** — Template+CSS in neue Komponenten (komplex, viel State-Passing)~~ ✅ ERLEDIGT
4. ~~**Vacation** — 4 Modals in \_lib/ Komponenten (Template + State-Encapsulation)~~ ✅ ERLEDIGT
5. ~~**Calendar** — :global CSS in CalendarView + EventList + EventDetailModal verteilt~~ ✅ ERLEDIGT
6. ~~**Signup** — Template+CSS in 4 neue \_lib/ Komponenten (SubdomainInput, CountryPhoneInput, PlanSelect, SignupNav)~~ ✅ ERLEDIGT
7. ~~**Chat** — :global CSS in 4 bestehende Kinder + 1 neuer ChatAttachment.svelte verteilt~~ ✅ ERLEDIGT
8. ~~**kvp-detail** — PhotoGallery.svelte extrahiert (Lightbox + Thumbnail-Grid + authReady)~~ ✅ ERLEDIGT
9. ~~**employee-dashboard** — WelcomeHero.svelte bereits extrahiert, verifiziert 602 Zeilen~~ ✅ ERLEDIGT
10. ~~**vacation/overview** — CalendarGrid.svelte extrahiert (Kalender-Template + CSS + Helfer)~~ ✅ ERLEDIGT
11. ~~**kvp** — `:global()` Anti-Pattern aufgelöst + Dead CSS entfernt (upload-box → KvpCreateModal)~~ ✅ ERLEDIGT
12. ~~**features** — AddonResources.svelte extrahiert (3 Addon-Cards + $bindable + adjustAddon)~~ ✅ ERLEDIGT
13. ~~**manage-machines** — Dropdown-CSS → MachineFormModal + :global() → scoped + Code-Konsolidierung~~ ✅ ERLEDIGT
14. ~~**survey-employee** — ResponseModal.svelte extrahiert (Antwort-Viewing-Modal + CSS)~~ ✅ ERLEDIGT
15. ~~**root-profile** — ApprovalSection.svelte extrahiert (Approval-Template + CSS + Funktionen) + Dead CSS entfernt~~ ✅ ERLEDIGT

## Verifizierung (pro Datei)

1. `npx svelte-check --threshold error` — 0 Errors
2. `npx eslint <datei>` — 0 Errors (inkl. max-lines)
3. Visueller Check: `pnpm run dev:svelte` → http://localhost:5173
4. Responsive: Mobile (< 768px) + Tablet (< 1024px) + Desktop

## Definition of Done

- [x] `shifts/+page.svelte` < 700 Zeilen (ESLint) — **489 Zeilen, 0 ESLint Errors** ✅
- [x] `+layout.svelte` < 700 Zeilen (ESLint) — **576 Zeilen, 0 ESLint Errors** ✅
- [x] `routes/+page.svelte` < 700 Zeilen (ESLint) — **349 Zeilen, 0 ESLint Errors** ✅
- [x] `vacation/+page.svelte` < 700 Zeilen (ESLint) — **655 Zeilen, 0 ESLint Errors** ✅
- [x] `calendar/+page.svelte` < 700 Zeilen (ESLint) — **640 Zeilen, 0 ESLint Errors** ✅
- [x] `signup/+page.svelte` < 700 Zeilen (ESLint) — **627 Zeilen, 0 ESLint Errors** ✅
- [x] `chat/+page.svelte` < 700 Zeilen (ESLint) — **351 Zeilen, 0 ESLint Errors** ✅
- [x] `kvp-detail/+page.svelte` < 700 Zeilen (ESLint) — **612 Zeilen, 0 ESLint Errors** ✅
- [x] `employee-dashboard/+page.svelte` < 700 Zeilen (ESLint) — **602 Zeilen, 0 ESLint Errors** ✅
- [x] `vacation/overview/+page.svelte` < 700 Zeilen (ESLint) — **495 Zeilen, 0 ESLint Errors** ✅
- [x] `kvp/+page.svelte` < 700 Zeilen (ESLint) — **825 raw / <700 effektiv, 0 ESLint Errors** ✅
- [x] `features/+page.svelte` < 700 Zeilen (ESLint) — **605 Zeilen, 0 ESLint Errors** ✅
- [x] `manage-machines/+page.svelte` < 700 Zeilen (ESLint) — **810 raw / <700 effektiv, 0 ESLint Errors** ✅
- [x] `survey-employee/+page.svelte` < 700 Zeilen (ESLint) — **736 raw / <700 effektiv, 0 ESLint Errors** ✅
- [x] `root-profile/+page.svelte` < 700 Zeilen (ESLint) — **702 Zeilen, 0 ESLint Errors** ✅
- [x] KEINE separaten CSS-Dateien erstellt ✅
- [x] Alle Styles scoped in Svelte-Komponenten ✅
- [x] svelte-check 0 Errors (alle 14 Dateien + Kinder) ✅
- [x] ESLint 0 Errors (alle 14 Dateien + Kinder) ✅
- [ ] Visuell keine Änderungen (manueller Check ausstehend)
