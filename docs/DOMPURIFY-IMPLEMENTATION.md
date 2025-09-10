# DOMPurify Implementation Guide

## Prinzip

**KEIN Inline-JavaScript in HTML!** Alles in TypeScript-Module.

## Installation

```bash
cd frontend
pnpm add dompurify  # ✅ Bereits installiert
```

## Verwendung

### In TypeScript (.ts) Dateien

```typescript
import DOMPurify from 'dompurify';

// Bei innerHTML mit Nutzerdaten
element.innerHTML = DOMPurify.sanitize(userContent);

// Bei reinem Text besser
element.textContent = userContent;  // Automatisch sicher!
```

### Migration von HTML mit Inline-JS

**Alt (HTML mit Inline-JS):**

```html
<script>
  document.getElementById('content').innerHTML = data;
</script>
```

**Neu (TypeScript-Modul):**

1. Erstelle `/frontend/src/scripts/page-name.ts`:

   ```typescript
   import DOMPurify from 'dompurify';

   function init() {
     const element = document.getElementById('content');
     if (element) {
       element.innerHTML = DOMPurify.sanitize(data);
     }
   }

   document.addEventListener('DOMContentLoaded', init);
   ```

2. In HTML nur noch:

   ```html
   <script type="module" src="./scripts/page-name.ts"></script>
   ```

## Wann DOMPurify verwenden?

- ✅ API-Responses mit HTML
- ✅ Nutzereingaben
- ✅ Datenbank-Content
- ❌ Statische Strings ohne Variablen
- ❌ Reiner Text (nutze `textContent`)

## Build

Vite bündelt automatisch:

```bash
pnpm run build
```

Fertig. Mehr nicht nötig.

## Migration Status

| Seite | Script Tag | DOMPurify benutzt | Status |
|-------|------------|-------------------|---------|
| admin-dashboard.html | ✅ Lokal | Ja (2x) | ✅ OK |
| document-upload.html | ✅ Lokal | Ja (2x) | ✅ OK |
| employee-dashboard.html | ✅ Lokal | Ja (1x) | ✅ OK |
| employee-documents.html | ✅ Lokal | Ja (6x) | ✅ OK |
| employee-profile.html | ✅ Lokal | Ja (5x) | ✅ OK |
| manage-employees.html | ✅ Lokal | Ja (1x) | ✅ OK |
| kvp.html | ✅ Lokal | Ja (1x) | ✅ OK |
| login.html | ✅ Lokal | Ja (1x) | ✅ OK |
| root-features.html | ✅ Lokal | Ja (1x) | ✅ OK |
| root-profile.html | ✅ Lokal | Ja (3x) | ✅ OK |
| salary-documents.html | ✅ Lokal | Ja (3x) | ✅ OK |
| signup.html | ❌ Entfernt | Nein | ✅ OK |
| survey-admin-test.html | ✅ Lokal | Ja (1x) | ✅ OK |
| survey-details.html | ✅ Lokal | Ja (2x) | ✅ OK |
| survey-employee.html | ✅ Lokal | Ja (2x) | ✅ OK |
| tenant-deletion-status.html | ✅ Lokal | Ja (1x) | ✅ OK |

**TODO:** TypeScript-Module erstellen und DOMPurify importieren!
