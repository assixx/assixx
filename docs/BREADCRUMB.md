# 🍞 Breadcrumb Navigation System

## 📋 Übersicht

Das Breadcrumb-System bietet eine konsistente Navigation für alle Seiten im Assixx-Projekt. Es zeigt dem Benutzer seinen aktuellen Standort in der Anwendungshierarchie.

## 🎨 Aktuelles Design (Referenz: Admin Dashboard)

beachte h1 titel müssen jeweil dann von der Seite weg (Titel)

### HTML-Struktur

```html
<!-- Breadcrumb Navigation -->
<div class="breadcrumb-container">
  <nav class="breadcrumb">
    <div class="breadcrumb-item">
      <i class="fas fa-home breadcrumb-icon"></i>
      <a href="/" class="breadcrumb-link">Home</a>
    </div>
    <div class="breadcrumb-separator">
      <i class="fas fa-chevron-right"></i>
    </div>
    <div class="breadcrumb-item">
      <span class="breadcrumb-current">
        <i class="fas fa-tachometer-alt"></i>
        Admin Dashboard
      </span>
    </div>
  </nav>
</div>
```

### CSS-Styles (Glassmorphismus-Design)

```css
/* Breadcrumb Container */
.breadcrumb-container {
  margin-bottom: 24px;
  padding: 0;
}

/* Hauptelement mit Glassmorphismus */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(20px) saturate(180%);
  border-radius: 12px;
  box-shadow:
    0 0px 4px rgba(33, 150, 243, 0.3),
    inset 0 1px 0 hsla(0, 0%, 100%, 0.2);
  color: #fff;
  font-size: 14px;
  padding: 6px 20px;
}

/* Einzelne Breadcrumb-Items */
.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Verlinkbare Items */
.breadcrumb-link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.3s ease;
  padding: 4px 8px;
  border-radius: 6px;
}

.breadcrumb-link:hover {
  color: var(--primary-color);
  background: rgba(33, 150, 243, 0.1);
}

/* Separator zwischen Items */
.breadcrumb-separator {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
}

/* Aktuelle Seite (nicht klickbar) */
.breadcrumb-current {
  border-radius: 6px;
  color: var(--text-primary);
  font-weight: 600;
  padding: 4px 8px;
}

/* Icons in Breadcrumbs */
.breadcrumb-icon {
  font-size: 16px;
}
```

## 🚀 Geplante Implementierung

### 1. Zentralisierte Breadcrumb-Komponente

Erstelle eine wiederverwendbare TypeScript-Komponente:

```typescript
// breadcrumb.ts
interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
  current?: boolean;
}

function createBreadcrumb(items: BreadcrumbItem[]): string {
  // Implementierung folgt
}
```

### 2. Import-System

Jede HTML-Seite kann die Breadcrumb einfach importieren:

```html
<!-- In jeder HTML-Datei -->
<div id="breadcrumb-container"></div>
<script type="module">
  import { initBreadcrumb } from '/scripts/components/breadcrumb.js';

  initBreadcrumb([
    { label: 'Home', href: '/', icon: 'fa-home' },
    { label: 'Admin Dashboard', icon: 'fa-tachometer-alt', current: true },
  ]);
</script>
```

### 3. Automatische Breadcrumb-Generierung

Basierend auf der URL-Struktur:

```typescript
// Auto-generate breadcrumbs from URL
function generateBreadcrumbsFromURL(): BreadcrumbItem[] {
  const path = window.location.pathname;
  // Logik zur Pfad-Analyse
}
```

## 📊 Breadcrumb-Struktur für alle Seiten

### Admin-Bereich

- **Home** → Admin Dashboard
- **Home** → Admin Dashboard → Benutzer verwalten
- **Home** → Admin Dashboard → Konfiguration
- **Home** → Admin Dashboard → Umfragen

### Employee-Bereich

- **Home** → Mitarbeiter Dashboard
- **Home** → Mitarbeiter Dashboard → Dokumente
- **Home** → Mitarbeiter Dashboard → Schwarzes Brett
- **Home** → Mitarbeiter Dashboard → Chat

### Gemeinsame Bereiche

- **Home** → Profil
- **Home** → Einstellungen
- **Home** → Kalender

## 🎯 Vorteile der zentralisierten Lösung

1. **Konsistenz**: Einheitliches Design auf allen Seiten
2. **Wartbarkeit**: Änderungen nur an einer Stelle nötig
3. **Flexibilität**: Einfache Anpassung pro Seite möglich
4. **Performance**: Komponente wird einmal geladen und gecacht
5. **Accessibility**: Zentrale ARIA-Label Verwaltung

## 📝 Implementierungs-Reihenfolge

1. **Phase 1**: TypeScript-Komponente erstellen
2. **Phase 2**: CSS in globale Styles auslagern
3. **Phase 3**: Admin-Seiten migrieren
4. **Phase 4**: Employee-Seiten migrieren
5. **Phase 5**: Automatische Breadcrumb-Generierung

## 🔧 Verwendung nach Implementierung

```javascript
// Einfachste Verwendung (Auto-Generated)
initBreadcrumb();

// Manuelle Definition
initBreadcrumb([
  { label: 'Home', href: '/', icon: 'fa-home' },
  { label: 'Verwaltung', href: '/admin', icon: 'fa-cog' },
  { label: 'Benutzer', icon: 'fa-users', current: true },
]);

// Mit Custom-Optionen
initBreadcrumb(items, {
  container: '#my-breadcrumb',
  separator: '/',
  showIcons: true,
});
```

## ⚠️ Wichtige Hinweise

- Breadcrumbs ersetzen NICHT den Seitentitel
- Maximal 3-4 Ebenen für mobile Geräte
- Immer "Home" als ersten Eintrag
- Aktuelle Seite ist nie klickbar
- Icons verbessern die visuelle Orientierung
