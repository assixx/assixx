const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizeRole } = require('../auth');
const { 
  validateCreateEmployee, 
  validateUpdateEmployee, 
  validateToggleEmployeeStatus 
} = require('../middleware/validators');
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

router.get('/employees', async (req, res) => {
  try {
    const employees = await User.findByRole('employee');
    
    // Log für Debug-Zwecke
    console.log(`Retrieved ${employees.length} employees:`, employees);
    logger.info(`Retrieved ${employees.length} employees`);
    
    res.json(employees);
  } catch (error) {
    console.error(`Error retrieving employees from DB:`, error);
    logger.error(`Error retrieving employees: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Mitarbeiter', error: error.message });
  }
});

// Einzelnen Mitarbeiter abrufen
router.get('/employees/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.id;
  
  logger.info(`Admin ${adminId} requesting employee ${employeeId}`);
  
  try {
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    }
    
    res.json(employee);
  } catch (error) {
    logger.error(`Error retrieving employee ${employeeId} for Admin ${adminId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen des Mitarbeiters', error: error.message });
  }
});

// Mitarbeiter aktualisieren
router.put('/employees/:id', authenticateToken, authorizeRole('admin'), validateUpdateEmployee, async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.id;
  
  logger.info(`Admin ${adminId} attempting to update employee ${employeeId}`);
  
  try {
    // Prüfen, ob der Mitarbeiter existiert
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    }
    
    // Stelle sicher, dass keine Rolle geändert wird (Sicherheits-Maßnahme)
    if (req.body.role && req.body.role !== employee.role) {
      return res.status(403).json({ message: 'Die Rolle eines Mitarbeiters kann nicht geändert werden' });
    }
    
    // Update durchführen
    const success = await User.update(employeeId, req.body);
    
    if (success) {
      logger.info(`Employee ${employeeId} updated successfully by Admin ${adminId}`);
      res.json({ 
        message: 'Mitarbeiter erfolgreich aktualisiert',
        success: true 
      });
    } else {
      logger.warn(`Failed to update employee ${employeeId}`);
      res.status(500).json({ 
        message: 'Fehler beim Aktualisieren des Mitarbeiters',
        success: false 
      });
    }
  } catch (error) {
    logger.error(`Error updating employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ 
      message: 'Fehler beim Aktualisieren des Mitarbeiters', 
      error: error.message,
      success: false 
    });
  }
});

// Mitarbeiterstatus ändern (aktivieren/deaktivieren)
router.put('/toggle-employee-status/:id', authenticateToken, authorizeRole('admin'), validateToggleEmployeeStatus, async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.id;
  const { status } = req.body;
  
  logger.info(`Admin ${adminId} attempting to toggle status of employee ${employeeId} to ${status}`);
  
  try {
    // Prüfen, ob der Mitarbeiter existiert
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    }
    
    // Überprüfen, ob der Mitarbeiter wirklich die Rolle 'employee' hat
    if (employee.role !== 'employee') {
      return res.status(403).json({ 
        message: 'Nur Mitarbeiter-Konten können aktiviert/deaktiviert werden',
        success: false 
      });
    }
    
    // Wenn der Status schon dem gewünschten Status entspricht, kein Update notwendig
    if (employee.status === status) {
      return res.json({ 
        message: `Mitarbeiter ist bereits ${status === 'active' ? 'aktiviert' : 'deaktiviert'}`,
        success: true,
        changed: false
      });
    }
    
    // Update durchführen
    const success = await User.update(employeeId, { status });
    
    if (success) {
      logger.info(`Employee ${employeeId} status changed to ${status} by Admin ${adminId}`);
      res.json({ 
        message: `Mitarbeiter wurde ${status === 'active' ? 'aktiviert' : 'deaktiviert'}`,
        success: true,
        changed: true
      });
    } else {
      logger.warn(`Failed to update status of employee ${employeeId}`);
      res.status(500).json({ 
        message: 'Fehler beim Aktualisieren des Mitarbeiterstatus',
        success: false 
      });
    }
  } catch (error) {
    logger.error(`Error updating status of employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ 
      message: 'Fehler beim Aktualisieren des Mitarbeiterstatus', 
      error: error.message,
      success: false 
    });
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
    // Prüfen, ob die ID numerisch ist
    if (isNaN(employeeId)) {
      logger.warn(`Invalid employee ID format: ${employeeId}`);
      return res.status(400).json({ 
        message: 'Ungültige Mitarbeiter-ID', 
        success: false 
      });
    }
    
    // Prüfen, ob der Mitarbeiter existiert
    const employeeToDelete = await User.findById(employeeId);
    
    if (!employeeToDelete) {
      logger.warn(`Employee with ID ${employeeId} not found`);
      return res.status(404).json({ 
        message: 'Mitarbeiter nicht gefunden',
        success: false 
      });
    }
    
    // Sicherstellen, dass nur Mitarbeiter gelöscht werden können (keine Admins!)
    if (employeeToDelete.role !== 'employee') {
      logger.warn(`User with ID ${employeeId} is not an employee but ${employeeToDelete.role}`);
      return res.status(403).json({ 
        message: 'Der zu löschende Benutzer ist kein Mitarbeiter',
        success: false 
      });
    }
    
    // Verhindern, dass Admin sich selbst löscht (sollte nicht passieren können, ist aber eine zusätzliche Sicherheit)
    if (parseInt(employeeId) === parseInt(adminId)) {
      logger.warn(`Admin ${adminId} attempted to delete themselves`);
      return res.status(403).json({ 
        message: 'Sie können Ihren eigenen Account nicht löschen',
        success: false 
      });
    }
    
    // Prüfen, ob mit diesem Mitarbeiter Dokumente verknüpft sind
    try {
      const documentCount = await User.getDocumentCount(employeeId);
      if (documentCount > 0) {
        logger.warn(`Employee ${employeeId} has ${documentCount} documents, suggesting archive instead of delete`);
        return res.status(200).json({
          message: `Der Mitarbeiter hat ${documentCount} verknüpfte Dokumente. Sie können den Mitarbeiter archivieren, um ihn inaktiv zu setzen und die Dokumente zu behalten.`,
          documentCount: documentCount,
          canArchive: true,
          success: false
        });
      }
    } catch (docError) {
      logger.error(`Error checking for documents when deleting employee ${employeeId}: ${docError.message}`);
      // Der Fehler wird abgefangen, aber wir brechen nicht ab, um den Hauptzweck des Endpunkts nicht zu beeinträchtigen
    }
    
    // Mitarbeiter löschen
    const success = await User.delete(employeeId);
    
    if (success) {
      logger.info(`Employee with ID ${employeeId} deleted successfully by Admin ${adminId}`);
      res.json({ 
        message: 'Mitarbeiter erfolgreich gelöscht',
        success: true 
      });
    } else {
      logger.warn(`Failed to delete employee with ID ${employeeId}`);
      res.status(500).json({ 
        message: 'Fehler beim Löschen des Mitarbeiters',
        success: false 
      });
    }
  } catch (error) {
    logger.error(`Error deleting employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ 
      message: 'Fehler beim Löschen des Mitarbeiters', 
      error: error.message,
      success: false 
    });
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
router.get('/dashboard-stats', authenticateToken, authorizeRole('admin'), async (req, res) => {
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

// Neue Routen für die Archivierung von Mitarbeitern

// Mitarbeiter archivieren
router.post('/archive-employee/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.id;
  
  logger.info(`Admin ${adminId} attempting to archive employee ${employeeId}`);
  
  try {
    // Prüfen, ob die ID numerisch ist
    if (isNaN(employeeId)) {
      logger.warn(`Invalid employee ID format: ${employeeId}`);
      return res.status(400).json({ 
        message: 'Ungültige Mitarbeiter-ID', 
        success: false 
      });
    }
    
    // Prüfen, ob der Mitarbeiter existiert
    const employeeToArchive = await User.findById(employeeId);
    
    if (!employeeToArchive) {
      logger.warn(`Employee with ID ${employeeId} not found`);
      return res.status(404).json({ 
        message: 'Mitarbeiter nicht gefunden',
        success: false 
      });
    }
    
    // Sicherstellen, dass nur Mitarbeiter archiviert werden können (keine Admins!)
    if (employeeToArchive.role !== 'employee') {
      logger.warn(`User with ID ${employeeId} is not an employee but ${employeeToArchive.role}`);
      return res.status(403).json({ 
        message: 'Der zu archivierende Benutzer ist kein Mitarbeiter',
        success: false 
      });
    }
    
    // Verhindern, dass Admin sich selbst archiviert
    if (parseInt(employeeId) === parseInt(adminId)) {
      logger.warn(`Admin ${adminId} attempted to archive themselves`);
      return res.status(403).json({ 
        message: 'Sie können Ihren eigenen Account nicht archivieren',
        success: false 
      });
    }
    
    // Mitarbeiter archivieren
    const success = await User.archiveUser(employeeId);
    
    if (success) {
      logger.info(`Employee with ID ${employeeId} archived successfully by Admin ${adminId}`);
      res.json({ 
        message: 'Mitarbeiter erfolgreich archiviert',
        success: true 
      });
    } else {
      logger.warn(`Failed to archive employee with ID ${employeeId}`);
      res.status(500).json({ 
        message: 'Fehler beim Archivieren des Mitarbeiters',
        success: false 
      });
    }
  } catch (error) {
    logger.error(`Error archiving employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ 
      message: 'Fehler beim Archivieren des Mitarbeiters', 
      error: error.message,
      success: false 
    });
  }
});

