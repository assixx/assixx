const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const Department = require('../models/department');
const User = require('../models/user');
const logger = require('../utils/logger');

const router = express.Router();

// Nur Admins und Root-Benutzer dürfen Abteilungen verwalten
router.use(authenticateToken);
router.use((req, res, next) => {
  console.log(`Departments route - User: ${req.user?.username}, Role: ${req.user?.role}`);
  if (req.user.role === 'admin' || req.user.role === 'root') {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
});

// Abteilung erstellen
router.post('/', async (req, res) => {
  try {
    const { name, description, manager_id, parent_id } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Abteilungsname ist erforderlich' });
    }
    
    // Wenn ein Manager angegeben ist, prüfen ob dieser existiert
    if (manager_id) {
      const manager = await User.findById(manager_id);
      if (!manager) {
        return res.status(400).json({ message: 'Der angegebene Manager existiert nicht' });
      }
    }
    
    // Wenn eine übergeordnete Abteilung angegeben ist, prüfen ob diese existiert
    if (parent_id) {
      const parentDept = await Department.findById(parent_id);
      if (!parentDept) {
        return res.status(400).json({ message: 'Die angegebene übergeordnete Abteilung existiert nicht' });
      }
    }
    
    const departmentId = await Department.create(req.body);
    logger.info(`Department created with ID ${departmentId} by user ${req.user.username}`);
    
    res.status(201).json({ 
      message: 'Abteilung erfolgreich erstellt', 
      departmentId 
    });
  } catch (error) {
    logger.error(`Error creating department: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Erstellen der Abteilung', error: error.message });
  }
});

// Alle Abteilungen abrufen
router.get('/', async (req, res) => {
  try {
    logger.info(`Fetching departments for user: ${req.user.username}`);
    const departments = await Department.findAll();
    logger.info(`Returning ${departments.length} departments`);
    res.json(departments);
  } catch (error) {
    logger.error(`Error fetching departments: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Abteilungen', error: error.message });
  }
});

// Einzelne Abteilung abrufen
router.get('/:id', async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Abteilung nicht gefunden' });
    }
    
    res.json(department);
  } catch (error) {
    logger.error(`Error fetching department ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Abteilung', error: error.message });
  }
});

// Abteilung aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { name, description, manager_id, parent_id } = req.body;
    const departmentId = req.params.id;
    
    // Prüfen, ob die Abteilung existiert
    const department = await Department.findById(departmentId);
    
    if (!department) {
      return res.status(404).json({ message: 'Abteilung nicht gefunden' });
    }
    
    if (!name) {
      return res.status(400).json({ message: 'Abteilungsname ist erforderlich' });
    }
    
    // Wenn ein Manager angegeben ist, prüfen ob dieser existiert
    if (manager_id) {
      const manager = await User.findById(manager_id);
      if (!manager) {
        return res.status(400).json({ message: 'Der angegebene Manager existiert nicht' });
      }
    }
    
    // Wenn eine übergeordnete Abteilung angegeben ist, prüfen ob diese existiert
    if (parent_id) {
      // Verhindern einer zirkulären Referenz
      if (parent_id === departmentId) {
        return res.status(400).json({ message: 'Eine Abteilung kann nicht sich selbst als Übergeordnete haben' });
      }
      
      const parentDept = await Department.findById(parent_id);
      if (!parentDept) {
        return res.status(400).json({ message: 'Die angegebene übergeordnete Abteilung existiert nicht' });
      }
    }
    
    const success = await Department.update(departmentId, req.body);
    
    if (success) {
      logger.info(`Department ${departmentId} updated by user ${req.user.username}`);
      res.json({ message: 'Abteilung erfolgreich aktualisiert' });
    } else {
      logger.warn(`Failed to update department ${departmentId}`);
      res.status(500).json({ message: 'Fehler beim Aktualisieren der Abteilung' });
    }
  } catch (error) {
    logger.error(`Error updating department ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Aktualisieren der Abteilung', error: error.message });
  }
});

// Abteilung löschen
router.delete('/:id', async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Prüfen, ob die Abteilung existiert
    const department = await Department.findById(departmentId);
    
    if (!department) {
      return res.status(404).json({ message: 'Abteilung nicht gefunden' });
    }
    
    // Prüfen, ob Benutzer in dieser Abteilung sind
    const users = await Department.getUsersByDepartment(departmentId);
    
    if (users.length > 0) {
      return res.status(400).json({ 
        message: 'Diese Abteilung kann nicht gelöscht werden, da ihr noch Benutzer zugeordnet sind',
        users
      });
    }
    
    const success = await Department.delete(departmentId);
    
    if (success) {
      logger.info(`Department ${departmentId} deleted by user ${req.user.username}`);
      res.json({ message: 'Abteilung erfolgreich gelöscht' });
    } else {
      logger.warn(`Failed to delete department ${departmentId}`);
      res.status(500).json({ message: 'Fehler beim Löschen der Abteilung' });
    }
  } catch (error) {
    logger.error(`Error deleting department ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Löschen der Abteilung', error: error.message });
  }
});

// Mitglieder einer Abteilung abrufen
router.get('/:id/members', async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Prüfen, ob die Abteilung existiert
    const department = await Department.findById(departmentId);
    
    if (!department) {
      return res.status(404).json({ message: 'Abteilung nicht gefunden' });
    }
    
    const users = await Department.getUsersByDepartment(departmentId);
    res.json(users);
  } catch (error) {
    logger.error(`Error fetching members for department ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Abteilungsmitglieder', error: error.message });
  }
});

module.exports = router;