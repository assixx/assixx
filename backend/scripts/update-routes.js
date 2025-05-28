#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Mapping von Route-Dateien zu Controllern
const routeMappings = [
  { route: 'blackboard.js', controller: 'blackboard' },
  { route: 'calendar.js', controller: 'calendar' },
  { route: 'kvp.js', controller: 'kvp' },
  { route: 'surveys.js', controller: 'survey' },
  { route: 'teams.js', controller: 'team' },
  { route: 'departments.js', controller: 'department' },
  { route: 'shifts.js', controller: 'shift' },
  { route: 'features.js', controller: 'feature' },
  { route: 'admin.js', controller: 'admin' },
  { route: 'employee.js', controller: 'employee' },
];

// Einfaches Route Template
const routeTemplate = (controllerName) => `const express = require('express');
const router = express.Router();
const ${controllerName}Controller = require('../controllers/${controllerName}.controller');
const { authenticateToken } = require('../middleware/auth');
const { checkTenantAccess } = require('../middleware/tenant');

// Middleware anwenden
router.use(authenticateToken);
router.use(checkTenantAccess);

// Standard CRUD Routes
router.get('/', ${controllerName}Controller.getAll);
router.get('/:id', ${controllerName}Controller.getById);
router.post('/', ${controllerName}Controller.create);
router.put('/:id', ${controllerName}Controller.update);
router.delete('/:id', ${controllerName}Controller.delete);

// TODO: Spezifische Routes aus der alten Implementierung übernehmen

module.exports = router;`;

// Update alle Route-Dateien
async function updateRoutes() {
  const routesPath = path.join(__dirname, '../src/routes');

  console.log('📝 Erstelle Backup der Route-Dateien...');

  for (const mapping of routeMappings) {
    const routeFile = path.join(routesPath, mapping.route);
    const backupFile = `${routeFile}.backup`;

    try {
      // Erstelle Backup
      const content = await fs.readFile(routeFile, 'utf8');
      await fs.writeFile(backupFile, content);
      console.log(`✓ Backup erstellt: ${mapping.route}.backup`);

      // Schreibe neue Route mit Controller
      // await fs.writeFile(routeFile, routeTemplate(mapping.controller));
      // console.log(`✓ Route aktualisiert: ${mapping.route}`);

      console.log(
        `⚠️  ${mapping.route} - Manuelles Update empfohlen (spezifische Routes erhalten)`
      );
    } catch (error) {
      console.error(`✗ Fehler bei ${mapping.route}:`, error.message);
    }
  }

  console.log(
    '\n📌 Hinweis: Die Backups wurden erstellt. Die Routes müssen manuell aktualisiert werden,'
  );
  console.log(
    '   um spezifische Implementierungen zu erhalten. Verwende die Controller-Methoden'
  );
  console.log('   anstatt der direkten Datenbankabfragen.');
}

// Führe Update aus
updateRoutes().catch(console.error);
