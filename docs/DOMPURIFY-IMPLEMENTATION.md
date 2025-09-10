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
| admin-dashboard.html | ❌ Entfernt | Ja (2x) | ⚠️ Broken |
| document-upload.html | ❌ Entfernt | Ja (2x) | ⚠️ Broken |
| employee-dashboard.html | ❌ Entfernt | Ja (1x) | ⚠️ Broken |
| employee-documents.html | ❌ Entfernt | Ja (6x) | ⚠️ Broken |
| employee-profile.html | ❌ Entfernt | Ja (5x) | ⚠️ Broken |
| manage-employees.html | ❌ Entfernt | Ja (1x) | ⚠️ Broken |
| kvp.html | ❌ Entfernt | Ja (1x) | ⚠️ Broken |
| login.html | ❌ Entfernt | Ja (1x) | ⚠️ Broken |
| root-features.html | ❌ Entfernt | Ja (1x) | ⚠️ Broken |
| root-profile.html | ❌ Entfernt | Ja (3x) | ⚠️ Broken |
| salary-documents.html | ❌ Entfernt | Ja (3x) | ⚠️ Broken |
| signup.html | ❌ Entfernt | Nein | ✅ OK |
| survey-admin-test.html | ✅ CDN | Ja (1x) | ✅ OK |
| survey-details.html | ✅ CDN | Ja (2x) | ✅ OK |
| survey-employee.html | ✅ CDN | Ja (2x) | ✅ OK |
| tenant-deletion-status.html | ✅ CDN | Ja (1x) | ✅ OK |

**TODO:** TypeScript-Module erstellen und DOMPurify importieren!
