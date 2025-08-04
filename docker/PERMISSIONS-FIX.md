# Docker Permissions Fix

## Problem
Docker Container erstellt Dateien als root (UID 0), was zu "Permission denied" Fehlern führt.

## Lösung
Container läuft jetzt mit deinen User-Rechten!

### Einmalige Einrichtung
```bash
cd docker
./setup-permissions.sh
docker-compose down
docker-compose up -d
```

### Was macht das?
1. **Dynamische UIDs**: Container nutzt deine User/Group ID
2. **Keine hardcoded Werte**: Funktioniert für jeden User
3. **Automatische Erkennung**: Script erkennt deine IDs automatisch

### Best Practices ✅
- **Security**: Container läuft nicht als root
- **Portabilität**: Funktioniert auf jedem System
- **Wartbarkeit**: Keine manuellen chown-Befehle mehr nötig

### Alternative Lösungen

#### 1. Build im Container (Empfohlen)
```bash
docker exec assixx-backend pnpm build
```

#### 2. Fixup Script (Notlösung)
```bash
# In package.json hinzufügen:
"scripts": {
  "build:fix": "pnpm build && sudo chown -R $USER:$USER backend/dist frontend/dist"
}
```

#### 3. Volume mit delegated (Performance)
```yaml
volumes:
  - ../backend:/app/backend:delegated
```

### Troubleshooting
Falls immer noch Probleme:
```bash
# Ownership der existierenden Dateien fixen
sudo chown -R $USER:$USER ~/projects/Assixx/backend/dist
sudo chown -R $USER:$USER ~/projects/Assixx/frontend/dist

# Container neu starten
docker-compose down
docker-compose up -d
```