// Mitarbeiter aus dem Archiv wiederherstellen
router.post('/unarchive-employee/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.id;
  
  logger.info(`Admin ${adminId} attempting to unarchive employee ${employeeId}`);
  
  try {
    // Prüfen, ob die ID numerisch ist
    if (isNaN(employeeId)) {
      logger.warn(`Invalid employee ID format: ${employeeId}`);
      return res.status(400).json({ 
        message: 'Ungültige Mitarbeiter-ID', 
        success: false 
      });
    }
    
    // Prüfen, ob der Mitarbeiter existiert
    const employeeToUnarchive = await User.findById(employeeId);
    
    if (!employeeToUnarchive) {
      logger.warn(`Employee with ID ${employeeId} not found`);
      return res.status(404).json({ 
        message: 'Mitarbeiter nicht gefunden',
        success: false 
      });
    }
    
    // Sicherstellen, dass der Benutzer tatsächlich archiviert ist
    if (!employeeToUnarchive.is_archived) {
      logger.warn(`Employee ${employeeId} is not archived`);
      return res.status(400).json({ 
        message: 'Der Mitarbeiter ist nicht archiviert',
        success: false 
      });
    }
    
    // Mitarbeiter wiederherstellen
    const success = await User.unarchiveUser(employeeId);
    
    if (success) {
      logger.info(`Employee with ID ${employeeId} unarchived successfully by Admin ${adminId}`);
      res.json({ 
        message: 'Mitarbeiter erfolgreich wiederhergestellt',
        success: true 
      });
    } else {
      logger.warn(`Failed to unarchive employee with ID ${employeeId}`);
      res.status(500).json({ 
        message: 'Fehler beim Wiederherstellen des Mitarbeiters',
        success: false 
      });
    }
  } catch (error) {
    logger.error(`Error unarchiving employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ 
      message: 'Fehler beim Wiederherstellen des Mitarbeiters', 
      error: error.message,
      success: false 
    });
  }
});

// Archivierte Mitarbeiter abrufen
router.get('/archived-employees', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  
  logger.info(`Admin ${adminId} requesting archived employees`);
  
  try {
    const archivedEmployees = await User.findArchivedUsers('employee');
    
    logger.info(`Retrieved ${archivedEmployees.length} archived employees for Admin ${adminId}`);
    
    res.json(archivedEmployees);
  } catch (error) {
    logger.error(`Error retrieving archived employees for Admin ${adminId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der archivierten Mitarbeiter', error: error.message });
  }
});

// Modifizieren der delete-employee Route, um die Archivierungsoption anzubieten
router.delete('/delete-employee/:id/force', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const employeeId = req.params.id;
  
  logger.info(`Admin ${adminId} attempting to force-delete employee ${employeeId}`);
  
  try {
    // Prüfen, ob die ID numerisch ist
    if (isNaN(employeeId)) {
      return res.status(400).json({ 
        message: 'Ungültige Mitarbeiter-ID', 
        success: false 
      });
    }
    
    // Prüfen, ob der Mitarbeiter existiert
    const employeeToDelete = await User.findById(employeeId);
    
    if (!employeeToDelete) {
      return res.status(404).json({ 
        message: 'Mitarbeiter nicht gefunden',
        success: false 
      });
    }
    
    // Sicherstellen, dass nur Mitarbeiter gelöscht werden können
    if (employeeToDelete.role !== 'employee') {
      return res.status(403).json({ 
        message: 'Der zu löschende Benutzer ist kein Mitarbeiter',
        success: false 
      });
    }
    
    // Verhindern, dass Admin sich selbst löscht
    if (parseInt(employeeId) === parseInt(adminId)) {
      return res.status(403).json({ 
        message: 'Sie können Ihren eigenen Account nicht löschen',
        success: false 
      });
    }
    
    // Mitarbeiter löschen, auch wenn Dokumente vorhanden sind
    const success = await User.delete(employeeId);
    
    if (success) {
      logger.info(`Employee with ID ${employeeId} force-deleted successfully by Admin ${adminId}`);
      res.json({ 
        message: 'Mitarbeiter endgültig gelöscht',
        success: true 
      });
    } else {
      res.status(500).json({ 
        message: 'Fehler beim Löschen des Mitarbeiters',
        success: false 
      });
    }
  } catch (error) {
    logger.error(`Error force-deleting employee ${employeeId}: ${error.message}`);
    res.status(500).json({ 
      message: 'Fehler beim endgültigen Löschen des Mitarbeiters', 
      error: error.message,
      success: false 
    });
  }
});

module.exports = router;