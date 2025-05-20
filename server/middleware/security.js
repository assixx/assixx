const express = require('express');
const { authenticateToken, authorizeRole } = require('./auth-unified');
const User = require('../models/user');
const Document = require('../models/document');

const router = express.Router();

// Mitarbeiterinformationen abrufen
router.get('/info', authenticateToken, authorizeRole('employee'), async (req, res) => {
    try {
        const employee = await User.findById(req.user.id);
        if (!employee) {
            return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        }
        res.json(employee);
    } catch (error) {
        console.error('Fehler beim Abrufen der Mitarbeiterinformationen:', error);
        res.status(500).json({ message: 'Fehler beim Abrufen der Mitarbeiterinformationen', error: error.message });
    }
});

// Dokumente des Mitarbeiters abrufen
router.get('/documents', authenticateToken, authorizeRole('employee'), async (req, res) => {
    try {
        const documents = await Document.findByUserId(req.user.id);
        res.json(documents);
    } catch (error) {
        console.error('Fehler beim Abrufen der Dokumente:', error);
        res.status(500).json({ message: 'Fehler beim Abrufen der Dokumente', error: error.message });
    }
});

// Einzelnes Dokument herunterladen
router.get('/documents/:documentId', authenticateToken, authorizeRole('employee'), async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await Document.findById(documentId);
        
        if (!document || document.user_id !== req.user.id) {
            return res.status(404).json({ message: 'Dokument nicht gefunden' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${document.file_name}`);
        res.send(document.file_content);
    } catch (error) {
        console.error('Fehler beim Herunterladen des Dokuments:', error);
        res.status(500).json({ message: 'Fehler beim Herunterladen des Dokuments', error: error.message });
    }
});

module.exports = router;