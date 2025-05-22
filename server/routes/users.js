const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizeRole } = require('../auth');
const User = require('../models/user');
const logger = require('../utils/logger');

const router = express.Router();

// Konfigurieren von multer für Profilbild-Uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/profile_pictures/');
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  // Akzeptiere nur Bilder
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Nur Bildformate sind erlaubt!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit auf 5MB
  fileFilter: fileFilter
});

// Middleware zum Überprüfen, ob der angemeldete Benutzer seine eigenen Daten abfragt
const checkOwnUser = (req, res, next) => {
  const requestedUserId = parseInt(req.params.id);
  const authenticatedUserId = parseInt(req.user.id);
  
  if (req.user.role === 'admin' || req.user.role === 'root' || requestedUserId === authenticatedUserId) {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
};

// ROUTES IN CORRECT ORDER - MOST SPECIFIC FIRST

// 0. Main user listing route - MUST come first before parameterized routes
// Alle Benutzer abrufen (mit optionalen Filtern) - nur für Admins
router.get('/', authenticateToken, (req, res, next) => {
  if (['admin', 'root'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
}, async (req, res) => {
  try {
    // Konvertiere is_archived zu Boolean, falls vorhanden
    let isArchived = undefined;
    if (req.query.is_archived !== undefined) {
      isArchived = req.query.is_archived === 'true';
    }
    
    const filters = {
      search: req.query.search || '',
      role: req.query.role || '',
      department_id: req.query.department_id || '',
      sort_by: req.query.sort_by || 'first_name',
      sort_dir: req.query.sort_dir || 'ASC',
      limit: parseInt(req.query.limit) || 50,
      page: parseInt(req.query.page) || 1,
      is_archived: isArchived
    };
    
    const users = await User.search(filters);
    const total = await User.count(filters);
    
    res.json({
      users,
      pagination: {
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        pages: Math.ceil(total / (parseInt(req.query.limit) || 50))
      }
    });
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Benutzer', error: error.message });
  }
});

// 1. Static specific routes
// Aktuellen Benutzer abrufen
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    // Passwort aus der Antwort entfernen
    const { password, ...userData } = user;
    
    res.json(userData);
  } catch (error) {
    logger.error(`Error fetching current user: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen des aktuellen Benutzers', error: error.message });
  }
});

// Teams des aktuellen Benutzers abrufen
router.get('/current/teams', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Prüfen, ob der Benutzer existiert
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    const Team = require('../models/team');
    const teams = await Team.getUserTeams(userId);
    
    res.json(teams);
  } catch (error) {
    logger.error(`Error fetching teams for current user: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Teams', error: error.message });
  }
});

// Benutzer suchen mit Filtern (nur für Admins und Root)
router.get('/search', authenticateToken, (req, res, next) => {
  if (['admin', 'root'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
}, async (req, res) => {
  try {
    // Konvertiere is_archived zu Boolean, falls vorhanden
    let isArchived = undefined;
    if (req.query.is_archived !== undefined) {
      isArchived = req.query.is_archived === 'true';
    }
    
    const filters = {
      search: req.query.search,
      role: req.query.role,
      department_id: req.query.department_id,
      sort_by: req.query.sort_by,
      sort_dir: req.query.sort_dir,
      limit: req.query.limit,
      page: req.query.page,
      is_archived: isArchived
    };
    
    const users = await User.search(filters);
    const total = await User.count(filters);
    
    res.json({
      users,
      pagination: {
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        pages: Math.ceil(total / (parseInt(req.query.limit) || 20))
      }
    });
  } catch (error) {
    logger.error(`Error searching users: ${error.message}`);
    res.status(500).json({ message: 'Fehler bei der Benutzersuche', error: error.message });
  }
});

// 2. Profile routes
// Eigenes Profil aktualisieren - für alle Benutzer (nur bestimmte Felder)
router.put('/profile/update', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await User.updateOwnProfile(userId, req.body);
    
    if (result.success) {
      logger.info(`User ${userId} updated their own profile`);
      res.json({ message: result.message });
    } else {
      logger.warn(`Failed to update own profile for user ${userId}: ${result.message}`);
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    logger.error(`Error updating own profile for user ${req.user.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Aktualisieren des eigenen Profils', error: error.message });
  }
});

// Profilbild hochladen
router.post('/profile/upload-picture', authenticateToken, upload.single('profile_picture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Keine Datei hochgeladen' });
    }
    
    const userId = req.user.id;
    const filePath = req.file.path;
    
    // Altes Profilbild entfernen, wenn vorhanden
    const user = await User.findById(userId);
    if (user && user.profile_picture) {
      try {
        await fs.unlink(user.profile_picture);
      } catch (unlinkError) {
        logger.warn(`Could not delete old profile picture: ${unlinkError.message}`);
        // Wir brechen nicht ab, wenn das alte Bild nicht gelöscht werden kann
      }
    }
    
    // Pfad in der Datenbank speichern
    const success = await User.updateProfilePicture(userId, filePath);
    
    if (success) {
      logger.info(`Profile picture updated for user ${userId}`);
      res.json({ 
        message: 'Profilbild erfolgreich aktualisiert',
        path: filePath
      });
    } else {
      logger.warn(`Failed to update profile picture for user ${userId}`);
      res.status(500).json({ message: 'Fehler beim Aktualisieren des Profilbilds' });
    }
  } catch (error) {
    logger.error(`Error uploading profile picture: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Hochladen des Profilbilds', error: error.message });
  }
});

// Profilbild löschen
router.delete('/profile/picture', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Benutzer abrufen
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    // Wenn kein Profilbild vorhanden ist
    if (!user.profile_picture) {
      return res.status(404).json({ message: 'Kein Profilbild vorhanden' });
    }
    
    // Bild löschen
    try {
      await fs.unlink(user.profile_picture);
    } catch (unlinkError) {
      logger.warn(`Could not delete profile picture: ${unlinkError.message}`);
      // Wir setzen trotzdem den Pfad in der Datenbank zurück
    }
    
    // Pfad in der Datenbank zurücksetzen
    const success = await User.updateProfilePicture(userId, null);
    
    if (success) {
      logger.info(`Profile picture removed for user ${userId}`);
      res.json({ message: 'Profilbild erfolgreich entfernt' });
    } else {
      logger.warn(`Failed to remove profile picture for user ${userId}`);
      res.status(500).json({ message: 'Fehler beim Entfernen des Profilbilds' });
    }
  } catch (error) {
    logger.error(`Error removing profile picture: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Entfernen des Profilbilds', error: error.message });
  }
});

// 3. Parameterized routes (these must come AFTER the more specific routes)
// Benutzerdetails abrufen
router.get('/:id', authenticateToken, checkOwnUser, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    // Passwort aus der Antwort entfernen
    const { password, ...userData } = user;
    
    res.json(userData);
  } catch (error) {
    logger.error(`Error fetching user ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen des Benutzers', error: error.message });
  }
});

// Benutzer aktualisieren - nur für Admins
router.put('/:id', authenticateToken, (req, res, next) => {
  if (['admin', 'root'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
}, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prüfen, ob der Benutzer existiert
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    // Update durchführen
    const success = await User.update(userId, req.body);
    
    if (success) {
      logger.info(`User ${userId} updated by user ${req.user.username}`);
      res.json({ message: 'Benutzer erfolgreich aktualisiert' });
    } else {
      logger.warn(`Failed to update user ${userId}`);
      res.status(500).json({ message: 'Fehler beim Aktualisieren des Benutzers' });
    }
  } catch (error) {
    logger.error(`Error updating user ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Aktualisieren des Benutzers', error: error.message });
  }
});

// Benutzer archivieren - nur für Admins und Root
router.post('/:id/archive', authenticateToken, (req, res, next) => {
  if (['admin', 'root'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
}, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prüfen, ob der Benutzer existiert
    const user = await User.findById(userId, true);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    // Prüfen, ob der Benutzer bereits archiviert ist
    if (user.is_archived) {
      return res.status(400).json({ message: 'Benutzer ist bereits archiviert' });
    }
    
    // Archivierung durchführen
    const success = await User.archiveUser(userId);
    
    if (success) {
      logger.info(`User ${userId} archived by user ${req.user.username}`);
      res.json({ message: 'Benutzer erfolgreich archiviert' });
    } else {
      logger.warn(`Failed to archive user ${userId}`);
      res.status(500).json({ message: 'Fehler beim Archivieren des Benutzers' });
    }
  } catch (error) {
    logger.error(`Error archiving user ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Archivieren des Benutzers', error: error.message });
  }
});

// Benutzer-Archivierung aufheben - nur für Admins und Root
router.post('/:id/unarchive', authenticateToken, (req, res, next) => {
  if (['admin', 'root'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
}, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prüfen, ob der Benutzer existiert
    const user = await User.findById(userId, true);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    // Prüfen, ob der Benutzer archiviert ist
    if (!user.is_archived) {
      return res.status(400).json({ message: 'Benutzer ist nicht archiviert' });
    }
    
    // Archivierung aufheben
    const success = await User.unarchiveUser(userId);
    
    if (success) {
      logger.info(`User ${userId} unarchived by user ${req.user.username}`);
      res.json({ message: 'Benutzer-Archivierung erfolgreich aufgehoben' });
    } else {
      logger.warn(`Failed to unarchive user ${userId}`);
      res.status(500).json({ message: 'Fehler beim Aufheben der Benutzer-Archivierung' });
    }
  } catch (error) {
    logger.error(`Error unarchiving user ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Aufheben der Benutzer-Archivierung', error: error.message });
  }
});

// Teams des Benutzers abrufen
router.get('/:id/teams', authenticateToken, checkOwnUser, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prüfen, ob der Benutzer existiert
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    const Team = require('../models/team');
    const teams = await Team.getUserTeams(userId);
    
    res.json(teams);
  } catch (error) {
    logger.error(`Error fetching teams for user ${req.params.id}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Teams', error: error.message });
  }
});

// Removing the inappropriate route for listing departments
// This should be in a departments.js file instead

module.exports = router;