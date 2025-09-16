# DOMPurify Table Rendering Fix

## Problem

DOMPurify zerstört CSS/HTML bei isolierten `<tr>` Tags ohne Table-Kontext.

## Symptom

- Tabellen verlieren CSS-Styles
- HTML-Struktur wird beschädigt

## Ursache

```typescript
// ❌ FALSCH - Nur tbody-Inhalt
areasTableBody.innerHTML = domPurify.sanitize(html); // html = "<tr>...</tr>"
```

## Lösung

```typescript
// ✅ RICHTIG - Komplette Tabelle
setHTML(tableContainer, `
  <table class="admin-table">
    <thead>...</thead>
    <tbody>${rows}</tbody>
  </table>
`);
```

## Regel

**IMMER** komplette HTML-Strukturen rendern, nie isolierte Fragmente!
