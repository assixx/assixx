const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { validateCreateEmployee } = require('../middleware/validators');
const User = require('../models/user');
const logger = require('../utils/logger');
const Document = require('../models/document');
const Department = require('../models/department');

const router = express.Router();

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

router.post('/upload-document/:employeeId', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { employeeId } = req.params;
  const adminId = req.user.id;
  logger.info(`Admin ${adminId} attempting to upload document for Employee ${employeeId}`);
  try {
    const { fileName, fileContent } = req.body;
    // TODO: Implement file upload validation
    const documentId = await Document.create({ userId: employeeId, fileName, fileContent });
    logger.info(`Admin ${adminId} successfully uploaded document ${documentId} for Employee ${employeeId}`);
    res.status(201).json({ message: 'Dokument erfolgreich hochgeladen', documentId });
  } catch (error) {
    logger.error(`Error uploading document for Employee ${employeeId} by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Hochladen des Dokuments', error: error.message });
  }
});

// In server/routes/admin.js, add this route:

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

// Add dashboard stats endpoint
router.get('/dashboard-stats', async (req, res) => {
  try {
    // Get counts from database
    const employeeCount = await User.count({ role: 'employee' });
    const departmentCount = await Department.count();
    const teamCount = await Team.count();
    const documentCount = await Document.count();
    
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

// Add documents endpoint
router.get('/documents', async (req, res) => {
  try {
    const documents = await Document.findAll();
    res.json(documents);
  } catch (error) {
    logger.error(`Error retrieving documents: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Dokumente', error: error.message });
  }
});

module.exports = router;