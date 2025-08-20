# Dropdown CSS Bug Fix - Admin Dashboard

## Problem #1: CSS Klassen-Problem (10.02.2025)

Dropdowns in Employee Modal reagierten nicht auf Klicks - blieben unsichtbar trotz korrekter JavaScript-Logik.

### Ursache

JavaScript fügte Klasse `.active` hinzu, aber CSS definierte nur `.dropdown-options.show`, nicht `.dropdown-options.active`.

### Lösung

CSS-Regel für `.active` hinzugefügt in admin-dashboard.html (Zeile ~1630):

```css
.dropdown-options.active {
  opacity: 100%;
  visibility: visible;
  transform: translateY(0);
}
```

---

## Problem #2: ID-Kollision bei Status Dropdown (11.02.2025)

### Symptome

- Status Dropdown öffnete sich nicht trotz korrekter JavaScript-Ausführung
- Console zeigte "toggleStatusDropdown called" und "Status dropdown opened"
- Dropdown blieb aber unsichtbar

### Root Cause Analyse

**Es gab ZWEI verschiedene Dropdowns mit identischen/ähnlichen IDs:**

1. **Zeile 1098-1120**: "Employee Status Modal" (separates Modal)
   - IDs: `employee-status-display`, `employee-status-dropdown`
   - Zweck: Verfügbarkeitsstatus (available, vacation, sick)

2. **Zeile 1333-1360**: "Employee Create Modal" (das eigentliche Problem)
   - IDs: `employee-status-display`, `employee-status-dropdown`
   - Zweck: Aktiv/Inaktiv Status für neue Mitarbeiter

### Das Problem

- Beide Dropdowns verwendeten die gleichen IDs
- JavaScript-Funktionen griffen auf das FALSCHE Element zu
- Das erste Dropdown (Zeile 1098) wurde manipuliert statt das zweite (Zeile 1333)

### Lösung

**Eindeutige IDs für das Aktiv/Inaktiv Dropdown vergeben:**

```html
<!-- Vorher (kollidierend): -->
<div id="employee-status-display">
  <div id="employee-status-dropdown">
    <input id="employee-status-select" />

    <!-- Nachher (eindeutig): -->
    <div id="employee-active-status-display">
      <div id="employee-active-status-dropdown">
        <input id="employee-active-status-select" />
      </div>
    </div>
  </div>
</div>
```

**Neue dedizierte JavaScript-Funktionen:**

```javascript
window.toggleActiveStatusDropdown = function() { ... }
window.selectActiveStatusOption = function(value, text) { ... }
```

## Lessons Learned

1. **IMMER eindeutige IDs verwenden** - Besonders bei mehreren Modals/Formularen
2. **ID-Kollisionen prüfen** mit Browser DevTools:

   ```javascript
   document.querySelectorAll('[id="employee-status-dropdown"]').length;
   // Sollte 1 sein, nicht 2!
   ```

3. **Namenskonvention für ähnliche Komponenten:**
   - `employee-availability-*` für Verfügbarkeitsstatus
   - `employee-active-status-*` für Aktiv/Inaktiv
   - `employee-work-status-*` für Arbeitsstatus

## Debugging-Tipps

Wenn ein Dropdown nicht funktioniert:

1. Prüfe ob die ID eindeutig ist
2. Prüfe ob CSS-Klassen definiert sind (`.active`, `.show`)
3. Logge das gefundene Element:

   ```javascript
   console.info('Element:', document.getElementById('dropdown-id'));
   console.info('Classes:', element.className);
   ```

4. Verwende Browser DevTools Element-Inspektor während des Klicks

## Betroffene Dateien

- `/frontend/src/pages/admin-dashboard.html`
- Alle Modals mit Custom-Dropdowns

**Datum:** 10.02.2025 (Problem #1), 11.02.2025 (Problem #2)
**Debugging-Zeit:** ~2 Stunden
**Root Cause:** ID-Kollision zwischen zwei verschiedenen Status-Dropdowns
