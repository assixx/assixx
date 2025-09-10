# Header User-Info Problem - Dokumentation

## Problem-Beschreibung (09.01.2025)

Auf der blackboard.html Seite wurden das Profilbild und die Role-Badge im Header nicht angezeigt, obwohl sie im HTML vorhanden waren.

### Symptome

- Avatar und Role-Badge waren für ~1ms sichtbar beim Laden der Seite
- Danach verschwanden sie komplett
- Console logs zeigten: `Elements found: { userNameElement: false, userAvatar: false, roleIndicator: false }`
- Das `user-info` div hatte 0 Kinder und nur Text-Content: `Son Goku`

## Ursache

Mehrere Scripts manipulierten gleichzeitig das `user-info` Element:

1. Ein unbekanntes Script überschrieb `innerHTML` des user-info divs mit nur dem Benutzernamen
2. Dadurch wurden alle Child-Elemente (img#user-avatar, span#user-name, span#role-indicator) gelöscht
3. Timing-Konflikt zwischen verschiedenen Scripts

## Lösung

### 1. MutationObserver zum Schutz (in blackboard.html)

```javascript
window.addEventListener('DOMContentLoaded', function () {
  const userInfoDiv = document.querySelector('user-info');
  const userAvatar = document.querySelector('user-avatar');
  const userName = document.querySelector('user-name');
  const roleIndicator = document.querySelector('role-indicator');

  if (userInfoDiv) {
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'childList' && mutation.target.id === 'user-info') {
          if (userInfoDiv.children.length === 0) {
            console.info('[Blackboard] Restoring user-info elements');
            userInfoDiv.innerHTML = '';
            if (userAvatar) userInfoDiv.appendChild(userAvatar);
            if (userName) userInfoDiv.appendChild(userName);
            if (roleIndicator) userInfoDiv.appendChild(roleIndicator);
          }
        }
      });
    });

    observer.observe(userInfoDiv, { childList: true, subtree: false });
  }
});
```

### 2. Script-Reihenfolge geändert

```html
<!-- Vorher: -->
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
<script type="module" src="/scripts/blackboard.ts"></script>

<!-- Nachher: -->
<script type="module" src="/scripts/blackboard.ts"></script>
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
```

### 3. Struktur-Wiederherstellung in loadHeaderUserInfo()

```typescript
// Check if user-info has been overwritten
const userInfoDiv = document.querySelector('user-info');
if (userInfoDiv && userInfoDiv.children.length === 0) {
  console.info('[Blackboard] Restoring user-info structure...');
  userInfoDiv.innerHTML = `
    <img id="user-avatar" src="/assets/images/default-avatar.svg" alt="Avatar" style="display: block !important; visibility: visible !important;" />
    <span id="user-name" style="display: inline !important; visibility: visible !important;">Lade...</span>
    <span id="role-indicator" class="role-badge admin" style="display: inline-flex !important; visibility: visible !important;">Admin</span>
  `;
}
```

## Lessons Learned

1. **Script-Konflikte**: Bei mehreren Scripts, die dasselbe DOM-Element manipulieren, auf Reihenfolge achten
2. **MutationObserver**: Nützlich zum Schutz kritischer DOM-Strukturen
3. **Defensive Programmierung**: Immer prüfen, ob DOM-Struktur intakt ist, bevor man sie verwendet
4. **Debug-Logs**: Hilfreich zur Diagnose von DOM-Manipulationsproblemen

## Betroffene Dateien

- `/frontend/src/pages/blackboard.html` - MutationObserver und Script-Reihenfolge
- `/frontend/src/scripts/blackboard.ts` - loadHeaderUserInfo() Funktion mit Wiederherstellung
- `/frontend/src/styles/user-info-update.css` - Inline-Styles mit !important hinzugefügt

## Status

✅ GELÖST (09.01.2025)

---

## Problem-Beschreibung 2 (10.01.2025) - Calendar.html

Auf der calendar.html Seite fehlten der Role Switch Button und die Role Badge komplett im Header.

### Symptome

- Kein Role Switch Button vorhanden
- Role Badge (`<span id="role-indicator">`) fehlte im user-info div
- Nur Avatar und Username wurden angezeigt
- Header sah anders aus als bei admin-dashboard.html

### Ursache

1. **Fehlende HTML-Elemente**: Die Header-Struktur war unvollständig
2. **Fehlende Scripts**: role-switch.ts wurde nicht geladen
3. **Fehlende Navigation**: unified-navigation.ts wurde nicht eingebunden

## Lösung für Calendar.html

### 1. Vollständige Header-Struktur hinzugefügt

```html
<div class="header-actions">
  <!-- Role Switch Button -->
  <button id="role-switch-btn" class="btn-role-switch" title="Als Mitarbeiter anzeigen">
    <i class="fas fa-exchange-alt"></i>
    <span class="role-switch-text">Als Mitarbeiter</span>
  </button>

  <div id="user-info">
    <img id="user-avatar" src="/assets/images/default-avatar.svg" alt="Avatar" />
    <span id="user-name">Lade...</span>
    <span id="role-indicator" class="role-badge admin">Admin</span>
  </div>
  <button id="logout-btn" class="btn-logout" class="btn btn-secondary">
    <i class="fas fa-sign-out-alt"></i>
    Abmelden
  </button>
</div>
```

### 2. Erweiterter MutationObserver

```javascript
window.addEventListener('DOMContentLoaded', function () {
  const userInfoDiv = document.querySelector('user-info');

  if (userInfoDiv) {
    // Speichere Referenzen zu den Original-Elementen
    const originalAvatar = document.querySelector('user-avatar');
    const originalUserName = document.querySelector('user-name');
    const originalRoleIndicator = document.querySelector('role-indicator');

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'childList' && mutation.target.id === 'user-info') {
          // Prüfe ob alle 3 Elemente vorhanden sind
          const currentAvatar = document.querySelector('user-avatar');
          const currentUserName = document.querySelector('user-name');
          const currentRoleIndicator = document.querySelector('role-indicator');

          if (!currentAvatar || !currentUserName || !currentRoleIndicator) {
            console.info('[Calendar] Restoring user-info elements');
            userInfoDiv.innerHTML = '';

            // Alle 3 Elemente wiederherstellen
            // Avatar, Username und Role Badge
          }
        }
      });
    });

    observer.observe(userInfoDiv, { childList: true, subtree: false });
  }
});
```

### 3. Korrekte Script-Reihenfolge

```html
<!-- Scripts in richtiger Reihenfolge -->
<script type="module" src="/scripts/calendar.ts"></script>
<!-- Header User Info Loading -->
<script type="module" src="/scripts/header-user-info.ts"></script>
<!-- Role Switch Functionality -->
<script type="module" src="/scripts/role-switch.ts"></script>
<!-- Unified Navigation NACH calendar.ts -->
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
```

## Wichtige Erkenntnisse

1. **Header-Konsistenz**: Alle Seiten sollten die gleiche Header-Struktur haben
2. **Script-Abhängigkeiten**: role-switch.ts ist notwendig für die Role Switch Funktionalität
3. **Element-Schutz**: MutationObserver muss alle Header-Elemente schützen (Avatar, Name, Badge)

## Betroffene Dateien (Update)

- `/frontend/src/pages/calendar.html` - Vollständige Header-Struktur und Scripts
- `/frontend/src/scripts/header-user-info.ts` - avatarElement Variable Definition gefixt

## Status

✅ BEIDE PROBLEME GELÖST (10.01.2025)

---

## Problem-Beschreibung 3 (21.06.2025) - KVP-Seiten Header-Problem

Auf den neuen KVP-Seiten (kvp-new.html und kvp-detail.html) war der Header komplett falsch dargestellt.

### Symptome

- Role-Switch Button war neben dem Logo statt rechts im Header
- Profilbild war überdimensional groß
- Header-Layout stimmte nicht mit anderen Seiten überein
- Console zeigte: `[UnifiedNav] Using cached loadUserInfo` aber Header war trotzdem falsch

### Ursache

1. **Falsche CSS-Lade-Methode**:
   - KVP-Seiten nutzten `<link rel="stylesheet">` Tags
   - Funktionierende Seiten nutzen `@import` innerhalb eines `<style>` Tags

2. **Falsche Script-Reihenfolge**:
   - `unified-navigation.ts` wurde VOR den Seiten-Scripts geladen
   - `role-switch.ts` wurde separat geladen (unnötig)

3. **Fehlende CSS-Datei**:
   - `user-info-update.css` wurde nicht geladen

## Lösung für KVP-Seiten

### 1. CSS mit @import laden (WICHTIG!)

```html
<!-- FALSCH - führt zu Header-Problemen -->
<link rel="stylesheet" href="/styles/dashboard-theme.css" />
<link rel="stylesheet" href="/styles/user-info-update.css" />

<!-- RICHTIG - so funktioniert es -->
<style>
  @import url('/styles/dashboard-theme.css');
  @import url('/styles/user-info-update.css');
  /* Weitere Seiten-spezifische Styles */
</style>
```

### 2. Korrekte Script-Reihenfolge (unified-navigation.ts als LETZTES!)

```html
<!-- FALSCH - Header wird falsch dargestellt -->
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
<script type="module" src="/scripts/auth.ts"></script>
<script type="module" src="/scripts/pages/kvp.ts"></script>
<script type="module" src="/scripts/role-switch.ts"></script>

<!-- RICHTIG - Header funktioniert perfekt -->
<script type="module" src="/scripts/auth.ts"></script>
<script type="module" src="/scripts/pages/kvp.ts"></script>
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
<!-- Kein separates role-switch.ts nötig! -->
```

### 3. Vollständiges funktionierendes Beispiel (documents-search.html als Vorlage)

```html
<head>
  <!-- Font Awesome zuerst -->
  <link rel="stylesheet" href="/styles/lib/fontawesome.min.css" />

  <!-- Alle anderen CSS mit @import -->
  <style>
    @import url('/styles/dashboard-theme.css');
    @import url('/styles/user-info-update.css');
    /* Seiten-spezifische Styles hier */
  </style>
</head>
<body>
  <!-- Navigation Container -->
  <div id="navigation-container"></div>

  <!-- Main Content -->
  <div class="layout-container">
    <main class="main-content">
      <!-- Seiten-Inhalt -->
    </main>
  </div>

  <!-- Scripts in DIESER Reihenfolge -->
  <script type="module" src="/scripts/auth.ts"></script>
  <script type="module" src="/scripts/pages/[seiten-script].ts"></script>
  <script type="module" src="/scripts/components/unified-navigation.ts"></script>
</body>
```

## Wichtige Erkenntnisse für neue Seiten

1. **IMMER @import verwenden** für CSS (außer fontawesome.min.css)
2. **unified-navigation.ts IMMER als letztes Script** laden
3. **Kein separates role-switch.ts** - wird von unified-navigation gehandhabt
4. **user-info-update.css ist PFLICHT** für korrekten Header
5. **Script-Reihenfolge**: auth.ts → seiten-script.ts → unified-navigation.ts

## Debugging-Tipps

Wenn der Header falsch aussieht:

1. Prüfe ob CSS mit `@import` geladen wird (nicht `<link>`)
2. Prüfe ob `unified-navigation.ts` als LETZTES Script geladen wird
3. Prüfe ob `user-info-update.css` importiert wird
4. Vergleiche mit einer funktionierenden Seite wie `documents-search.html`

## Betroffene Dateien (Update 21.06.2025)

- `/frontend/src/pages/kvp-new.html` - CSS-Methode und Script-Reihenfolge korrigiert
- `/frontend/src/pages/kvp-detail.html` - CSS-Methode und Script-Reihenfolge korrigiert

## Status

✅ ALLE DREI PROBLEME GELÖST (21.06.2025)

---

## Problem-Beschreibung 4 (23.06.2025) - Blackboard.html Race Condition

Auf der blackboard.html Seite gab es ein komplexes Problem mit gegenseitig ausschließenden Fehlern.

### Symptome

- **Mit statischer Script-Reihenfolge**: Blackboard-Einträge ✓, aber Profilbild ✗
- **Mit dynamischer Script-Reihenfolge**: Profilbild ✓, aber Blackboard-Einträge ✗
- Build zeigte manchmal 145, manchmal 146 transformierte Module
- `user-info` div wurde mit reinem Text "Son Goku" überschrieben

### Ursachen

1. **CSS-Import-Methode** (Hauptproblem für fehlendes Profilbild):
   - `user-info-update.css` wurde mit `<link>` statt `@import` geladen
   - Dies führte zu Timing-Problemen beim Header-Rendering

2. **Race Condition im blackboard.ts**:
   - Script wartete auf `DOMContentLoaded` Event
   - Bei dynamischem Import war das Event bereits vorbei
   - Code wurde nie ausgeführt → Keine Einträge geladen

3. **Script-Konflikte**:
   - Mehrere Scripts manipulierten das `user-info` Element
   - Je nach Lade-Reihenfolge überschrieb ein Script die korrekte Struktur

## Lösung für Blackboard.html

### 1. CSS korrekt mit @import laden

```html
<!-- Vorher (FALSCH): -->
<style>
  @import url('/styles/dashboard-theme.css');
  @import url('/styles/blackboard.css');
  @import url('/styles/blackboard-update.css');
</style>
<!-- ... später im Code ... -->
<link rel="stylesheet" href="/styles/user-info-update.css" />

<!-- Nachher (RICHTIG): -->
<style>
  @import url('/styles/dashboard-theme.css');
  @import url('/styles/blackboard.css');
  @import url('/styles/blackboard-update.css');
  @import url('/styles/user-info-update.css');
</style>
```

### 2. Race Condition in blackboard.ts beheben

```typescript
// Vorher (PROBLEM):
document.addEventListener('DOMContentLoaded', () => {
  // Code wird nicht ausgeführt wenn Script verzögert geladen wird
});

// Nachher (LÖSUNG):
function initializeBlackboard() {
  // Initialisierungs-Code hier
}

// Prüfe ob DOM bereits ready ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBlackboard);
} else {
  // DOM ist bereits ready, führe direkt aus
  initializeBlackboard();
}
```

### 3. Dynamisches Script-Loading beibehalten

```html
<script type="module">
  document.addEventListener('DOMContentLoaded', async () => {
    // Lade Scripts in korrekter Reihenfolge mit Verzögerung
    await import('/scripts/auth.ts');
    await import('/scripts/components/unified-navigation.ts');
    setTimeout(() => {
      import('/scripts/blackboard.ts');
    }, 100);
  });
</script>
```

## Wichtige Erkenntnisse

1. **Gekoppelte Fehler**: Die Lösung eines Problems verursachte das andere
2. **Module-Count als Indikator**: 145 vs 146 Module zeigten fehlende Script-Ladung an
3. **CSS-Import ist kritisch**: NIEMALS `<link>` für kritische Header-CSS verwenden
4. **Race Conditions beachten**: Bei dynamischem Script-Loading immer `document.readyState` prüfen

## Debugging-Strategie für ähnliche Probleme

1. **Build-Output prüfen**: Anzahl transformierter Module beachten
2. **Console-Logs analysieren**: Auf Script-Lade-Reihenfolge achten
3. **DOM-Mutations beobachten**: MutationObserver kann helfen, Überschreibungen zu finden
4. **Beide Szenarien testen**: Statisches und dynamisches Loading vergleichen

## Status

✅ ALLE VIER PROBLEME GELÖST (23.06.2025)
