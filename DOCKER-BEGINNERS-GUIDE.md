# 🐳 Docker Anfänger-Guide für Assixx

## 🎯 Was ist Docker?

Docker ist wie eine "Verpackung" für deine Anwendung:
- **Container** = Eine Box mit allem was deine App braucht
- **Image** = Die Bauanleitung für die Box
- **docker-compose** = Startet mehrere Boxen zusammen (Backend, Datenbank, etc.)

## 🚀 Assixx mit Docker starten (Einfachste Methode)

### 1. Vorbereitung (einmalig)

```bash
# Im Assixx Projekt-Ordner:
cd /home/scs/projects/Assixx

# Environment-Datei erstellen
cp .env.docker.example .env

# .env anpassen (WICHTIG!)
nano .env
# Ändere mindestens:
# - JWT_SECRET (beliebiger langer Text)
# - SESSION_SECRET (beliebiger langer Text)
# Speichern: Ctrl+O, Enter, Ctrl+X
```

### 2. Docker starten

```bash
# Alle Container starten
docker-compose up -d

# Was passiert:
# - MySQL Datenbank wird gestartet
# - Backend wird gebaut und gestartet
# - Redis wird gestartet (für Sessions)
```

### 3. Status prüfen

```bash
# Sind alle Container aktiv?
docker-compose ps

# Logs ansehen
docker-compose logs -f
# (Beenden mit Ctrl+C)

# Funktioniert die App?
curl http://localhost:3000/health
```

### 4. App benutzen

Öffne im Browser: http://localhost:3000

## 📝 Tägliche Arbeit mit Docker

### Morgens: Projekt starten

```bash
# Terminal in VSCode öffnen
cd /home/scs/projects/Assixx

# Docker starten (falls nicht läuft)
docker-compose up -d

# Logs prüfen
docker-compose logs --tail=50
```

### Während der Entwicklung

```bash
# Backend neu starten (nach Code-Änderungen)
docker-compose restart backend

# Logs live anschauen
docker-compose logs -f backend

# In Container reinschauen (für Debugging)
docker exec -it assixx-backend sh
```

### Abends: Projekt stoppen

```bash
# Alle Container stoppen (Daten bleiben erhalten!)
docker-compose stop

# Oder komplett runterfahren (Daten bleiben trotzdem!)
docker-compose down
```

## 🔧 Häufige Probleme & Lösungen

### Problem: "Cannot connect to Docker daemon"

```bash
# Lösung: Docker Desktop starten (Windows)
# Dann warten bis Docker-Icon grün ist
```

### Problem: "Port 3000 already in use"

```bash
# Wer nutzt Port 3000?
lsof -i :3000

# Process beenden
kill -9 <PID>

# Oder anderen Port nutzen:
# In docker-compose.yml ändern:
# ports:
#   - "3001:3000"  # Dann localhost:3001 nutzen
```

### Problem: "Container exits immediately"

```bash
# Logs prüfen
docker-compose logs backend

# Meist fehlt .env Datei oder falsche Werte
```

## 🎨 VSCode Docker Extension nutzen

1. **Docker Extension installieren** (hast du schon)
2. **Docker Icon** in linker Sidebar
3. Dort siehst du:
   - Alle Container (grün = läuft, grau = gestoppt)
   - Rechtsklick → View Logs
   - Rechtsklick → Restart
   - Rechtsklick → Shell (Terminal im Container)

## 📊 Docker Befehle Spickzettel

```bash
# === BASICS ===
docker-compose up -d      # Starten (detached/Hintergrund)
docker-compose stop       # Stoppen
docker-compose down       # Stoppen + Netzwerk entfernen
docker-compose ps         # Status anzeigen
docker-compose logs       # Alle Logs
docker-compose logs -f    # Live Logs (follow)

# === ENTWICKLUNG ===
docker-compose restart backend    # Backend neustarten
docker-compose exec backend sh    # Shell im Container
docker-compose build             # Images neu bauen

# === DATENBANK ===
# MySQL Shell
docker exec -it assixx-mysql mysql -u root -p
# Passwort: StrongP@ssw0rd!123

# Backup erstellen
docker exec assixx-mysql mysqldump -u root -p assixx > backup.sql

# === AUFRÄUMEN ===
docker system prune       # Ungenutzte Container/Images löschen
docker volume prune       # Ungenutzte Volumes löschen
```

## 🚦 Workflow für neue Features

1. **Feature entwickeln** (normal in VSCode)
2. **Backend neustarten**: `docker-compose restart backend`
3. **Logs prüfen**: `docker-compose logs -f backend`
4. **Im Browser testen**: http://localhost:3000
5. **Commit & Push** (wie gewohnt)

## ⚡ Pro-Tipps

1. **Alias erstellen** für häufige Befehle:
```bash
# In ~/.bashrc hinzufügen:
alias dc='docker-compose'
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
```

2. **Docker Desktop Settings**:
   - Resources → Advanced → Memory: Mindestens 4GB
   - Resources → Advanced → CPUs: Mindestens 2

3. **Performance in WSL**:
   - Projekt-Dateien immer in WSL speichern (/home/...)
   - NICHT in Windows-Ordner (/mnt/c/...)

## 🆘 Hilfe

- **Docker Docs**: https://docs.docker.com/
- **Docker Compose**: https://docs.docker.com/compose/
- **VSCode Docker**: https://code.visualstudio.com/docs/containers/overview

---

**Tipp**: Keine Angst vor Docker! Die meiste Zeit brauchst du nur:
- `docker-compose up -d` (starten)
- `docker-compose logs -f` (Logs anschauen)
- `docker-compose restart backend` (nach Änderungen)