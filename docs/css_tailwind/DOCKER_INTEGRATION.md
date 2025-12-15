# Design System Docker Integration

## 🔧 SUDO BEFEHLE ZUM AUSFÜHREN

### Option 1: Mit dem Script (empfohlen)

```bash
# Führe das komplette Setup aus
sudo bash /home/scs/projects/Assixx/copy-design-system.sh
```

### Option 2: Einzelne Befehle manuell

```bash
# 1. Erstelle tar-Archiv
sudo tar -czf /tmp/design-system.tar.gz -C /home/scs/projects/Assixx design-system

# 2. Kopiere in Container
sudo docker cp /tmp/design-system.tar.gz assixx-backend:/tmp/

# 3. Entpacke im Container
sudo docker exec assixx-backend sh -c "cd /app && tar -xzf /tmp/design-system.tar.gz && rm /tmp/design-system.tar.gz"

# 4. Setze Berechtigungen
sudo docker exec assixx-backend sh -c "chown -R node:node /app/design-system"

# 5. Installiere Dependencies
sudo docker exec -u node assixx-backend sh -c "cd /app/design-system && pnpm install"

# 6. Baue Design Tokens
sudo docker exec -u node assixx-backend sh -c "cd /app/design-system && pnpm run build"

# 7. Teste den Build
sudo docker exec assixx-backend pnpm build
```

## 📋 WAS WURDE GEÄNDERT

### Tailwind v4 Config

- **NEU**: CSS-basierte Config statt JavaScript
- **NEU**: `@theme` Directive für Variablen
- **NEU**: Layer-System für Themes

### Dateien

1. `/copy-design-system.sh` - Automatisches Setup Script
2. `/frontend/src/styles/tailwind.css` - Tailwind v4 Integration
3. `/frontend/app.css` - Alternative Tailwind v4 Config

## ✅ ERWARTETES ERGEBNIS

Nach Ausführung sollten folgende Dateien existieren:

```
/app/design-system/build/web/css/
├── variables-dark.css
├── variables-light.css
└── variables-contrast.css
```

## 🚀 NÄCHSTE SCHRITTE

Nach erfolgreichem Setup:

1. `docker exec assixx-backend pnpm build` sollte ohne Fehler laufen
2. Theme-Switching wird funktionieren
3. Alle Tailwind Utilities sind verfügbar

 🎯 AKTUELLER STATUS: Tailwind CSS + Design Tokens

  ✅ WAS IST INSTALLIERT & KONFIGURIERT:

  1. Tailwind CSS v4 ✅
    - Installiert als @tailwindcss/postcss Plugin
    - Konfiguriert in postcss.config.js und tailwind.config.js
    - Build läuft erfolgreich ohne Fehler
  2. Design Tokens System ✅
    - Quelle: /home/scs/projects/Assixx/design-system/tokens/
    - Generierte CSS: /app/design-system/build/web/css/ (im Docker Container)
    - 3 Themes generiert: variables-dark.css, variables-light.css, variables-contrast.css
    - CSS Variablen aktiv in der Build-Pipeline
  3. PostCSS Pipeline ✅
    - Tailwind v4 integriert
    - CSS Nesting funktioniert
    - Import von Design Tokens aktiv

  🔍 WAS WIRD AKTUELL GENUTZT:

  TEILWEISE! - Hybrid-Zustand:

  1. Design System Demo Seite (design-system-demo.html):
    - ✅ Nutzt Tailwind Klassen: bg-background, text-text-primary, flex, mx-auto, etc.
    - ✅ CSS: 636KB (zeigt dass Tailwind aktiv ist)
  2. Andere Seiten:
    - ❌ Nutzen noch Bootstrap + Custom CSS
    - ❌ 61 separate CSS Dateien
    - ⚠️ Glass-Komponenten mussten zu custom-glass-card umbenannt werden
  3. In der Browser Console siehst du:
    - CSS Variablen aus Design Tokens (z.B. --color-primary, --glass-background)
    - Gemischte Styles: Bootstrap + Custom CSS + einzelne Tailwind Utilities

  📁 WO SIND DIE DESIGN TOKENS:

# Source (JSON Format)

  /home/scs/projects/Assixx/design-system/
  ├── tokens/
  │   ├── core/          # Basis-Farben, Spacing, etc.
  │   ├── semantic/      # Semantische Mappings
  │   └── themes/        # Theme-spezifische Overrides
  │       ├── dark/
  │       ├── light/
  │       └── contrast/

# Generierte CSS (im Docker)

  /app/design-system/build/web/css/
  ├── variables-dark.css     # CSS Variablen für Dark Theme
  ├── variables-light.css    # CSS Variablen für Light Theme
  └── variables-contrast.css # CSS Variablen für Contrast Theme

# Import in Frontend

  /home/scs/projects/Assixx/frontend/src/styles/tailwind.css
  → Importiert die generierten CSS Dateien
  → Definiert Tailwind Utilities & Components

  🚀 NÄCHSTER SCHRITT:

  Migration Bootstrap → Tailwind (Schrittweise):

  1. Eine Komponente nach der anderen:
    - Starte mit kleinen, isolierten Komponenten (z.B. Buttons, Forms)
    - Teste jede Migration gründlich
    - Behalte Bootstrap parallel bis alles migriert ist
  2. Konsolidierung der 61 CSS Dateien:
    - Identifiziere gemeinsame Patterns
    - Erstelle Tailwind Component Classes
    - Reduziere Redundanzen
  3. Theme Switching (später):
    - JavaScript für Theme-Toggle
    - LocalStorage für Präferenz
    - data-theme Attribute am <html> Element

  💡 WICHTIG ZU VERSTEHEN:

- Tailwind v4 ist AKTIV aber wird noch nicht überall genutzt
- Design Tokens sind INTEGRIERT als CSS Variablen
- Build-Process FUNKTIONIERT einwandfrei
- Hybrid-Zustand ist normal während Migration
- Default Theme (Dark) ist aktiv ohne Switching

  Die Grundlage ist komplett! Jetzt geht's an die schrittweise Migration der Komponenten.
