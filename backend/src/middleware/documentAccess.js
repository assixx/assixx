/**
 * Middleware für die Überprüfung der Dokumentenzugriffsberechtigungen
 */
const Document = require('../models/document');
const User = require('../models/user');
const { logger } = require('../utils/logger');

/**
 * Prüft, ob der Benutzer Zugriff auf ein Dokument hat
 * @param {Object} options - Konfigurationsoptionen
 * @param {Boolean} options.allowAdmin - Ob Admins Zugriff haben sollen
 * @param {Boolean} options.allowDepartmentHeads - Ob Abteilungsleiter Zugriff auf Dokumente ihrer Abteilungsmitglieder haben dürfen
 * @param {Boolean} options.requireOwnership - Ob der Benutzer der Besitzer des Dokuments sein muss
 */
const checkDocumentAccess =
  (
    options = {
      allowAdmin: true,
      allowDepartmentHeads: false,
      requireOwnership: true,
    }
  ) =>
  async (req, res, next) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { documentId } = req.params;

    logger.info(
      `Checking document access for user ${userId} (role: ${userRole}) to document ${documentId}`
    );

    try {
      // Dokument abrufen
      const document = await Document.findById(documentId);

      // Wenn das Dokument nicht existiert, 404 zurückgeben
      if (!document) {
        logger.warn(`Document ${documentId} not found`);
        return res.status(404).json({ message: 'Dokument nicht gefunden' });
      }

      // Dokument an die Request anhängen für spätere Verwendung
      req.document = document;

      // Zugriff basierend auf Rolle und Konfiguration prüfen
      if (options.allowAdmin && userRole === 'admin') {
        logger.info(`Admin ${userId} granted access to document ${documentId}`);
        return next();
      }

      // Prüfen, ob der Benutzer der Besitzer des Dokuments ist
      const isOwner = document.user_id === userId;
      if (isOwner) {
        logger.info(
          `Document owner ${userId} accessing document ${documentId}`
        );
        return next();
      }

      // Wenn Besitzereigenschaft erforderlich ist und der Benutzer nicht der Besitzer ist, Zugriff verweigern
      if (options.requireOwnership) {
        logger.warn(
          `Access denied: User ${userId} is not the owner of document ${documentId}`
        );
        return res.status(403).json({ message: 'Zugriff verweigert' });
      }

      // Abteilungsleiter-Zugriff prüfen
      if (options.allowDepartmentHeads && userRole === 'department_head') {
        // Benutzerdetails abrufen
        const user = await User.findById(userId);

        if (user && user.department_id) {
          // Dokumentbesitzer abrufen
          const documentOwner = await User.findById(document.user_id);

          // Prüfen, ob der Dokumentbesitzer in der gleichen Abteilung ist
          if (
            documentOwner &&
            documentOwner.department_id === user.department_id
          ) {
            logger.info(
              `Department head ${userId} granted access to document ${documentId} of user ${document.user_id} in same department`
            );
            return next();
          }
        }
      }

      // Wenn keine der obigen Bedingungen erfüllt ist, Zugriff verweigern
      logger.warn(
        `Access denied: User ${userId} does not have permission to access document ${documentId}`
      );
      return res.status(403).json({ message: 'Zugriff verweigert' });
    } catch (error) {
      logger.error(`Error checking document access: ${error.message}`);
      return res.status(500).json({
        message: 'Fehler bei der Berechtigungsprüfung',
        error: error.message,
      });
    }
  };

module.exports = { checkDocumentAccess };
