/**
 * TEST-ONLY VERSION OF EMPLOYEE ROUTES WITHOUT AUTHENTICATION
 * 
 * WARNING: SECURITY RISK - DO NOT USE IN PRODUCTION
 * These routes are identical to employee.js but without the authentication
 * and authorization middleware. This file is only for testing purposes.
 */

const express = require('express');
const User = require('../models/user');
const Document = require('../models/document');
const logger = require('../utils/logger');
const { checkDocumentAccess } = require('../middleware/documentAccess');

const router = express.Router();

// Mock user for testing - simulates an authenticated employee
const mockUser = {
  id: process.env.TEST_USER_ID || '1', // Default to user ID 1 if not specified
  role: 'employee'
};

// TEST ROUTE: Get employee info
router.get('/info', async (req, res) => {
    const employeeId = mockUser.id;
    logger.info(`[TEST ROUTE] Employee ${employeeId} requesting their information`);
    try {
        const employee = await User.findById(employeeId);
        if (!employee) {
            logger.warn(`[TEST ROUTE] Employee with ID ${employeeId} not found`);
            return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        }
        logger.info(`[TEST ROUTE] Information retrieved for Employee ${employeeId}`);
        res.json(employee);
    } catch (error) {
        logger.error(`[TEST ROUTE] Error retrieving information for Employee ${employeeId}: ${error.message}`);
        res.status(500).json({ message: 'Fehler beim Abrufen der Mitarbeiterinformationen', error: error.message });
    }
});

// TEST ROUTE: Get all documents
router.get('/documents', async (req, res) => {
    const employeeId = mockUser.id;
    logger.info(`[TEST ROUTE] Employee ${employeeId} requesting their documents`);
    try {
        const documents = await Document.findByUserId(employeeId);
        logger.info(`[TEST ROUTE] Retrieved ${documents.length} documents for Employee ${employeeId}`);
        res.json(documents);
    } catch (error) {
        logger.error(`[TEST ROUTE] Error retrieving documents for Employee ${employeeId}: ${error.message}`);
        res.status(500).json({ message: 'Fehler beim Abrufen der Dokumente', error: error.message });
    }
});

// TEST ROUTE: Get a specific document
router.get('/documents/:documentId', async (req, res) => {
    const employeeId = mockUser.id;
    const { documentId } = req.params;
    logger.info(`[TEST ROUTE] Employee ${employeeId} attempting to download document ${documentId}`);
    try {
        const document = await Document.findById(documentId);
        
        if (!document || document.user_id !== employeeId) {
            logger.warn(`[TEST ROUTE] Document ${documentId} not found or not owned by Employee ${employeeId}`);
            return res.status(404).json({ message: 'Dokument nicht gefunden' });
        }

        logger.info(`[TEST ROUTE] Employee ${employeeId} successfully downloaded document ${documentId}`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${document.file_name}`);
        res.send(document.file_content);
    } catch (error) {
        logger.error(`[TEST ROUTE] Error downloading document ${documentId} for Employee ${employeeId}: ${error.message}`);
        res.status(500).json({ message: 'Fehler beim Herunterladen des Dokuments', error: error.message });
    }
});

// TEST ROUTE: Search documents
router.get('/search-documents', async (req, res) => {
    const employeeId = mockUser.id;
    const { query } = req.query;
    logger.info(`[TEST ROUTE] Employee ${employeeId} searching documents with query: ${query}`);
    try {
        if (!query) {
            logger.warn(`[TEST ROUTE] Employee ${employeeId} attempted search without query`);
            return res.status(400).json({ message: 'Suchbegriff erforderlich' });
        }
        const documents = await Document.search(employeeId, query);
        logger.info(`[TEST ROUTE] Found ${documents.length} documents for Employee ${employeeId} with query: ${query}`);
        res.json(documents);
    } catch (error) {
        logger.error(`[TEST ROUTE] Error searching documents for Employee ${employeeId}: ${error.message}`);
        res.status(500).json({ message: 'Fehler bei der Dokumentensuche', error: error.message });
    }
});

// TEST ROUTE: Get salary documents
router.get('/salary-documents', async (req, res) => {
    const employeeId = mockUser.id;
    const archived = req.query.archived === 'true';
    
    logger.info(`[TEST ROUTE] Employee ${employeeId} requesting their salary documents (archived: ${archived})`);
    
    try {
        const documents = await Document.findByUserIdAndCategory(employeeId, 'salary', archived);
        logger.info(`[TEST ROUTE] Retrieved ${documents.length} salary documents for Employee ${employeeId}`);
        res.json(documents);
    } catch (error) {
        logger.error(`[TEST ROUTE] Error retrieving salary documents for Employee ${employeeId}: ${error.message}`);
        res.status(500).json({ message: 'Fehler beim Abrufen der Gehaltsabrechnungen', error: error.message });
    }
});

// TEST ROUTE: Download a document with streaming support
router.get('/document-download/:documentId', async (req, res) => {
    const employeeId = mockUser.id;
    const { documentId } = req.params;
    const { inline } = req.query; 
    
    logger.info(`[TEST ROUTE] Employee ${employeeId} attempting to download document ${documentId}`);
    
    try {
        // Manual document access check
        const document = await Document.findById(documentId);
        
        if (!document) {
            logger.warn(`[TEST ROUTE] Document ${documentId} not found`);
            return res.status(404).json({ message: 'Dokument nicht gefunden' });
        }
        
        // Check ownership
        if (document.user_id !== employeeId) {
            logger.warn(`[TEST ROUTE] Access denied: User ${employeeId} is not the owner of document ${documentId}`);
            return res.status(403).json({ message: 'Zugriff verweigert' });
        }

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
        if (document.file_content && document.file_content.length > 1024 * 1024) {
            logger.info(`[TEST ROUTE] Streaming large document ${documentId} (size: ${document.file_content.length} bytes)`);
            
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
        
        logger.info(`[TEST ROUTE] Employee ${employeeId} successfully downloaded document ${documentId}`);
    } catch (error) {
        logger.error(`[TEST ROUTE] Error downloading document ${documentId} for Employee ${employeeId}: ${error.message}`);
        res.status(500).json({ message: 'Fehler beim Herunterladen des Dokuments', error: error.message });
    }
});

module.exports = router;