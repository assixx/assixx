# Bug Report: ID Mismatch zwischen HTML und kompiliertem JavaScript

## 🐛 Problem Beschreibung

Die Dropdown-Menüs im Employee Modal zeigten keine Daten aus der Datenbank an, obwohl die API erfolgreich Daten zurücklieferte.

### Fehlermeldung in der Konsole

```javascript
[loadDepartmentsForEmployeeSelect] Dropdown options element not found!
```

## 🔍 Root Cause Analyse

### Das Problem war ein **ID-Mismatch** zwischen HTML und JavaScript

| Element             | HTML ID (falsch)              | JavaScript erwartet (richtig)  |
| ------------------- | ----------------------------- | ------------------------------ |
| Department Dropdown | `employeeDepartment-dropdown` | `employee-department-dropdown` |
| Department Display  | `employeeDepartment-display`  | `employee-department-display`  |
| Department Select   | `employeeDepartmentSelect`    | `employee-department-select`   |
| Team Dropdown       | `employeeTeam-dropdown`       | `employee-team-dropdown`       |
| Team Display        | `employeeTeam-display`        | `employee-team-display`        |
| Team Select         | `employeeTeamSelect`          | `employee-team-select`         |

### Code-Analyse

**Kompilierte admin-dashboard.js suchte nach:**

```javascript
const dropdown = document.querySelector('employee-department-dropdown');
```

**HTML hatte aber:**

```html
<div class="dropdown-options" id="employeeDepartment-dropdown"></div>
```

## ✅ Lösung

Alle IDs in der HTML-Datei wurden angepasst, um mit den erwarteten IDs aus der kompilierten JavaScript-Datei übereinzustimmen:

### Vorher (falsch)

```html
<!-- Department Dropdown -->
<div class="custom-select-display" id="employeeDepartment-display" onclick="toggleDropdown('employeeDepartment')">
  <div class="dropdown-options" id="employeeDepartment-dropdown">
    <input type="hidden" name="departmentId" id="employeeDepartmentSelect" />

    <!-- Team Dropdown -->
    <div class="custom-select-display" id="employeeTeam-display" onclick="toggleDropdown('employeeTeam')">
      <div class="dropdown-options" id="employeeTeam-dropdown">
        <input type="hidden" name="teamId" id="employeeTeamSelect" />
      </div>
    </div>
  </div>
</div>
```

### Nachher (korrekt)

```html
<!-- Department Dropdown -->
<div class="custom-select-display" id="employee-department-display" onclick="toggleDropdown('employee-department')">
  <div class="dropdown-options" id="employee-department-dropdown">
    <input type="hidden" name="departmentId" id="employee-department-select" />

    <!-- Team Dropdown -->
    <div class="custom-select-display" id="employee-team-display" onclick="toggleDropdown('employee-team')">
      <div class="dropdown-options" id="employee-team-dropdown">
        <input type="hidden" name="teamId" id="employee-team-select" />
      </div>
    </div>
  </div>
</div>
```

## 📝 Lessons Learned

1. **Konsistente Namenskonventionen sind kritisch** - Besonders zwischen HTML und JavaScript
2. **CamelCase vs. Kebab-Case** - In diesem Projekt wird kebab-case für HTML IDs verwendet
3. **Debugging-Tipp**: Wenn `querySelector()` null zurückgibt, immer zuerst prüfen:
   - Ist die ID korrekt geschrieben?
   - Existiert das Element zum Zeitpunkt des Zugriffs im DOM?
   - Stimmt die ID-Konvention überein?

## 🛠️ Betroffene Dateien

- `/home/scs/projects/Assixx/frontend/src/pages/admin-dashboard.html`
- `/home/scs/projects/Assixx/frontend/dist/js/admin-dashboard.js` (kompiliert aus TypeScript)

## 🎯 Ergebnis

Nach der Korrektur der IDs funktionieren die Dropdowns einwandfrei und zeigen die Departments und Teams aus der Datenbank an.

## 🔧 Präventionsmaßnahmen

1. **TypeScript Types verwenden** für Element-IDs
2. **Konsistente Naming Convention** dokumentieren und einhalten
3. **Automatisierte Tests** für DOM-Element-Zugriffe
4. **Linting Rules** für ID-Konventionen einrichten

---

_Bug gefunden und behoben am: 11.08.2025_
_Debugging-Zeit: ~45 Minuten_
_Root Cause: Inkonsistente ID-Namenskonvention zwischen HTML und JavaScript_
