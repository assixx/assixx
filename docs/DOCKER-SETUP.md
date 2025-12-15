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
docker volume create assixx_postgres_data
docker volume create assixx_redis_data

# Starten
cd docker && docker-compose up -d
```

## Zugriff

- App: <http://localhost:3000>
- Health: <http://localhost:3000/health>
- PostgreSQL: `docker exec -it assixx-postgres psql -U assixx_user -d assixx`

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

**PostgreSQL Fehler:**

```bash
docker exec -it assixx-postgres psql -U assixx_user -d assixx
```

## Test-Accounts

- Root: <simon@scs-technik.de> / Test123!
- Neue Firma: <http://localhost:3000/pages/signup.html>
