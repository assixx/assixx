const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { validateCreateEmployee } = require('../middleware/validators');
const User = require('../models/user');
const Document = require('../models/document');
const logger = require('../utils/logger');
const Department = require('../models/department');

const router = express.Router();

// Konfiguriere multer für Datei-Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'doc-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // Limit auf 3MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt!'), false);
    }
  }
});

router.post('/create-employee', authenticateToken, authorizeRole('admin'), validateCreateEmployee, async (req, res) => {
  const adminId = req.user.id;
  logger.info(`Admin ${adminId} attempting to create a new employee`);
  try {
    const employeeData = { ...req.body, role: 'employee' };
    const employeeId = await User.create(employeeData);
    logger.info(`Admin ${adminId} created new employee with ID: ${employeeId}`);
    res.status(201).json({ message: 'Mitarbeiter erfolgreich erstellt', employeeId });
  } catch (error) {
    logger.error(`Error creating employee by Admin ${adminId}: ${error.message}`);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ein Mitarbeiter mit diesem Benutzernamen oder dieser E-Mail existiert bereits.' });
    }
    res.status(500).json({ message: 'Fehler beim Erstellen des Mitarbeiters', error: error.message });
  }
});

router.get('/employees', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  logger.info(`Admin ${adminId} requesting list of employees`);
  try {
    const employees = await User.findByRole('employee');
    logger.info(`Retrieved ${employees.length} employees for Admin ${adminId}`);
    res.json(employees);
  } catch (error) {
    logger.error(`Error retrieving employees for Admin ${adminId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Mitarbeiter', error: error.message });
  }
});

router.post('/upload-document/:employeeId', authenticateToken, authorizeRole('admin'), upload.single('document'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.employeeId;
  logger.info(`Admin ${adminId} attempting to upload document for Employee ${employeeId}`);
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Keine Datei hochgeladen' });
    }
    
    // Prüfen ob der Mitarbeiter existiert
    const employee = await User.findById(employeeId);
    if (!employee) {
      // Lösche die temporär hochgeladene Datei
      await fs.unlink(req.file.path);
      return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    }
    
    // Datei einlesen
    const filePath = req.file.path;
    const fileContent = await fs.readFile(filePath);
    
    // Dokument in der DB speichern
    const documentId = await Document.create({
      userId: employeeId,
      fileName: req.file.originalname,
      fileContent: fileContent
    });
    
    // Temporäre Datei löschen
    await fs.unlink(filePath);
    
    logger.info(`Admin ${adminId} successfully uploaded document ${documentId} for Employee ${employeeId}`);
    res.status(201).json({ message: 'Dokument erfolgreich hochgeladen', documentId });
  } catch (error) {
    logger.error(`Error uploading document for Employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    
    // Falls eine Datei hochgeladen wurde, sollte sie gelöscht werden
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error(`Error deleting temporary file: ${unlinkError.message}`);
      }
    }
    
    res.status(500).json({ message: 'Fehler beim Hochladen des Dokuments', error: error.message });
  }
});

