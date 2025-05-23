const express = require('express');
const { authenticateToken, authorizeRole } = require('../auth');
const User = require('../models/user');
const AdminLog = require('../models/adminLog'); // Neue Klasse für Admin-Logs
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const router = express.Router();

// Admin-Benutzer erstellen
router.post('/create-admin', authenticateToken, authorizeRole('root'), async (req, res) => {
  logger.info(`Attempt to create admin user by root user: ${req.user.username}`);
  try {
    const adminData = { 
      ...req.body, 
      role: 'admin',
      tenant_id: req.user.tenant_id 
    };
    const adminId = await User.create(adminData);
    logger.info(`Admin user created successfully with ID: ${adminId}`);
    res.status(201).json({ message: 'Admin-Benutzer erfolgreich erstellt', adminId });
  } catch (error) {
    logger.error('Fehler beim Erstellen des Admin-Benutzers:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ein Benutzer mit diesem Benutzernamen oder dieser E-Mail existiert bereits.' });
    }
    res.status(500).json({ message: 'Fehler beim Erstellen des Admin-Benutzers', error: error.message });
  }
});

// Liste aller Admin-Benutzer abrufen
router.get('/admins', authenticateToken, authorizeRole('root'), async (req, res) => {
  logger.info(`Fetching admin users list for root user: ${req.user.username}`);
  try {
    const admins = await User.findByRole('admin', false, req.user.tenant_id);
    logger.info(`Retrieved ${admins.length} admin users`);
    res.json(admins);
  } catch (error) {
    logger.error('Fehler beim Abrufen der Admin-Benutzer:', error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Admin-Benutzer', error: error.message });
  }
});

// Admin-Benutzer löschen
router.delete('/delete-admin/:id', authenticateToken, authorizeRole('root'), async (req, res) => {
  const rootUser = req.user.username;
  const adminId = req.params.id;
  
  logger.info(`Attempt to delete admin (ID: ${adminId}) by root user: ${rootUser}`);
  
  try {
    // Zuerst prüfen, ob der zu löschende Benutzer wirklich ein Admin ist
    const adminToDelete = await User.findById(adminId);
    
    if (!adminToDelete) {
      logger.warn(`Admin user with ID ${adminId} not found`);
      return res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
    }
    
    if (adminToDelete.role !== 'admin') {
      logger.warn(`User with ID ${adminId} is not an admin`);
      return res.status(403).json({ message: 'Der zu löschende Benutzer ist kein Admin' });
    }
    
    // Admin löschen - hier müssen wir eine neue Methode in der User-Klasse erstellen
    const success = await User.delete(adminId);
    
    if (success) {
      logger.info(`Admin user with ID ${adminId} deleted successfully`);
      res.json({ message: 'Admin-Benutzer erfolgreich gelöscht' });
    } else {
      logger.warn(`Failed to delete admin user with ID ${adminId}`);
      res.status(500).json({ message: 'Fehler beim Löschen des Admin-Benutzers' });
    }
  } catch (error) {
    logger.error(`Error deleting admin user with ID ${adminId}:`, error);
    res.status(500).json({ message: 'Fehler beim Löschen des Admin-Benutzers', error: error.message });
  }
});

// NEUE ROUTE: Details eines Admin-Benutzers abrufen
router.get('/admin/:id', authenticateToken, authorizeRole('root'), async (req, res) => {
  const rootUser = req.user.username;
  const adminId = req.params.id;
  
  logger.info(`Root user ${rootUser} requesting details for admin ${adminId}`);
  
  try {
    const admin = await User.findById(adminId);
    
    if (!admin) {
      logger.warn(`Admin with ID ${adminId} not found`);
      return res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
    }
    
    if (admin.role !== 'admin') {
      logger.warn(`User with ID ${adminId} is not an admin`);
      return res.status(403).json({ message: 'Der abgefragte Benutzer ist kein Admin' });
    }
    
    // Passwort-Hash aus den Antwortdaten entfernen
    const { password, ...adminData } = admin;
    
    // Letzten Login-Zeitpunkt hinzufügen, falls vorhanden
    const lastLogin = await AdminLog.getLastLogin(adminId);
    if (lastLogin) {
      adminData.last_login = lastLogin.timestamp;
    }
    
    logger.info(`Details for admin ${adminId} retrieved successfully`);
    res.json(adminData);
  } catch (error) {
    logger.error(`Error retrieving details for admin ${adminId}:`, error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Admin-Details', error: error.message });
  }
});

// NEUE ROUTE: Admin-Benutzer aktualisieren
router.put('/admin/:id', authenticateToken, authorizeRole('root'), async (req, res) => {
  const rootUser = req.user.username;
  const adminId = req.params.id;
  
  logger.info(`Root user ${rootUser} attempting to update admin ${adminId}`);
  
  try {
    const admin = await User.findById(adminId);
    
    if (!admin) {
      logger.warn(`Admin with ID ${adminId} not found`);
      return res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
    }
    
    if (admin.role !== 'admin') {
      logger.warn(`User with ID ${adminId} is not an admin`);
      return res.status(403).json({ message: 'Der zu aktualisierende Benutzer ist kein Admin' });
    }
    
    // Aktualisierbare Felder extrahieren
    const { username, email, company, new_password, notes } = req.body;
    
    // Objekt für die Aktualisierung erstellen
    const updateData = {
      username,
      email,
      company,
      notes
    };
    
    // Wenn ein neues Passwort übermittelt wurde, Hash erstellen
    if (new_password && new_password.trim() !== '') {
      updateData.password = await bcrypt.hash(new_password, 10);
    }
    
    // Admin aktualisieren
    await User.update(adminId, updateData);
    
    logger.info(`Admin ${adminId} updated successfully by root user ${rootUser}`);
    res.json({ message: 'Admin-Benutzer erfolgreich aktualisiert' });
  } catch (error) {
    logger.error(`Error updating admin ${adminId}:`, error);
    res.status(500).json({ message: 'Fehler beim Aktualisieren des Admin-Benutzers', error: error.message });
  }
});

// NEUE ROUTE: Admin-Logs abrufen
router.get('/admin/:id/logs', authenticateToken, authorizeRole('root'), async (req, res) => {
  const rootUser = req.user.username;
  const adminId = req.params.id;
  const days = parseInt(req.query.days) || 0; // 0 bedeutet alle Logs
  
  logger.info(`Root user ${rootUser} requesting logs for admin ${adminId} (days: ${days})`);
  
  try {
    const admin = await User.findById(adminId);
    
    if (!admin) {
      logger.warn(`Admin with ID ${adminId} not found`);
      return res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
    }
    
    if (admin.role !== 'admin') {
      logger.warn(`User with ID ${adminId} is not an admin`);
      return res.status(403).json({ message: 'Der abgefragte Benutzer ist kein Admin' });
    }
    
    // Logs abrufen
    const logs = await AdminLog.getByUserId(adminId, days);
    
    logger.info(`Retrieved ${logs.length} logs for admin ${adminId}`);
    res.json(logs);
  } catch (error) {
    logger.error(`Error retrieving logs for admin ${adminId}:`, error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Admin-Logs', error: error.message });
  }
});

module.exports = router;