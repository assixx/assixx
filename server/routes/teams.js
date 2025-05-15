const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const Team = require('../models/team');
const Department = require('../models/department');
const User = require('../models/user');
const logger = require('../utils/logger');

const router = express.Router();

// Nur Admins und Root-Benutzer dürfen Teams verwalten
router.use(authenticateToken);
router.use((req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'root') {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
});

// Team erstellen
router.post('/', async (req, res) => {
  try {
    const { name, description, department_id, leader_id } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Teamname ist erforderlich' });
    }
    
    // Wenn eine Abteilung angegeben ist, prüfen ob diese existiert
    if (department_id) {
      const department = await Department.findById(department_id);
      if (!department) {
        return res.status(400).json({ message: 'Die angegebene Abteilung existiert nicht' });
      }
    }
    
    // Wenn ein Teamleiter angegeben ist, prüfen ob dieser existiert
    if (leader_id) {
      const leader = await User.findById(leader_id);
      if (!leader) {
        return res.status(400).json({ message: 'Der angegebene Teamleiter existiert nicht' });
      }
    }
    
    const teamId = await Team.create(req.body);
    logger.info(`Team created with ID ${teamId} by user ${req.user.username}`);
    
    res.status(201).json({ 
      message: 'Team erfolgreich erstellt', 
      teamId 
    });
  } catch (error) {
    logger.error(`Error creating team: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Erstellen des Teams', error: error.message });
  }
});

// Alle Teams abrufen
router.get('/', async (req, res) => {
  try {
    const teams = await Team.findAll();
    res.json(teams);
  } catch (error) {
    logger.error(`Error fetching teams: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Teams', error: error.message });
  }
});

// Einzelnes Team abrufen
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({ message: 'Team nicht gefunden' });
    }
    
    res.json(team);
  } catch (error) {
    logger.error(`Error fetching team ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen des Teams', error: error.message });
  }
});

// Team aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { name, description, department_id, leader_id } = req.body;
    const teamId = req.params.id;
    
    // Prüfen, ob das Team existiert
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ message: 'Team nicht gefunden' });
    }
    
    if (!name) {
      return res.status(400).json({ message: 'Teamname ist erforderlich' });
    }
    
    // Wenn eine Abteilung angegeben ist, prüfen ob diese existiert
    if (department_id) {
      const department = await Department.findById(department_id);
      if (!department) {
        return res.status(400).json({ message: 'Die angegebene Abteilung existiert nicht' });
      }
    }
    
    // Wenn ein Teamleiter angegeben ist, prüfen ob dieser existiert
    if (leader_id) {
      const leader = await User.findById(leader_id);
      if (!leader) {
        return res.status(400).json({ message: 'Der angegebene Teamleiter existiert nicht' });
      }
    }
    
    const success = await Team.update(teamId, req.body);
    
    if (success) {
      logger.info(`Team ${teamId} updated by user ${req.user.username}`);
      res.json({ message: 'Team erfolgreich aktualisiert' });
    } else {
      logger.warn(`Failed to update team ${teamId}`);
      res.status(500).json({ message: 'Fehler beim Aktualisieren des Teams' });
    }
  } catch (error) {
    logger.error(`Error updating team ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Aktualisieren des Teams', error: error.message });
  }
});

// Team löschen
router.delete('/:id', async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Prüfen, ob das Team existiert
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ message: 'Team nicht gefunden' });
    }
    
    const success = await Team.delete(teamId);
    
    if (success) {
      logger.info(`Team ${teamId} deleted by user ${req.user.username}`);
      res.json({ message: 'Team erfolgreich gelöscht' });
    } else {
      logger.warn(`Failed to delete team ${teamId}`);
      res.status(500).json({ message: 'Fehler beim Löschen des Teams' });
    }
  } catch (error) {
    logger.error(`Error deleting team ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Löschen des Teams', error: error.message });
  }
});

// Teammitglieder abrufen
router.get('/:id/members', async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Prüfen, ob das Team existiert
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ message: 'Team nicht gefunden' });
    }
    
    const members = await Team.getTeamMembers(teamId);
    res.json(members);
  } catch (error) {
    logger.error(`Error fetching members for team ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Teammitglieder', error: error.message });
  }
});

// Benutzer zu Team hinzufügen
router.post('/:id/members', async (req, res) => {
  try {
    const teamId = req.params.id;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'Benutzer-ID ist erforderlich' });
    }
    
    // Prüfen, ob das Team existiert
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ message: 'Team nicht gefunden' });
    }
    
    // Prüfen, ob der Benutzer existiert
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    const success = await Team.addUserToTeam(userId, teamId);
    
    if (success) {
      logger.info(`User ${userId} added to team ${teamId} by user ${req.user.username}`);
      res.json({ message: 'Benutzer erfolgreich zum Team hinzugefügt' });
    } else {
      logger.warn(`Failed to add user ${userId} to team ${teamId}`);
      res.status(500).json({ message: 'Fehler beim Hinzufügen des Benutzers zum Team' });
    }
  } catch (error) {
    logger.error(`Error adding user to team ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Hinzufügen des Benutzers zum Team', error: error.message });
  }
});

// Benutzer aus Team entfernen
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.params.userId;
    
    // Prüfen, ob das Team existiert
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ message: 'Team nicht gefunden' });
    }
    
    // Prüfen, ob der Benutzer existiert
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    const success = await Team.removeUserFromTeam(userId, teamId);
    
    if (success) {
      logger.info(`User ${userId} removed from team ${teamId} by user ${req.user.username}`);
      res.json({ message: 'Benutzer erfolgreich aus dem Team entfernt' });
    } else {
      logger.info(`User ${userId} is not a member of team ${teamId}`);
      res.status(404).json({ message: 'Benutzer ist kein Mitglied dieses Teams' });
    }
  } catch (error) {
    logger.error(`Error removing user from team ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Entfernen des Benutzers aus dem Team', error: error.message });
  }
});

// Liste aller Teams abrufen
router.get('/', authenticateToken, (req, res) => {
  // Test-Daten zurückgeben
  res.json([
    { id: 1, name: "Entwicklung", department_name: "IT", leader_name: "Max Mustermann", member_count: 5 },
    { id: 2, name: "Marketing", department_name: "Vertrieb", leader_name: "Maria Schmidt", member_count: 3 }
  ]);
});

module.exports = router;