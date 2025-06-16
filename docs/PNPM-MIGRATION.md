# 📦 pnpm Migration Guide

## Was ist pnpm?

**pnpm** (Performant npm) ist ein schnellerer, platzsparender Package Manager, der Hard Links statt Kopien verwendet.

## Migration von npm zu pnpm

### 1. Installation

```bash
# pnpm global installieren
npm install -g pnpm
```

### 2. Projekt migrieren

```bash
# Alte node_modules und lock-files entfernen
rm -rf node_modules package-lock.json

# Mit pnpm installieren
pnpm install
```

### 3. Befehle

| npm Befehl | pnpm Äquivalent |
|------------|-----------------|
| `npm install` | `pnpm install` |
| `npm install express` | `pnpm add express` |
| `npm install -D jest` | `pnpm add -D jest` |
| `npm run dev` | `pnpm dev` |
| `npm test` | `pnpm test` |

### 4. Docker

Die Dockerfiles wurden bereits angepasst und verwenden jetzt pnpm.

### 5. Vorteile

- **Speicherplatz**: Gemeinsamer Store für alle Projekte
- **Geschwindigkeit**: Schnellere Installationen durch Hard Links
- **Sicherheit**: Strikte Abhängigkeiten, keine "Phantom Dependencies"

## Wichtige Dateien

- `pnpm-lock.yaml` - Ersetzt `package-lock.json`
- `.npmrc` → `.pnpmrc` (falls vorhanden)

## Troubleshooting

```bash
# Cache löschen
pnpm store prune

# Alle Dependencies neu installieren
pnpm install --force
```