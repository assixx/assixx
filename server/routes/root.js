const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const User = require('../models/user');

const router = express.Router();

// Admin-Benutzer erstellen
router.post('/create-admin', authenticateToken, authorizeRole('root'), async (req, res) => {
  console.log(`Attempt to create admin user by root user: ${req.user.username}`);
  try {
    const adminData = { ...req.body, role: 'admin' };
    const adminId = await User.create(adminData);
    console.log(`Admin user created successfully with ID: ${adminId}`);
    res.status(201).json({ message: 'Admin-Benutzer erfolgreich erstellt', adminId });
  } catch (error) {
    console.error('Fehler beim Erstellen des Admin-Benutzers:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ein Benutzer mit diesem Benutzernamen oder dieser E-Mail existiert bereits.' });
    }
    res.status(500).json({ message: 'Fehler beim Erstellen des Admin-Benutzers', error: error.message });
  }
});

// Liste aller Admin-Benutzer abrufen
router.get('/admins', authenticateToken, authorizeRole('root'), async (req, res) => {
  console.log(`Fetching admin users list for root user: ${req.user.username}`);
  try {
    const admins = await User.findByRole('admin');
    console.log(`Retrieved ${admins.length} admin users`);
    res.json(admins);
  } catch (error) {
    console.error('Fehler beim Abrufen der Admin-Benutzer:', error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Admin-Benutzer', error: error.message });
  }
});

// Admin-Benutzer löschen
router.delete('/delete-admin/:id', authenticateToken, authorizeRole('root'), async (req, res) => {
  const rootUser = req.user.username;
  const adminId = req.params.id;
  
  console.log(`Attempt to delete admin (ID: ${adminId}) by root user: ${rootUser}`);
  
  try {
    // Zuerst prüfen, ob der zu löschende Benutzer wirklich ein Admin ist
    const adminToDelete = await User.findById(adminId);
    
    if (!adminToDelete) {
      console.log(`Admin user with ID ${adminId} not found`);
      return res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
    }
    
    if (adminToDelete.role !== 'admin') {
      console.log(`User with ID ${adminId} is not an admin`);
      return res.status(403).json({ message: 'Der zu löschende Benutzer ist kein Admin' });
    }
    
    // Admin löschen - hier müssen wir eine neue Methode in der User-Klasse erstellen
    const success = await User.delete(adminId);
    
    if (success) {
      console.log(`Admin user with ID ${adminId} deleted successfully`);
      res.json({ message: 'Admin-Benutzer erfolgreich gelöscht' });
    } else {
      console.log(`Failed to delete admin user with ID ${adminId}`);
      res.status(500).json({ message: 'Fehler beim Löschen des Admin-Benutzers' });
    }
  } catch (error) {
    console.error(`Error deleting admin user with ID ${adminId}:`, error);
    res.status(500).json({ message: 'Fehler beim Löschen des Admin-Benutzers', error: error.message });
  }
});

module.exports = router;