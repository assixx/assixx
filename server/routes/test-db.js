/**
 * TEST-ONLY ROUTES - NOT FOR PRODUCTION!
 * Diese Routen sind nur für Testzwecke gedacht und sollten in Produktion deaktiviert werden.
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

// Direkter Zugriff auf die Datenbank für Testzwecke
router.get('/employees', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE role = "employee"');
    console.log('DB test route: Found employees:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Error in test DB route:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/departments', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM departments');
    console.log('DB test route: Found departments:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Error in test DB route:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/documents', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM documents');
    console.log('DB test route: Found documents:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Error in test DB route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test-Route, um alle Tabellen zu zählen
router.get('/counts', async (req, res) => {
  try {
    const [employeeCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "employee"');
    const [departmentCount] = await db.query('SELECT COUNT(*) as count FROM departments');
    const [documentCount] = await db.query('SELECT COUNT(*) as count FROM documents');
    
    console.log('DB test counts:', {
      employees: employeeCount[0].count,
      departments: departmentCount[0].count,
      documents: documentCount[0].count
    });
    
    res.json({
      employees: employeeCount[0].count,
      departments: departmentCount[0].count,
      documents: documentCount[0].count
    });
  } catch (error) {
    console.error('Error in test DB counts route:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;