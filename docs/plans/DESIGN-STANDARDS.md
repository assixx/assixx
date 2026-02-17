# Assixx Design Standards Guide

> **Version:** 2.1.0
> **Letztes Update:** 06.06.2025
> **Erstellt von:** Simon Öztürk & Claude AI

## 🎨 Übersicht

Dieses Dokument definiert die verbindlichen Design-Standards für das Assixx-Projekt. Alle UI-Komponenten müssen diesen Standards entsprechen, um ein konsistentes und professionelles Erscheinungsbild zu gewährleisten.

## 📋 Inhaltsverzeichnis

1. [Grundprinzipien](#-grundprinzipien)
2. [Farbpalette & Variablen](#-farbpalette--variablen)
3. [Glassmorphismus Design](#-glassmorphismus-design)
4. [Komponenten-Standards](#-komponenten-standards)
5. [Animationen & Übergänge](#animationen-und-uebergange)
6. [Responsive Design](#-responsive-design)
7. [Best Practices](#best-practices)

---

## 🎯 Grundprinzipien

> **WICHTIG:** Die Datei `frontend/src/pages/design-standards.html` dient als Live-Referenz und Muster für alle Styles. Diese Dokumentation spiegelt die dort definierten Standards wider.

### Design-Philosophie

Assixx folgt einem **dark-themed Glassmorphismus Design System** mit folgenden Kernprinzipien:

- **Transparenz und Tiefe**: Verwendung von backdrop filters und subtilen Transparenzen
- **Professionelle Ästhetik**: Sauberes, modernes Interface für Industrieunternehmen
- **Konsistenz**: Einheitliche Designsprache über alle Komponenten
- **Performance**: Flüssige Animationen und Übergänge
- **Barrierefreiheit**: Klarer Kontrast und lesbare Typografie

### Kern-Design-Prinzipien

1. **Glassmorphismus First**: Alle Komponenten verwenden glasartige Transparenz-Effekte
2. **Dark Theme Foundation**: Aufgebaut auf dunklem Hintergrund mit hellem Text
3. **Subtile Interaktionen**: Hover-Effekte, Animationen und Übergänge verbessern die UX
4. **Hierarchische Klarheit**: Klare visuelle Hierarchie durch Farbe, Größe und Abstände
5. **Responsive Design**: Mobile-First Ansatz mit Desktop-Erweiterungen

### Technische Standards

- **Webkit-Support** für Safari-Kompatibilität
- **CSS-Variablen** für einfache Wartung
- **Mobile-First** Responsive Design
- **Performance-optimiert** mit GPU-Beschleunigung
- **Subtile Transparenzen** (0.02 - 0.08)
- **Konsistente Blur-Effekte** (20px für Container, 10px für Buttons, 5px für Inputs)

---

## 🎨 Farbpalette & Variablen

### CSS Variablen (Definiert in dashboard-theme.css)

```css
:root {
  /* Primärfarben */
  --primary-color: #2196f3; /* Haupt-Markenblau */
  --primary-dark: #1976d2; /* Dunkleres Blau für Hover-Zustände */
  --primary-light: #42a5f5; /* Helleres Blau für Akzente */
  --primary-hover: #1976d2; /* Hover-Zustand für Primary */

  /* Sekundärfarben */
  --secondary-color: #1b1b1b; /* Dunkles Sekundär */
  --secondary-color: #4caf50; /* Grün (alternative Definition) */

  /* Hintergrundfarben */
  --background-dark: #121212; /* Haupt-Dunkelhintergrund */
  --background-light: #1e1e1e; /* Hellerer Dunkelhintergrund */

  /* Textfarben */
  --text-primary: #ffffff; /* Primärer Text (weiß) */
  --text-secondary: #ffffff; /* Sekundärer Text (auch weiß im Dark Theme) */

  /* Rahmenfarben */
  --border-color: #333333; /* Standard-Rahmenfarbe */

  /* Status-Farben */
  --success-color: #4caf50; /* Grün für Erfolg */
  --error-color: #f44336; /* Rot für Fehler */
  --warning-color: #ff9800; /* Orange für Warnungen */

  /* Role-spezifische Farben */
  --admin-color: #ff6b6b;
  --employee-color: #4ecdc4;
  --root-color: #667eea;

  /* Neue Begleitfarbe - Platinum Glass für Premium/Special Elements */
  --accent-color: rgba(255, 255, 255, 0.1); /* Elegante transparente Basis */
  --accent-gradient: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15),
    rgba(255, 255, 255, 0.05),
    rgba(255, 255, 255, 0.1)
  ); /* Subtiler Glassmorphismus Gradient */
  --accent-glow: rgba(255, 255, 255, 0.6); /* Glow-Effekt für Premium Elements */

  /* Abstände */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Radien */
  --radius-sm: 8px; /* Buttons, Inputs */
  --radius-md: 12px; /* Cards, Modals */
  --radius-lg: 16px; /* Große Container */

  /* Schatten */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);
}
```

---

## 🌟 Glassmorphismus Design

### Body Background (STANDARD!)

```css
/* Dramatischer Hintergrund-Gradient - IMMER dieses Muster verwenden */
body {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  background: #000;
}

body::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(5deg,transparent,rgba(0,142,255,.1) 100%,#01000482 0,rgba(0,0,4,.6) 100%,#000);
  pointer-events: none;
  z-index: -1;
}
    transparent 0%,
    rgba(0, 142, 255, 0.08) 25%,
    #01000482 60%,
    rgba(0, 0, 4, 0.6) 90%,
    black 100%
  );
  z-index: -1;
}
```

### Container & Cards

```css
/* Standard Glass-Effekt für alle Container */
.glass-container,
.card {
  animation: fadeInUp 0.6s ease-out;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid hsla(0, 0%, 100%, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
}

/* Hover-Zustand */
.glass-container:hover,
.card:hover {
  transform: translateY(-5px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.03);
}
```

---

## 📦 Komponenten-Standards

### 1. Header Navigation & Navigation Container System

#### Navigation Container System (STANDARD ab v0.1.0)

Das Navigation Container System ist der moderne Standard für konsistente Navigation in Assixx. Alle neuen Seiten MÜSSEN dieses System verwenden.

**HTML-Struktur (Minimal):**

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <!-- Imports... -->
  </head>
  <body>
    <!-- Navigation Container - EINZIGE Navigation-Struktur -->
    <div id="navigation-container"></div>

    <!-- Main Layout -->
    <div class="layout-container">
      <main class="main-content">
        <!-- Seiten-Content hier -->
      </main>
    </div>

    <!-- Scripts am Ende -->
    <script type="module" src="/scripts/components/unified-navigation.ts"></script>
  </body>
</html>
```

**TypeScript Import:**

```javascript
// unified-navigation.ts generiert automatisch:
// - Header mit Logo, User-Info, Role-Switch, Logout
// - Sidebar mit rolle-basierten Menüpunkten
// - Responsive Toggle-Funktionalität
// - Konsistente Glassmorphismus-Styles
```

**Vorteile:**

- ✅ Single Source of Truth für Navigation
- ✅ Keine Duplikation über Seiten
- ✅ Automatische Rolle-basierte Menüs
- ✅ Einheitliches Responsive-Verhalten
- ✅ Zentrale Wartung

**Migration von alten Seiten:**

1. Entfernen: Kompletten `<header>` und `<aside class="sidebar">` HTML
2. Entfernen: Scripts wie `header-user-info.ts`, `role-switch.ts`
3. Hinzufügen: `<div id="navigation-container"></div>`
4. Hinzufügen: `<script type="module" src="/scripts/components/unified-navigation.ts"></script>`

**CSS für Header (automatisch von unified-navigation.ts generiert):**

```css
.header {
  display: flex;
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  align-items: center;
  z-index: 1000;

  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  padding: 0 var(--spacing-lg);
  height: 60px;
}
```

### 2. Form Controls

```css
.form-control,
.form-input
  width: 100%;
  padding: var(--spacing-2sm);
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid hsla(0,0%,100%,.1);
  border-radius: var(--radius-sm);
  color: #fff;


.form-control:focus,
.form-input:focus {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(0, 142, 255, 0.5);
  box-shadow:
    0 0 0 3px rgba(0, 142, 255, 0.15),
    inset 0 1px 2px rgba(0, 0, 0, 0.2);
  outline: none;
}

/* Autofill Styles für verschiedene Browser */
/* WICHTIG: Browser-Autofill überschreibt normalerweise unsere Glassmorphismus-Farben! */
/* Referenz: https://developer.mozilla.org/en-US/docs/Web/CSS/:autofill */

/* Cross-Browser mit :is() forgiving selector list */
/* - Chrome/Safari: :-webkit-autofill */
/* - Firefox/Standard: :autofill */
.form-control:is(:-webkit-autofill, :autofill),
.form-control:is(:-webkit-autofill, :autofill):hover,
.form-control:is(:-webkit-autofill, :autofill):focus,
.form-control:is(:-webkit-autofill, :autofill):active,
.form-input:is(:-webkit-autofill, :autofill),
.form-input:is(:-webkit-autofill, :autofill):hover,
.form-input:is(:-webkit-autofill, :autofill):focus,
.form-input:is(:-webkit-autofill, :autofill):active {
  /* Box-Shadow Trick um Browser-Background zu überschreiben */
  -webkit-box-shadow: 0 0 0 30px rgba(255, 255, 255, 0.04) inset !important;
  box-shadow: 0 0 0 30px rgba(255, 255, 255, 0.04) inset !important;
  -webkit-text-fill-color: var(--text-primary) !important;
  color: var(--text-primary) !important;
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(33, 150, 243, 0.3) !important;
  /* Verhindert sofortiges Zurücksetzen der Farbe */
  transition: background-color 5000s ease-in-out 0s;
}
```

### 3. Custom Dropdowns (PFLICHT!)

**HTML Struktur:**

```html
<div class="custom-dropdown">
  <div
    class="dropdown-display"
    id="myDropdownDisplay"
    on
    click(depcreated.itsnow
    eventhandler)="toggleDropdown('myDropdown')"
  >
    <span>Bitte wählen</span>
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
      <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </div>
  <div class="dropdown-options" id="myDropdownDropdown">
    <div class="dropdown-option" on click(depcreated.itsnow eventhandler)="selectOption('value1', 'Text 1')">
      Text 1
    </div>
    <div class="dropdown-option" on click(depcreated.itsnow eventhandler)="selectOption('value2', 'Text 2')">
      Text 2
    </div>
  </div>
  <input type="hidden" name="fieldName" id="myDropdownValue" required />
</div>
```

**CSS Styles:**

```css
.custom-dropdown {
  position: relative;
  width: 100%;
}

.dropdown-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  backdrop-filter: blur(10px);
  cursor: pointer;
  border: 1px solid hsla(0, 0%, 100%, 0.1);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  padding: var(--spacing-2sm);
  color: #fff;
}

.dropdown-display:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
}

.dropdown-display.active svg {
  transform: rotate(180deg);
}

.dropdown-options {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  transform: translateY(-10px);
  visibility: hidden;
  opacity: 0;

  z-index: 1001;

  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid hsla(0, 0%, 100%, 0.1);
  border-radius: var(--radius-sm);
  background: rgba(18, 18, 18, 0.8);
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-options.active {
  transform: translateY(0);
  visibility: visible;
  opacity: 1;
}

.dropdown-option {
  cursor: pointer;

  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  color: var(--text-primary);
}
```

### 4. Buttons

**WICHTIG: Es gibt 2 Button-Level mit unterschiedlichen Styles!**

**First-Level Button (.btn-primary-first - Haupt-CTAs):**

```css
/* First-Level: KEIN background, nur Shadow-Effekt */
.btn-primary-first {
  display: inline-flex;
  position: relative;
  justify-content: center;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin: 5px;
  box-shadow:
    0 1px 4px rgba(33, 150, 243, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);

  border: none;
  border-radius: var(--radius-sm);
  background: none !important; /* Explizit kein Background */
  padding: 10px 24px;
  overflow: hidden;
  color: #fff;
  font-weight: 500;
  font-size: 14px;
}

/* Second-Level Button (.btn-primary - mit Gradient) */
.btn-primary {
  display: inline-flex;
  position: relative;
  justify-content: center;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin: 5px;
  box-shadow:
    0 1px 4px rgba(33, 150, 243, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);

  border: none;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  padding: 10px 24px;
  overflow: hidden;
  color: #fff;
  font-weight: 500;
  font-size: 14px;
}

/* Gemeinsamer Hover-Effekt */
.btn-primary::before,
.btn-primary-first::before {
  position: absolute;
  top: 0;
  left: -100%;
  transition: left 0.5s ease;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  width: 100%;
  height: 100%;
  content: '';
}

.btn-primary:hover,
.btn-primary-first:hover {
  transform: translateY(-2px);
  box-shadow:
    0 6px 20px rgba(33, 150, 243, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-primary:hover::before,
.btn-primary-first:hover::before {
  left: 100%;
}
```

**Second-Level Button (Sekundäre Actions wie "Upload"):**

```css
/* Second-Level: MIT background-gradient */
.btn-primary.btn-cancel-action,
.btn-upload {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  /* Alle anderen Styles bleiben gleich wie First-Level */
}
```

````

**Button-Verwendung:**
- **First-Level (TRANSPARENT - kein Background!)**: Hauptaktionen wie "Registrieren", "Login", "Jetzt starten"
  - Verwendet für primäre CTAs in Header/Hero-Bereichen
  - Nur Shadow-Effekt, komplett transparent
  - Exakt wie der "Registrieren" Button in index.html
- **Second-Level (mit Gradient-Background)**: Sekundäre Aktionen wie "Upload", "Speichern", "Senden"
  - Verwendet in Formularen und Content-Bereichen
  - Blauer Gradient-Background
  - Wie Upload-Button in document-upload.html

**Base Button Styles:**
```css
/* Basis für alle Buttons */
.btn {
    padding: 10px 24px;
    border-radius: var(--radius-sm);
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;

    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

/* SVG Icons in Buttons */
.btn svg {
    width: 20px;
    height: 20px;
}
````

**Secondary Button (Outline Style):**

```css
.btn-cancel {
  backdrop-filter: blur(5px);
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  padding: 10px 24px;
  color: var(--primary-color);
  font-weight: 500;
}

.btn-cancel:hover {
  border-color: var(--primary-color);
  background: rgba(255, 255, 255, 0.08);
}
```

**Status Buttons (Outline Style):**

```css
/* Active Status Button */
.btn-status-active {
  backdrop-filter: blur(10px);
  cursor: pointer;
  border: 1px solid #ff6b35;
  border-radius: var(--radius-sm);
  background: transparent;
  padding: 0.375rem 0.75rem;
  color: #ff6b35;
  font-weight: 500;
}

.btn-status-active:hover {
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.2);
  border-color: #ff5722;
  background: rgba(255, 107, 53, 0.1);
  color: #ff5722;
}

/* Inactive Status Button */
.btn-status-inactive {
  backdrop-filter: blur(10px);
  cursor: pointer;
  border: 1px solid #28a745;
  border-radius: var(--radius-sm);
  background: transparent;
  padding: 0.375rem 0.75rem;
  color: #28a745;
  font-weight: 500;
}

.btn-status-inactive:hover {
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.2);
  border-color: #218838;
  background: rgba(40, 167, 69, 0.1);
  color: #218838;
}
```

**Danger Button (Solid Style):**

```css
.btn-danger {
  cursor: pointer;
  border: 1px solid #bd2130;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  padding: 0.375rem 0.75rem;
  color: #fff;
  font-weight: 500;
}

.btn-danger:hover {
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
}
```

### 5. Modal Design (STANDARD!)

**HTML Struktur:**

```html
<div id="myModal" class="modal" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3 class="modal-title">Modal Titel</h3>
      <button class="modal-close" on click(depcreated.itsnow eventhandler)="hideModal('myModal')">&times;</button>
    </div>
    <form>
      <div class="form-group">
        <label class="form-label">Label</label>
        <input type="text" class="form-control" required />
      </div>
      <div class="button-group">
        <button type="submit" class="btn btn-primary">Speichern</button>
        <button type="button" class="btn btn-cancel" on click(depcreated.itsnow eventhandler)="hideModal('myModal')">
          Abbrechen
        </button>
      </div>
    </form>
  </div>
</div>
```

**CSS Styles:**

```css
.modal {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
  width: 100%;
  height: 100%;
}

.modal-content {
  backdrop-filter: blur(20px) saturate(580%);
  animation: fadeInUp 0.3s ease-out;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding: var(--spacing-lg);
}

.modal-title {
  margin: 0;
  color: var(--primary-color);
  font-weight: 600;
  font-size: 20px;
}

.modal-close {
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  padding: 0;
  width: 30px;
  height: 30px;
  color: var(--text-secondary);
  font-size: 24px;
}

.modal-close:hover {
  background-color: var(--background-dark);
  color: var(--error-color);
}

.modal form {
  padding: var(--spacing-lg);
}

.modal .form-group {
  margin-bottom: var(--spacing-md);
}

.button-group {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin-top: 20px;
}
```

### 6. User Info (Header)

```css
.header .header-actions #user-info {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  padding: 0.2rem 0.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

#user-avatar {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  object-fit: cover;
}

#logout-btn {
  cursor: pointer;

  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  border: none;
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.8), rgba(185, 28, 28, 0.8));
  padding: 0.25rem 0.6rem;
  color: #fff;
  font-weight: 500;
  font-size: 0.8rem;
}

#logout-btn:hover {
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9));
}
```

### 7. Cards (Compact Design)

```css
/* WICHTIG: backdrop-filter NUR auf der Card selbst, NICHT auf card-header! */
.compact-card {
  display: flex;
  position: relative;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.compact-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
  height: 3px;
  content: '';
}

.compact-card:hover::before {
  opacity: 1;
}

.compact-card:hover {
  transform: translateY(-5px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.03);
}

.compact-card .card-title::before {
  border-radius: 2px;
  background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
  width: 4px;
  height: 20px;
  content: '';
}
```

---

## 📝 Typografie Standards

### Schriftfamilie

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Ubuntu', Roboto, sans-serif;
```

### Schriftgrößen

- **Headers**:
  - H1: 24px (Seitentitel)
  - H2: 20px (Abschnittstitel)
  - H3: 18px (Unterabschnitte)
- **Body**: 14px (Standard)
- **Small**: 13px (Labels, Hinweise)
- **Tiny**: 12px (Badges, Metadaten)

### Schriftgewichte

- Regular: 400
- Medium: 500
- Semi-bold: 600
- Bold: 700

### Textfarben

- Primärer Text: `#FFFFFF`
- Sekundärer Text: `#ffffff` (gleich wie primär im Dark Theme)
- Gedämpfter Text: `rgba(255, 255, 255, 0.7)`
- Link-Farbe: `var(--primary-color)`

### Text-Shadow für Titel

```css
/* Sehr subtiler Text-Shadow für bessere Lesbarkeit */
.title {
  text-shadow: 0 0 20px rgba(33, 150, 243, 0);
}
```

---

<a id="animationen-und-uebergange"></a>

## 🎬 Animationen & Übergänge

### Standard Animationen

```css
/* Fade In Up */
@keyframes fade-in-up {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Fade In (Success Overlay) */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Scale In (Success Message) */
@keyframes scaleIn {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* Checkmark (Success Icon) */
@keyframes checkmark {
  0% {
    transform: scale(0) rotate(0deg);
  }
  50% {
    transform: scale(1.2) rotate(360deg);
  }
  100% {
    transform: scale(1) rotate(360deg);
  }
}

/* Subtle Pulse (für Logos) */
@keyframes subtle-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.02);
    opacity: 0.95;
  }
}

/* Glow - für spezielle Elemente */
@keyframes glow {
  from {
    box-shadow:
      0 4px 12px rgba(251, 191, 36, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  to {
    box-shadow:
      0 4px 20px rgba(251, 191, 36, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

/* Spin - für Loading Spinner */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### Transition Standards

```css
/* Standard Transition */

/* Schnelle Interaktionen */

/* Langsame, smooth Animationen */
transition: all 0.6s ease-out;
```

### Success Overlay Standard (PFLICHT für alle Erfolgs-Meldungen!)

**Dieses Design ist der STANDARD für alle Success-Messages in der gesamten Anwendung!**

**HTML Struktur:**

```javascript
function showSuccessMessage() {
  const overlay = document.createElement('div');
  overlay.className = 'success-overlay';
  overlay.innerHTML = `
    <div class="success-message">
      <div class="success-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="success-text">
        Vielen Dank für Ihre Teilnahme!
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
  }, 2000);
}
```

**CSS Styles:**

```css
/* Success Overlay - Fullscreen mit Glassmorphismus */
.success-overlay {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease-out;
  background: rgba(0, 0, 0, 0.8);
  width: 100%;
  height: 100%;
}

/* Success Message Container */
.success-message {
  backdrop-filter: blur(20px);
  animation: scaleIn 0.5s ease-out;
  border: 2px solid #4caf50;
  border-radius: var(--radius-md);
  background: rgba(76, 175, 80, 0.1);
  padding: var(--spacing-xl) calc(var(--spacing-xl) * 2);
  text-align: center;
}

/* Success Icon mit Animation */
.success-icon {
  animation: checkmark 0.6s ease-out 0.3s both;
  margin-bottom: var(--spacing-lg);
  color: #4caf50;
  font-size: 4rem;
}

/* Success Text */
.success-text {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 1.5rem;
}
```

**Verwendungsbeispiele:**

- Nach erfolgreichem Formular-Submit
- Nach Upload-Abschluss
- Nach Speichern von Einstellungen
- Nach Abschluss einer Umfrage
- Nach erfolgreicher Registrierung

**Best Practices:**

1. **Immer 2 Sekunden anzeigen** - nicht kürzer, nicht länger
2. **Text anpassen** je nach Kontext (z.B. "Erfolgreich gespeichert!", "Upload abgeschlossen!")
3. **Nur für wichtige Erfolge** verwenden - nicht für kleine Updates
4. **Overlay entfernen** nach Animation, um DOM sauber zu halten

---

## 📱 Responsive Design

### Breakpoints

```css
/* Desktop (Standard) */
@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
  }
}

/* Tablet */
@media (max-width: 1199px) {
  .admin-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile */
@media (max-width: 768px) {
  .admin-grid {
    grid-template-columns: 1fr;
  }
  .modal-content {
    width: 95%;
  }
}
```

### Mobile-First Prinzipien

- Touch-freundliche Buttons (min. 44px)
- Ausreichende Abstände zwischen interaktiven Elementen
- Scrollbare Container für lange Inhalte
- Reduzierte Animationen auf Mobile

---

## 🌟 Spezielle Komponenten

### Offer Banner

```css
.offer-banner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  backdrop-filter: blur(10px);
  animation: glow 2s ease-in-out infinite alternate;
  box-shadow:
    0 4px 12px rgba(251, 191, 36, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  background: rgba(251, 191, 36, 0.02);
  padding: 6px 14px;
  color: #fbbf24;
  font-weight: 500;
  font-size: 13px;
}
```

### Success Messages

```css
.success-message {
  backdrop-filter: blur(10px);
  box-shadow:
    0 4px 12px rgba(16, 185, 129, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
```

### Badges

```css
/* Base Badge Style - Transparentes Design mit Border */
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-md);
  padding: 3px 8px;
  width: fit-content;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.badge-success {
  border: 1px solid rgba(76, 175, 80, 0.2);
  background: rgba(76, 175, 80, 0.1);
  color: rgba(76, 175, 80, 0.9);
}

.badge-success:hover {
  border-color: rgba(76, 175, 80, 0.3);
  background: rgba(76, 175, 80, 0.15);
}

.badge-warning {
  border: 1px solid rgba(255, 152, 0, 0.2);
  background: rgba(255, 152, 0, 0.1);
  color: rgba(255, 152, 0, 0.9);
}

.badge-warning:hover {
  border-color: rgba(255, 152, 0, 0.3);
  background: rgba(255, 152, 0, 0.15);
}

.badge-danger,
.badge-error {
  border: 1px solid rgba(244, 67, 54, 0.2);
  background: rgba(244, 67, 54, 0.1);
  color: rgba(244, 67, 54, 0.9);
}

.badge-danger:hover,
.badge-error:hover {
  border-color: rgba(244, 67, 54, 0.3);
  background: rgba(244, 67, 54, 0.15);
}

.badge-primary {
  border: 1px solid rgba(33, 150, 243, 0.2);
  background: rgba(33, 150, 243, 0.1);
  color: rgba(33, 150, 243, 0.9);
}

.badge-primary:hover {
  border-color: rgba(33, 150, 243, 0.3);
  background: rgba(33, 150, 243, 0.15);
}

.badge-secondary {
  border: 1px solid rgba(158, 158, 158, 0.2);
  background: rgba(158, 158, 158, 0.1);
  color: rgba(158, 158, 158, 0.9);
}

.badge-secondary:hover {
  border-color: rgba(158, 158, 158, 0.3);
  background: rgba(158, 158, 158, 0.15);
}

.badge-info {
  border: 1px solid rgba(23, 162, 184, 0.2);
  background: rgba(23, 162, 184, 0.1);
  color: rgba(23, 162, 184, 0.9);
}

.badge-info:hover {
  border-color: rgba(23, 162, 184, 0.3);
  background: rgba(23, 162, 184, 0.15);
}

.badge-dark {
  border: 1px solid rgba(52, 58, 64, 0.2);
  background: rgba(52, 58, 64, 0.1);
  color: rgba(52, 58, 64, 0.9);
}

.badge-dark:hover {
  border-color: rgba(52, 58, 64, 0.3);
  background: rgba(52, 58, 64, 0.15);
}
```

### Unread Badge (Chat)

```css
.unread-badge {
  border-radius: 10px;
  background: linear-gradient(135deg, #f44336, #e53935);
  padding: 2px 6px;
  color: #fff;
  font-size: 0.75rem;
}
```

### Role Switch Button (Multi-Role Users)

```css
.btn-role-switch {
  display: flex;

  position: relative;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.021);
  padding: 6px 10px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 0.8rem;
}

.btn-role-switch:hover {
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  border-color: var(--employee-color);
  background: rgba(255, 255, 255, 0.15);
}

.btn-role-switch i {
  transition: transform 0.3s ease;
  font-size: 1rem;
}

.btn-role-switch:hover i {
  transform: rotate(180deg);
}
```

---

## ✅ Best Practices

### DO's ✓ (IMMER befolgen!)

1. **IMMER** Navigation Container System für neue Seiten verwenden
2. **IMMER** Custom Dropdowns statt native HTML `<select>` verwenden
3. **IMMER** Glassmorphismus auf alle Container anwenden
4. **IMMER** Nur Dark Theme - keine Light Theme Variationen
5. **IMMER** Subtile Transparenzen zwischen 0.02-0.08 halten
6. **IMMER** Konsistente Blur-Werte: 20px für Container, 10px für Buttons, 5px für Inputs
7. **IMMER** Inset Shadow für Tiefe hinzufügen
8. **IMMER** fadeInUp Animation auf alle Haupt-Container anwenden
9. **IMMER** subtle-pulse Animation auf alle Logo-Elemente anwenden
10. **IMMER** Webkit-Präfixe für Safari-Kompatibilität verwenden
11. **IMMER** CSS-Variablen für Konsistenz und einfache Wartung nutzen

### DON'Ts ✗ (NIEMALS tun!)

1. **NIEMALS** alte hardcoded Navigation bei neuen Seiten verwenden
2. **NIEMALS** native HTML `<select>` Elemente verwenden
3. **NIEMALS** feste Pixel-Werte für Farben (immer CSS-Variablen)
4. **NIEMALS** inline styles (außer display: none)
5. **NIEMALS** border-bottom auf Header (nur box-shadow verwenden)
6. **NIEMALS** unterschiedliche Hover-Effekte für gleiche Komponenten
7. **NIEMALS** wichtige Animationen ohne GPU-Beschleunigung
8. **NIEMALS** Blur-Werte über 20px (Performance!)
9. **NIEMALS** vergessen die Logo-Animation anzuwenden
10. **NIEMALS** verschiedene Dropdown-Implementierungen mischen
11. **NIEMALS** das Dark Theme aufhellen oder Light Theme Elemente einführen
12. **NIEMALS** backdrop-filter auf .card-header anwenden (nur auf Container/Cards selbst)

### Z-Index Hierarchie

- Modals: 1000
- Dropdown Options: 1001
- Tooltips: 1100
- Notifications: 2000
- Loading Overlays: 2100

### Performance-Tipps

```css
/* GPU-Beschleunigung aktivieren */
.animated-element {
    transform: translateZ(0);
    will-change: transform;
}

/* Backdrop-filter optimieren */
.glassmorphic {
    backdrop-filter: blur(20px); /* Nicht höher als 20px */
    transform: translateZ(0); /* GPU */
}

/* Performance-Überlegungen */
1. `will-change` sparsam für animierte Elemente verwenden
2. backdrop-filter Nutzung auf mobilen Geräten begrenzen
3. Animationen nur mit `transform` und `opacity` optimieren
4. CSS-Variablen für Konsistenz und einfache Wartung verwenden
```

---

## 🔧 JavaScript Standards

### Modal Functions

```javascript
// Modal anzeigen
function showModal(modalId) {
  const modal = document.querySelector(modalId);
  if (modal) {
    modal.style.display = 'flex';
  }
}

// Modal verstecken
function hideModal(modalId) {
  const modal = document.querySelector(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Click-Outside-to-Close
window.addEventListener('click', function (event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
});
```

### Dropdown Functions

```javascript
// Toggle Dropdown
function toggleDropdown(type) {
  const display = document.querySelector(type + 'Display');
  const dropdown = document.querySelector(type + 'Dropdown');

  // Alle anderen schließen
  document.querySelectorAll('.dropdown-display').forEach((d) => {
    if (d !== display) d.classList.remove('active');
  });
  document.querySelectorAll('.dropdown-options').forEach((d) => {
    if (d !== dropdown) d.classList.remove('active');
  });

  display.classList.toggle('active');
  dropdown.classList.toggle('active');
}

// Option auswählen
function selectOption(value, text) {
  document.querySelector('myDropdownDisplay').querySelector('span').textContent = text;
  document.querySelector('myDropdownValue').value = value;
  document.querySelector('myDropdownDisplay').classList.remove('active');
  document.querySelector('myDropdownDropdown').classList.remove('active');
}

// Click-Outside-to-Close
document.addEventListener('click', function (e) {
  if (!e.target.closest('.custom-dropdown')) {
    document.querySelectorAll('.dropdown-display').forEach((d) => d.classList.remove('active'));
    document.querySelectorAll('.dropdown-options').forEach((d) => d.classList.remove('active'));
  }
});
```

---

## 💬 Chat System Design Standards

### WebSocket-Nachrichten Format

```javascript
// Standard Message Format
{
    type: 'new_message',
    conversationId: 123,
    message: {
        id: 456,
        sender_id: 789,
        sender_name: 'Max Mustermann',
        content: 'Nachrichtentext',
        created_at: '2025-01-24T12:00:00',
        attachments: []
    }
}

// Typing Indicator
{
    type: 'typing',
    conversationId: 123,
    userId: 789,
    userName: 'Max Mustermann',
    isTyping: true
}
```

### Chat UI Standards

```css
/* Chat Container - Glassmorphismus */
.chat-container {
  border: 1px solid hsla(0, 0%, 100%, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

/* Message Bubbles */
.message.sent {
  margin-left: auto;
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(33, 150, 243, 0.1));
}

.message.received {
  background: rgba(255, 255, 255, 0.05);
}

/* Unread Badge */
.unread-badge {
  border-radius: 10px;
  background: linear-gradient(135deg, #f44336, #e53935);
  padding: 2px 6px;
  color: #fff;
  font-size: 0.75rem;
}
```

### Chat-Berechtigungen

- **Admins**: Können mit allen chatten (Employees und andere Admins)
- **Employees**: Können nur mit anderen Employees und Admins chatten
- **Tenant-Isolation**: Chats nur innerhalb des gleichen Tenants

### Best Practices

1. **Buffer zu Base64**: Immer `Buffer.from(data).toString('base64')` für Attachments
2. **Undefined-Checks**: Immer prüfen ob Conversation existiert bevor Zugriff
3. **WebSocket Reconnect**: Automatischer Reconnect nach Verbindungsabbruch
4. **Message Deduplication**: Prüfung auf doppelte Nachrichten beim Senden

---

## 📐 Abstände & Grid System

### Standard Grid

```css
.grid {
  display: grid;
  gap: var(--spacing-lg);
}

.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}
.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}
.grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

/* Responsive */
@media (max-width: 768px) {
  .grid-2,
  .grid-3,
  .grid-4 {
    grid-template-columns: 1fr;
  }
}
```

### Flex Utilities

```css
.flex {
  display: flex;
}
.flex-center {
  justify-content: center;
  align-items: center;
}
.flex-between {
  justify-content: space-between;
}
.flex-1 {
  flex: 1;
}
.gap-sm {
  gap: var(--spacing-sm);
}
.gap-md {
  gap: var(--spacing-md);
}
.gap-lg {
  gap: var(--spacing-lg);
}
```

---

## 💻 Vollständige Code-Beispiele

### Komplette Glass Card Komponente

```html
<div class="glass-card">
  <div class="card-header">
    <h3 class="card-title">Card Title</h3>
  </div>
  <div class="card-body">
    <p>Card content goes here</p>
  </div>
</div>
```

```css
.glass-card {
  animation: fadeInUp 0.6s ease-out;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid hsla(0, 0%, 100%, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  padding: var(--spacing-lg);
}

.glass-card:hover {
  transform: translateY(-5px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.03);
}

.card-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px 10px 0 0;
  background: rgba(255, 255, 255, 0.01);
  /* WICHTIG: Kein backdrop-filter für card-header! */
  padding: var(--spacing-md) var(--spacing-lg);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 1.1rem;
}

.card-title::before {
  border-radius: 2px;
  background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
  width: 4px;
  height: 20px;
  content: '';
}
```

### Komplettes Form mit Glassmorphismus

```html
<form class="glass-form">
  <div class="form-group">
    <label class="form-label">Email</label>
    <input type="email" class="form-control" placeholder="email@example.com" />
  </div>
  <div class="form-group">
    <label class="form-label">Password</label>
    <input type="password" class="form-control" placeholder="••••••••" />
  </div>
  <button type="submit" class="btn btn-primary btn-block">Login <span class="btn-icon">→</span></button>
</form>
```

```css
.glass-form {
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid hsla(0, 0%, 100%, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  padding: var(--spacing-xl);
}
```

---

## ⚠️ Wichtige CSS-Konflikte vermeiden

### Problem: Globale CSS-Selektoren

Bei der Entwicklung neuer Seiten ist es **kritisch wichtig**, keine zu allgemeinen CSS-Selektoren zu verwenden, da diese die Standard-Styles überschreiben können.

#### ❌ FALSCH - Zu globale Selektoren

```css
/* NIEMALS so allgemein definieren! */
.btn {
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-primary);
}

/* Überschreibt ALLE Buttons im System! */
#user-info::before {
  background: linear-gradient(...);
}
```

#### ✅ RICHTIG - Spezifische Selektoren

```css
/* Immer mit spezifischem Kontext */
.feature-actions .btn {
  background: rgba(255, 255, 255, 0.02);
}

/* Oder eigene spezifische Klassen */
.feature-btn {
  background: rgba(255, 255, 255, 0.02);
}
```

### Pflicht-Includes für konsistente Header

Jede Seite mit Standard-Header MUSS folgende CSS-Dateien einbinden:

```html
<!-- Font Icons -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
<!-- User Info Styles (entfernt unerwünschte Pseudo-Elemente) -->
<link rel="stylesheet" href="/styles/user-info-update.css" />
```

### Debugging-Tipps

1. **Vergleiche mit funktionierenden Seiten** (z.B. root-dashboard.html)
2. **Prüfe alle CSS-Includes** - fehlende Dateien sind oft die Ursache
3. **Inspiziere spezifische Selektoren** - zu globale Styles überschreiben oft Standards
4. **Validiere HTML** - doppelte `class` Attribute werden ignoriert

Für alle modals gilt bei:
backdrop-filter: blur(20px) saturate(500%);

## background: #1a1a1a4a

## 🎯 Checkliste für neue Komponenten

- [ ] Navigation Container System verwendet?
- [ ] Glassmorphismus-Effekt angewendet?
- [ ] Webkit-Präfixe hinzugefügt?
- [ ] CSS-Variablen verwendet?
- [ ] Hover-Effekte implementiert?
- [ ] FadeInUp Animation?
- [ ] Responsive getestet?
- [ ] Custom Dropdowns statt native Select?
- [ ] Modal folgt dem Standard?
- [ ] Performance optimiert?
- [ ] Konsistent mit anderen Komponenten?
- [ ] **Keine globalen CSS-Selektoren verwendet?**
- [ ] **Alle notwendigen CSS-Dateien eingebunden?**
- [ ] **HTML-Validität geprüft (keine doppelten Attribute)?**
- [ ] **design-standards.html als Referenz konsultiert?**

---

## 📚 Referenzen

- [CLAUDE.md](./CLAUDE.md) - Originale Design-Anweisungen
- [NAVIGATION-CONTAINER.md](./NAVIGATION-CONTAINER.md) - Navigation Container System Dokumentation
- [signup.html](./server/public/signup.html) - Referenz für Form-Design
- [login.html](./server/public/login.html) - Referenz für Login-Design
- [dashboard-theme.css](./server/public/css/dashboard-theme.css) - Haupt-CSS-Variablen
- [blackboard.css](./server/public/css/blackboard.css) - Spezielle Komponenten
- [admin-dashboard.html](./server/public/admin-dashboard.html) - Referenz für Card-Design
- [design-standards.html](./frontend/src/pages/design-standards.html) - Live Demo aller Design-Standards
- [unified-navigation.ts](./frontend/src/scripts/components/unified-navigation.ts) - Navigation Container Implementation

---

**© 2025 Assixx by SCS-Technik. Alle Rechte vorbehalten.**
