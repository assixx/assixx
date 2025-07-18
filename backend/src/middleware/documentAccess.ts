/**
 * Middleware für die Überprüfung der Dokumentenzugriffsberechtigungen
 */
import { Request, Response, NextFunction, RequestHandler } from "express";

import Document from "../models/document.js";
import User from "../models/user.js";
import { DocumentRequest } from "../types/request.types.js";
import { logger } from "../utils/logger.js";

export interface DocumentAccessOptions {
  allowAdmin?: boolean;
  allowDepartmentHeads?: boolean;
  requireOwnership?: boolean;
}

/**
 * Prüft, ob der Benutzer Zugriff auf ein Dokument hat
 * @param options - Konfigurationsoptionen
 * @param options.allowAdmin - Ob Admins Zugriff haben sollen
 * @param options.allowDepartmentHeads - Ob Abteilungsleiter Zugriff auf Dokumente ihrer Abteilungsmitglieder haben dürfen
 * @param options.requireOwnership - Ob der Benutzer der Besitzer des Dokuments sein muss
 */
export const checkDocumentAccess = (
  options: DocumentAccessOptions = {
    allowAdmin: true,
    allowDepartmentHeads: false,
    requireOwnership: true,
  }
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Type assertion - we know auth middleware has run
    const docReq = req as DocumentRequest;
    try {
      const userId = docReq.user?.id;
      const userRole = docReq.user?.role;
      const tenantId = docReq.user?.tenant_id ?? docReq.tenantId;
      const { documentId } = docReq.params;

      if (!userId || !userRole) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
      }

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant nicht gefunden" });
      }

      logger.info(
        `Checking document access for user ${userId} (role: ${userRole}) to document ${documentId}`
      );

      // Prüfe, ob das Dokument existiert
      const document = await Document.findById(parseInt(documentId, 10));
      if (!document) {
        logger.warn(`Document ${documentId} not found`);
        return res.status(404).json({
          error: "Dokument nicht gefunden",
        });
      }

      // Admin-Zugriff prüfen
      if (options.allowAdmin && userRole === "admin") {
        logger.info(
          `Admin access granted for user ${userId} to document ${documentId}`
        );
        docReq.document = {
          ...document,
          filename: document.file_name,
        };
        return next();
      }

      // Zugriff basierend auf Empfängertyp prüfen
      switch (document.recipient_type ?? "user") {
        case "user":
          // Einzelner Benutzer - nur der Empfänger hat Zugriff
          if (document.user_id === userId) {
            logger.info(
              `User access granted for user ${userId} to document ${documentId}`
            );
            docReq.document = {
              ...document,
              filename: document.file_name,
            };
            return next();
          }
          break;

        case "team":
          // TODO: Prüfen ob Benutzer im Team ist
          logger.info(
            `Team document access check not yet implemented for document ${documentId}`
          );
          break;

        case "department":
          // TODO: Prüfen ob Benutzer in der Abteilung ist
          logger.info(
            `Department document access check not yet implemented for document ${documentId}`
          );
          break;

        case "company":
          // Alle Benutzer des Tenants haben Zugriff
          if (document.tenant_id === tenantId) {
            logger.info(
              `Company-wide access granted for user ${userId} to document ${documentId}`
            );
            docReq.document = {
              ...document,
              filename: document.file_name,
            };
            return next();
          }
          break;
      }

      // Abteilungsleiter-Zugriff prüfen (nur für user-spezifische Dokumente)
      if (
        options.allowDepartmentHeads &&
        userRole === "department_head" &&
        document.recipient_type === "user" &&
        document.user_id
      ) {
        const user = await User.findById(userId, tenantId);
        const documentOwner = await User.findById(document.user_id, tenantId);

        if (
          user &&
          documentOwner &&
          user.department === documentOwner.department
        ) {
          logger.info(
            `Department head access granted for user ${userId} to document ${documentId}`
          );
          docReq.document = {
            ...document,
            filename: document.file_name,
          };
          return next();
        }
      }

      // Wenn requireOwnership false ist und keine anderen Bedingungen zutreffen
      if (!options.requireOwnership) {
        logger.info(
          `General access granted for user ${userId} to document ${documentId} (ownership not required)`
        );
        docReq.document = {
          ...document,
          filename: document.file_name,
        };
        return next();
      }

      // Zugriff verweigert
      logger.warn(
        `Access denied for user ${userId} (role: ${userRole}) to document ${documentId}`
      );
      return res.status(403).json({
        error: "Keine Berechtigung für dieses Dokument",
      });
    } catch (error) {
      logger.error("Error in checkDocumentAccess middleware:", error);
      return res.status(500).json({
        error: "Fehler bei der Überprüfung der Dokumentenberechtigung",
      });
    }
  };
};

/**
 * Middleware für öffentliche Dokumente (kein Login erforderlich)
 */
export const checkPublicDocumentAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findById(parseInt(documentId, 10));
    if (!document) {
      return res.status(404).json({
        error: "Dokument nicht gefunden",
      });
    }

    // Prüfe, ob das Dokument öffentlich ist
    if (!document.isPublic) {
      return res.status(403).json({
        error: "Dieses Dokument ist nicht öffentlich zugänglich",
      });
    }

    // Store document in request - extend Request if needed
    const docReq = req as Request & { document: typeof document };
    docReq.document = document;
    return next();
  } catch (error) {
    logger.error("Error in checkPublicDocumentAccess middleware:", error);
    return res.status(500).json({
      error: "Fehler beim Abrufen des Dokuments",
    });
  }
};

export default {
  checkDocumentAccess,
  checkPublicDocumentAccess,
};
