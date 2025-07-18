#!/usr/bin/env node

/**
 * Setup-Skript für neue Firmen (Tenants)
 * Verwendung: node setup-tenant.js <tenant-id> <firmenname>
 */

const { initializeTenantDatabase } = require("../database/tenantDb");
const fs = require("fs").promises;
const path = require("path");

async function setupNewTenant(tenantId, companyName) {
  console.log(`Einrichtung für neue Firma: ${companyName} (${tenantId})`);

  try {
    // 1. Tenant-Konfiguration erstellen
    const newTenantConfig = {
      id: tenantId,
      name: companyName,
      database: `assixx_${tenantId}`,
      branding: {
        logo: `/assets/${tenantId}-logo.png`,
        primaryColor: "#2196F3",
        secondaryColor: "#FFC107",
      },
      features: {
        maxUsers: 100,
        errorReporting: true,
        surveys: true,
        calendar: true,
        suggestions: true,
      },
      languages: ["de", "en"],
    };

    // 2. Konfiguration zur tenants.js hinzufügen
    const configPath = path.join(__dirname, "../config/tenants.js");
    const configContent = await fs.readFile(configPath, "utf8");

    // Neue Konfiguration einfügen
    const updatedConfig = configContent.replace(
      "module.exports = {",
      `module.exports = {\n    // ${companyName}\n    ${tenantId}: ${JSON.stringify(newTenantConfig, null, 8)},\n`,
    );

    await fs.writeFile(configPath, updatedConfig);
    console.log("✓ Tenant-Konfiguration erstellt");

    // 3. Datenbank initialisieren
    await initializeTenantDatabase(tenantId);
    console.log("✓ Datenbank initialisiert");

    // 4. Assets-Verzeichnis erstellen
    const assetsDir = path.join(__dirname, "../public/assets");
    await fs.mkdir(assetsDir, { recursive: true });

    // 5. Platzhalter-Logo kopieren
    const defaultLogo = path.join(assetsDir, "default-logo.png");
    const tenantLogo = path.join(assetsDir, `${tenantId}-logo.png`);

    try {
      await fs.copyFile(defaultLogo, tenantLogo);
      console.log("✓ Logo-Platzhalter erstellt");
    } catch {
      console.log("⚠ Kein Standard-Logo gefunden, überspringe...");
    }

    // 6. Nginx-Konfiguration generieren
    const nginxConfig = `
# Konfiguration für ${companyName}
server {
    listen 80;
    server_name ${tenantId}.assixx.de;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

    const nginxPath = path.join(__dirname, `../nginx/${tenantId}.conf`);
    await fs.mkdir(path.dirname(nginxPath), { recursive: true });
    await fs.writeFile(nginxPath, nginxConfig);
    console.log("✓ Nginx-Konfiguration erstellt");

    console.log(`
Einrichtung für ${companyName} abgeschlossen!

Nächste Schritte:
1. Logo hochladen: /public/assets/${tenantId}-logo.png
2. Nginx-Konfiguration aktivieren: sudo ln -s ${nginxPath} /etc/nginx/sites-enabled/
3. Nginx neu laden: sudo nginx -s reload
4. DNS-Eintrag erstellen für: ${tenantId}.assixx.de
5. SSL-Zertifikat erstellen: sudo certbot --nginx -d ${tenantId}.assixx.de

Subdomain: https://${tenantId}.assixx.de
`);
  } catch (error) {
    console.error("Fehler beim Setup:", error);
    process.exit(1);
  }
}

// CLI-Argumente verarbeiten
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("Verwendung: node setup-tenant.js <tenant-id> <firmenname>");
  console.log('Beispiel: node setup-tenant.js bosch "Robert Bosch GmbH"');
  process.exit(1);
}

const [tenantId, companyName] = args;

// Validierung
if (!/^[a-z0-9-]+$/.test(tenantId)) {
  console.error(
    "Fehler: Tenant-ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.",
  );
  process.exit(1);
}

// Setup ausführen
setupNewTenant(tenantId, companyName);
