const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizeRole } = require('../auth');
const { checkFeature } = require('../middleware/features');
const { checkDocumentAccess } = require('../middleware/documentAccess');
const Document = require('../models/document');
const logger = require('../utils/logger');

const router = express.Router();

// Konfiguriere multer für Datei-Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents/')
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
    const { userId, category, description, year, month } = req.body;
    
    if (!userId) {
      throw new Error('Kein Benutzer ausgewählt');
    }
    
    // Lese den Dateiinhalt
    const fileContent = await fs.readFile(filePath);

    const documentId = await Document.create({ 
      fileName: originalname, 
      filePath: filename, 
      userId,
      fileContent: fileContent,
      category: category || 'other',
      description: description || '',
      year: year || null,
      month: month || null
    });

    // Lösche die temporäre Datei
    await fs.unlink(filePath);

    logger.info(`Admin ${adminId} successfully uploaded document ${documentId} for user ${userId}`);
    res.status(201).json({ message: 'Dokument erfolgreich hochgeladen', documentId });
  } catch (error) {
    logger.error(`Error uploading document by Admin ${adminId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Hochladen des Dokuments', error: error.message });
  }
});

// Alle Dokumente für Admin abrufen
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const { category } = req.query;
  logger.info(`Admin ${adminId} requesting all documents${category ? ` of category ${category}` : ''}`);
  
  try {
    let documents;
    if (category) {
      // Wenn eine Kategorie angegeben ist, filtere danach
      documents = await Document.findAll(category);
    } else {
      documents = await Document.findAll();
    }
    
    logger.info(`Retrieved ${documents.length} documents${category ? ` of category ${category}` : ''}`);
    res.json(documents);
  } catch (error) {
    logger.error(`Error retrieving documents: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Abrufen der Dokumente', error: error.message });
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
router.get('/:documentId', 
  authenticateToken, 
  checkDocumentAccess({ allowAdmin: true, allowDepartmentHeads: true, requireOwnership: false }), 
  async (req, res) => {
    const requesterId = req.user.id;
    const { documentId } = req.params;
    const { inline } = req.query; // Option zum Anzeigen im Browser statt herunterzuladen
    logger.info(`User ${requesterId} attempting to download document ${documentId}`);
    
    try {
      // Dokument wurde bereits vom Middleware geladen und ist in req.document verfügbar
      const document = req.document;
      
      // Download-Zähler erhöhen
      await Document.incrementDownloadCount(documentId);

      // Content-Type Header setzen
      res.setHeader('Content-Type', 'application/pdf');
      
      // Content-Disposition Header basierend auf inline-Parameter setzen
      const disposition = inline === 'true' ? 'inline' : 'attachment';
      res.setHeader('Content-Disposition', `${disposition}; filename=${encodeURIComponent(document.file_name)}`);
      
      // Optional: Cache-Control Header für häufig abgerufene Dokumente
      res.setHeader('Cache-Control', 'max-age=300'); // 5 Minuten cachen
      
      // Streaming-Support für große Dateien
      // Überprüfen, ob die Datei mehr als 1MB groß ist
      if (document.file_content && document.file_content.length > 1024 * 1024) {
        logger.info(`Streaming large document ${documentId} (size: ${document.file_content.length} bytes)`);
        
        // Die Datei in kleineren Teilen senden
        const CHUNK_SIZE = 256 * 1024; // 256 KB Chunks
        const fileSize = document.file_content.length;
        
        // Content-Length Header setzen, damit der Client den Fortschritt verfolgen kann
        res.setHeader('Content-Length', fileSize);
        
        // Daten in Chunks streamen
        for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
          const chunk = document.file_content.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
          // Wenn dies der letzte Chunk ist, Ende markieren
          const isLastChunk = offset + CHUNK_SIZE >= fileSize;
          
          if (!res.write(chunk) && !isLastChunk) {
            // Wenn Puffer voll ist und noch Daten kommen, auf "drain" Event warten
            await new Promise(resolve => res.once('drain', resolve));
          }
        }
        
        res.end();
      } else {
        // Für kleinere Dateien einfach den gesamten Inhalt auf einmal senden
        res.send(document.file_content);
      }
      
      logger.info(`User ${requesterId} successfully downloaded document ${documentId}`);
    } catch (error) {
      logger.error(`Error downloading document ${documentId}: ${error.message}`);
      res.status(500).json({ message: 'Fehler beim Herunterladen des Dokuments', error: error.message });
    }
});

// Dokument archivieren/wiederherstellen
router.put('/:documentId/archive', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const { documentId } = req.params;
  const { archived } = req.body;
  
  logger.info(`Admin ${adminId} attempting to ${archived ? 'archive' : 'unarchive'} document ${documentId}`);
  
  try {
    let success;
    if (archived) {
      success = await Document.archiveDocument(documentId);
    } else {
      success = await Document.unarchiveDocument(documentId);
    }
    
    if (success) {
      logger.info(`Document ${documentId} ${archived ? 'archived' : 'unarchived'} successfully by admin ${adminId}`);
      res.json({ 
        message: `Dokument erfolgreich ${archived ? 'archiviert' : 'wiederhergestellt'}`,
        archived: archived
      });
    } else {
      logger.warn(`Document ${documentId} not found for archiving/unarchiving`);
      res.status(404).json({ message: 'Dokument nicht gefunden' });
    }
  } catch (error) {
    logger.error(`Error ${archived ? 'archiving' : 'unarchiving'} document ${documentId}: ${error.message}`);
    res.status(500).json({ 
      message: `Fehler beim ${archived ? 'Archivieren' : 'Wiederherstellen'} des Dokuments`, 
      error: error.message 
    });
  }
});

// Dokument löschen
router.delete('/:documentId', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const adminId = req.user.id;
  const { documentId } = req.params;
  
  logger.info(`Admin ${adminId} attempting to delete document ${documentId}`);
  
  try {
    const success = await Document.delete(documentId);
    
    if (success) {
      logger.info(`Document ${documentId} deleted successfully by admin ${adminId}`);
      res.json({ message: 'Dokument erfolgreich gelöscht' });
    } else {
      logger.warn(`Document ${documentId} not found for deletion`);
      res.status(404).json({ message: 'Dokument nicht gefunden' });
    }
  } catch (error) {
    logger.error(`Error deleting document ${documentId}: ${error.message}`);
    res.status(500).json({ message: 'Fehler beim Löschen des Dokuments', error: error.message });
  }
});

module.exports = router;