# DOMPurify Module Loading Fix

## Problem

- **Fehler:** `DOMPurify is not defined` in HTML-Seiten
- **Symptom:** `/js/purify.min.js` returns 200 OK aber zeigt "Module purify.min not found"
- **Ursache:** Die Datei existierte nicht im dist-Verzeichnis

## Lösung

### 1. DOMPurify ins public-Verzeichnis kopieren

```bash
mkdir -p frontend/public/js
cp node_modules/.pnpm/dompurify@*/node_modules/dompurify/dist/purify.min.js frontend/public/js/
```

### 2. Frontend neu bauen

```bash
docker exec assixx-backend pnpm run build
```

### 3. In dist-Verzeichnis kopieren

```bash
docker exec assixx-backend sh -c "cp /app/frontend/public/js/purify.min.js /app/frontend/dist/js/"
```

## Warum funktioniert das?

1. **Vite kopiert nicht automatisch** alle public-Dateien nach dist
2. **DOMPurify als globales Script** wird von allen HTML-Seiten erwartet
3. **Manuelles Kopieren** stellt sicher, dass die Datei verfügbar ist

## Verwendung in HTML

```html
<!-- DOMPurify global laden -->
<script src="/js/purify.min.js"></script>

<!-- Dann in Scripts verwenden -->
<script>
  element.innerHTML = DOMPurify.sanitize(userContent);
</script>
```

## Status

✅ Gelöst - DOMPurify funktioniert in allen HTML-Seiten