router.delete('/delete-employee/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.id;
  
  logger.info(`Admin ${adminId} attempting to delete employee ${employeeId}`);
  
  try {
    // First check if the user to delete is actually an employee
    const employeeToDelete = await User.findById(employeeId);
    
    if (!employeeToDelete) {
      logger.warn(`Employee with ID ${employeeId} not found`);
      return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    }
    
    if (employeeToDelete.role !== 'employee') {
      logger.warn(`User with ID ${employeeId} is not an employee`);
      return res.status(403).json({ message: 'Der zu löschende Benutzer ist kein Mitarbeiter' });
    }
    
    // Delete employee
    const success = await User.delete(employeeId);
    
    if (success) {
      logger.info(`Employee with ID ${employeeId} deleted successfully by Admin ${adminId}`);
      res.json({ message: 'Mitarbeiter erfolgreich gelöscht' });
    } else {
      logger.warn(`Failed to delete employee with ID ${employeeId}`);
      res.status(500).json({ message: 'Fehler beim Löschen des Mitarbeiters' });
    }
  } catch (error) {
    logger.error(`Error deleting employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Löschen des Mitarbeiters', error: error.message });
  }
});

// Neue Route für Gehaltsabrechnungen
router.post('/upload-salary-document/:employeeId', authenticateToken, authorizeRole('admin'), upload.single('document'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.employeeId;
  
  logger.info(`Admin ${adminId} attempting to upload salary document for Employee ${employeeId}`);
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Keine Datei hochgeladen' });
    }
    
    // Prüfen ob der Mitarbeiter existiert
    const employee = await User.findById(employeeId);
    if (!employee) {
      // Lösche die Datei, die bereits hochgeladen wurde
      await fs.unlink(req.file.path);
      return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    }
    
    // Datei einlesen
    const filePath = req.file.path;
    const fileContent = await fs.readFile(filePath);
    
    // Metadaten aus dem Formular
    const { title, description, year, month } = req.body;
    
    // Dokument in der Datenbank speichern
    const documentId = await Document.create({
      userId: employeeId,
      fileName: title || req.file.originalname,
      fileContent: fileContent,
      category: 'salary',
      description: description || '',
      year: year || new Date().getFullYear(),
      month: month || ''
    });
    
    // Temporäre Datei löschen
    await fs.unlink(filePath);
    
    logger.info(`Admin ${adminId} successfully uploaded salary document ${documentId} for Employee ${employeeId}`);
    
    res.status(201).json({
      message: 'Gehaltsabrechnung erfolgreich hochgeladen',
      documentId
    });
  } catch (error) {
    logger.error(`Error uploading salary document for Employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    
    // Falls eine Datei hochgeladen wurde, sollte sie gelöscht werden
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error(`Error deleting temporary file: ${unlinkError.message}`);
      }
    }
    
    res.status(500).json({ message: 'Fehler beim Hochladen der Gehaltsabrechnung', error: error.message });
  }
});

// Gehaltsabrechnungen für einen Mitarbeiter abrufen (für Admins)
router.get('/employee-salary-documents/:employeeId', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.employeeId;
  const archived = req.query.archived === 'true';
  
  logger.info(`Admin ${adminId} requesting salary documents for Employee ${employeeId}`);
  
  try {
    // Prüfen ob der Mitarbeiter existiert
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    }
    
    const documents = await Document.findByUserIdAndCategory(employeeId, 'salary', archived);
    
    logger.info(`Retrieved ${documents.length} salary documents for Employee ${employeeId}`);
    
    res.json(documents);
  } catch (error) {
    logger.error(`Error retrieving salary documents for Employee ${employeeId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Gehaltsabrechnungen', error: error.message });
  }
});

// Dokument archivieren
router.put('/archive-document/:documentId', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const documentId = req.params.documentId;
  
  logger.info(`Admin ${adminId} attempting to archive document ${documentId}`);
  
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Dokument nicht gefunden' });
    }
    
    const success = await Document.archiveDocument(documentId);
    
    if (success) {
      logger.info(`Document ${documentId} archived successfully by Admin ${adminId}`);
      res.json({ message: 'Dokument erfolgreich archiviert' });
    } else {
      logger.warn(`Failed to archive document ${documentId}`);
      res.status(500).json({ message: 'Fehler beim Archivieren des Dokuments' });
    }
  } catch (error) {
    logger.error(`Error archiving document ${documentId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Archivieren des Dokuments', error: error.message });
  }
});

// Add dashboard stats endpoint
router.get('/dashboard-stats', async (req, res) => {
  try {
    // Get counts from database
    const employeeCount = await User.count({ role: 'employee' });
    let departmentCount = 0;
    let teamCount = 0;
    let documentCount = 0;
    
    try {
      if (typeof Department.count === 'function') {
        departmentCount = await Department.count();
      }
    } catch (e) {
      logger.warn("Could not count departments: " + e.message);
    }
    
    try {
      const Team = require('../models/team');
      if (typeof Team.count === 'function') {
        teamCount = await Team.count();
      }
    } catch (e) {
      logger.warn("Could not count teams: " + e.message);
    }
    
    try {
      if (typeof Document.count === 'function') {
        documentCount = await Document.count();
      }
    } catch (e) {
      logger.warn("Could not count documents: " + e.message);
    }
    
    res.json({
      employeeCount,
      departmentCount,
      teamCount,
      documentCount,
      adminName: req.user.username
    });
  } catch (error) {
    logger.error(`Error fetching dashboard stats: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Dashboard-Daten', error: error.message });
  }
});

module.exports = router;