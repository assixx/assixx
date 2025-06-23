# 🐳 Docker Setup

## Voraussetzungen
- Docker & Docker Compose installiert
- 2GB RAM, 5GB Speicher

## Quick Start

### Option 1: Automatisch (Empfohlen)
```bash
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx/docker
./docker-init.sh
```

### Option 2: Manuell
```bash
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# .env erstellen
cp .env.example .env
# JWT_SECRET und SESSION_SECRET in .env anpassen!

# Volumes erstellen (nur beim ersten Mal)
docker volume create assixx_mysql_data
docker volume create assixx_redis_data

# Starten
cd docker && docker-compose up -d
```

## Zugriff
- App: http://localhost:3000
- phpMyAdmin: http://localhost:8080
- Health: http://localhost:3000/health

## Wichtige Befehle

```bash
# Status
docker-compose ps

# Logs
docker-compose logs -f backend

# Neustart
docker-compose restart backend

# Stoppen
docker-compose down

# Update
git pull && docker-compose up -d --build
```

## Troubleshooting

**Container startet nicht:**
```bash
docker-compose logs backend
docker-compose down && docker-compose up -d
```

**Port belegt:**
```bash
lsof -i :3000
# Oder anderen Port nutzen in docker-compose.yml
```

**MySQL Fehler:**
```bash
docker exec -it assixx-mysql mysql -u assixx_user -pAssixxP@ss2025!
```

## Test-Accounts
- Root: simon@scs-technik.de / Test123!
- Neue Firma: http://localhost:3000/pages/signup.html