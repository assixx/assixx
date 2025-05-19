const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { checkFeature } = require('../middleware/features');
const Document = require('../models/document');
const logger = require('../utils/logger');

const router = express.Router();

// Konfiguriere multer für Datei-Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)) //Dateiname mit Zeitstempel
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit auf 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt!'), false);
    }
  }
});

// Dokument hochladen
router.post('/upload', authenticateToken, authorizeRole('admin'), upload.single('document'), async (req, res) => {
  const adminId = req.user.id;
  logger.info(`Admin ${adminId} attempting to upload a document`);
  try {
    if (!req.file) {
      throw new Error('Keine Datei hochgeladen');
    }
    const { originalname, filename, path: filePath } = req.file;
    const { userId } = req.body;
    
    // Lese den Dateiinhalt
    const fileContent = await fs.readFile(filePath);

    const document = await Document.create({ 
      fileName: originalname, 
      filePath: filename, 
      userId,
      fileContent: fileContent
    });

    // Lösche die temporäre Datei
    await fs.unlink(filePath);

    logger.info(`Admin ${adminId} successfully uploaded document ${document.id} for user ${userId}`);
    res.status(201).json({ message: 'Dokument erfolgreich hochgeladen', documentId: document.id });
  } catch (error) {
    logger.error(`Error uploading document by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Hochladen des Dokuments', error: error.message });
  }
});

// Dokumente für einen Benutzer abrufen
router.get('/user/:userId', authenticateToken, async (req, res) => {
  const requesterId = req.user.id;
  const { userId } = req.params;
  logger.info(`User ${requesterId} requesting documents for user ${userId}`);
  try {
    // Überprüfe, ob der Anforderer berechtigt ist, die Dokumente zu sehen
    if (req.user.role !== 'admin' && requesterId !== userId) {
      logger.warn(`Unauthorized access attempt: User ${requesterId} tried to access documents of user ${userId}`);
      return res.status(403).json({ message: 'Nicht autorisiert' });
    }

    const documents = await Document.findByUserId(userId);
    logger.info(`Retrieved ${documents.length} documents for user ${userId}`);
    res.json(documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      uploadDate: doc.uploadDate
    })));
  } catch (error) {
    logger.error(`Error retrieving documents for user ${userId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Dokumente', error: error.message });
  }
});

// Dokument herunterladen
router.get('/:documentId', authenticateToken, async (req, res) => {
  const requesterId = req.user.id;
  const { documentId } = req.params;
  logger.info(`User ${requesterId} attempting to download document ${documentId}`);
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      logger.warn(`Document ${documentId} not found`);
      return res.status(404).json({ message: 'Dokument nicht gefunden' });
    }

    // Überprüfe, ob der Anforderer berechtigt ist, das Dokument herunterzuladen
    if (req.user.role !== 'admin' && requesterId !== document.userId) {
      logger.warn(`Unauthorized access attempt: User ${requesterId} tried to download document ${documentId}`);
      return res.status(403).json({ message: 'Nicht autorisiert' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${document.fileName}`);
    res.send(document.fileContent);
    logger.info(`User ${requesterId} successfully downloaded document ${documentId}`);
  } catch (error) {
    logger.error(`Error downloading document ${documentId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Herunterladen des Dokuments', error: error.message });
  }
});

module.exports = router;