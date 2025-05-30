# 🚀 TypeScript Merge Vorbereitungsplan

## 📋 Pre-Merge Checkliste

### 1️⃣ Versionierung & Backup (ZUERST!)
```bash
# Aktuellen Stand taggen
git checkout master
git pull origin master
git tag -a v0.0.1-javascript -m "Letzte JavaScript Version vor TypeScript Migration"
git push origin v0.0.1-javascript

# Backup Branch erstellen
git checkout -b backup/javascript-v0.0.1
git push origin backup/javascript-v0.0.1
```

### 2️⃣ Branch Status prüfen
```bash
# TypeScript Branch auschecken
git checkout feature/typescript
git pull origin feature/typescript

# Differenz zum Master prüfen
git diff master --stat
git log master..feature/typescript --oneline
```

### 3️⃣ Alte JavaScript Files identifizieren
```bash
# Liste aller .js Files die durch .ts ersetzt wurden
find backend/src -name "*.js" | while read jsfile; do
  tsfile="${jsfile%.js}.ts"
  if [ -f "$tsfile" ]; then
    echo "ZU LÖSCHEN: $jsfile (ersetzt durch $tsfile)"
  fi
done
```

### 4️⃣ Dokumentation Updates

#### Zu aktualisierende Files:
- [ ] **README.md** - TypeScript erwähnen, Build-Anweisungen
- [ ] **ARCHITECTURE.md** - Tech Stack auf TypeScript aktualisieren
- [ ] **DEVELOPMENT-GUIDE.md** - TypeScript Entwicklungsrichtlinien
- [ ] **SETUP-*.md** - TypeScript Build-Schritte hinzufügen
- [ ] **DATABASE-SETUP-README.md** - TypeScript Migrations erwähnen
- [ ] **CLAUDE.md** - TypeScript-spezifische Anweisungen

### 5️⃣ Package.json & Dependencies
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "nodemon --watch 'src/**/*.ts' --exec 'ts-node' src/server.ts",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/**/*.ts"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/express": "^4.x",
    "typescript": "^5.x",
    "ts-node": "^10.x",
    "nodemon": "^3.x",
    "@typescript-eslint/parser": "^6.x",
    "@typescript-eslint/eslint-plugin": "^6.x"
  }
}
```

### 6️⃣ TypeScript Konfiguration prüfen

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 7️⃣ .gitignore Updates
```
# TypeScript
dist/
*.tsbuildinfo
.tscache/

# Alte JS Build-Artefakte
build/
```

### 8️⃣ CI/CD Pipeline Updates
- GitHub Actions auf TypeScript Build umstellen
- Docker Images mit TypeScript Support
- Deployment Scripts anpassen

### 9️⃣ Testing vor dem Merge
```bash
# Clean Install
rm -rf node_modules package-lock.json
npm install

# TypeScript Build
npm run build

# Type Checking
npm run typecheck

# Linting
npm run lint

# Tests ausführen
npm test

# Development Server testen
npm run dev
```

### 🔟 Finale Merge-Vorbereitung
```bash
# Master auf neuesten Stand bringen
git checkout master
git pull origin master

# TypeScript Branch rebasen
git checkout feature/typescript
git rebase master

# Konflikte lösen falls nötig
# ...

# Finaler Test
npm run build && npm test
```

## ⚠️ WICHTIGE HINWEISE

1. **Backup ist PFLICHT** - Vor dem Merge unbedingt taggen und backup erstellen
2. **Schrittweise vorgehen** - Jeden Schritt einzeln durchführen und testen
3. **Team informieren** - Alle Entwickler über den Merge informieren
4. **Downtime planen** - Eventuell kurze Downtime für Production einplanen

## 📅 Zeitplan
- Pre-Merge Vorbereitung: 2-3 Stunden
- Merge & Tests: 1 Stunde
- Post-Merge Cleanup: 1 Stunde
- Buffer für Probleme: 2 Stunden

**Geschätzte Gesamtzeit: 6-7 Stunden**