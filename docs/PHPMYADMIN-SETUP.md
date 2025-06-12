# phpMyAdmin Setup für Assixx

## 🎉 phpMyAdmin ist jetzt installiert!

### 📍 Zugang

- **URL**: http://localhost:8080
- **Benutzer**: assixx_user
- **Passwort**: AssixxP@ss2025!

### 🔧 Container Management

```bash
# Status prüfen
docker ps | grep phpmyadmin

# Container stoppen
docker stop assixx-phpmyadmin

# Container starten
docker start assixx-phpmyadmin

# Container entfernen
docker stop assixx-phpmyadmin && docker rm assixx-phpmyadmin
```

### 🔒 Sicherheitshinweise

1. **NUR für Development!** - Niemals in Production verwenden
2. Port 8080 ist von außen erreichbar - bei Bedarf Firewall konfigurieren
3. Für Production: Adminer oder Desktop-Tools wie TablePlus verwenden

### 🛠️ Alternative Tools

Falls phpMyAdmin nicht gewünscht:

1. **Adminer** (leichter):

   ```yaml
   adminer:
     image: adminer
     container_name: assixx-adminer
     restart: unless-stopped
     ports:
       - 8080:8080
     networks:
       - assixx-network
   ```

2. **Desktop-Tools**:
   - TablePlus (Mac/Windows/Linux)
   - DBeaver (Free, alle Plattformen)
   - MySQL Workbench (Official, Free)
   - HeidiSQL (Windows)

### 📊 Was kann man in phpMyAdmin sehen?

- Alle Assixx Tabellen
- **NEU**: plans, plan_features, tenant_plans, tenant_addons
- Daten durchsuchen und bearbeiten
- SQL-Queries ausführen
- Import/Export Funktionen
- Struktur-Änderungen (Vorsicht!)

### ⚠️ Wichtig

Die Datenbank-Verbindung erfolgt über das Docker-Netzwerk. Deshalb:

- Host: `mysql` (nicht localhost!)
- Port: 3306 (Standard MySQL Port)
- Alle Änderungen wirken sich direkt auf die Entwicklungs-DB aus!
