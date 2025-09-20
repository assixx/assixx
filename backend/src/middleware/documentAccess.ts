/**
 * Middleware für die Überprüfung der Dokumentenzugriffsberechtigungen
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';

import documentModel, { type DbDocument } from '../models/document.js';
import userModel from '../models/user.js';
import type { DocumentRequest } from '../types/request.types.js';
import { logger } from '../utils/logger.js';

export interface DocumentAccessOptions {
  allowAdmin?: boolean;
  allowDepartmentHeads?: boolean;
  requireOwnership?: boolean;
}

interface AccessCheckResult {
  hasAccess: boolean;
  reason?: string;
}

interface ExtendedDocument extends DbDocument {
  recipient_type?: 'user' | 'team' | 'department' | 'company';
}

// Helper function to attach document to request
const attachDocumentToRequest = (
  docReq: DocumentRequest,
  document: ExtendedDocument,
  userId: number,
  documentId: string,
  reason: string,
  next: NextFunction,
): void => {
  logger.info(`${reason} for user ${userId} to document ${documentId}`);
  docReq.document = {
    id: document.id,
    filename: document.file_name,
    category: document.category,
    tenant_id: document.tenant_id,
  };
  next();
};

// Check recipient-based access
const checkRecipientAccess = (
  document: ExtendedDocument,
  userId: number,
  tenantId: number,
): AccessCheckResult => {
  const recipientType = document.recipient_type ?? 'user';

  if (recipientType === 'user' && document.user_id === userId) {
    return { hasAccess: true, reason: 'User access granted' };
  }

  if (recipientType === 'company' && document.tenant_id === tenantId) {
    return { hasAccess: true, reason: 'Company-wide access granted' };
  }

  // Log TODO items for future implementation
  if (recipientType === 'team') {
    logger.info(`Team document access check not yet implemented for document ${document.id}`);
  }

  if (recipientType === 'department') {
    logger.info(`Department document access check not yet implemented for document ${document.id}`);
  }

  return { hasAccess: false };
};

// Check department head access
const checkDepartmentHeadAccess = async (
  options: DocumentAccessOptions,
  userRole: string,
  userId: number,
  tenantId: number,
  document: ExtendedDocument,
): Promise<AccessCheckResult> => {
  if (
    options.allowDepartmentHeads !== true ||
    userRole !== 'department_head' ||
    document.recipient_type !== 'user' ||
    !document.user_id
  ) {
    return { hasAccess: false };
  }

  const user = await userModel.findById(userId, tenantId);
  const documentOwner = await userModel.findById(document.user_id, tenantId);

  if (user && documentOwner && user.department === documentOwner.department) {
    return { hasAccess: true, reason: 'Department head access granted' };
  }

  return { hasAccess: false };
};

/**
 * Prüft, ob der Benutzer Zugriff auf ein Dokument hat
 * @param options - Konfigurationsoptionen
 */
export const checkDocumentAccess = (
  options: DocumentAccessOptions = {
    allowAdmin: true,
    allowDepartmentHeads: false,
    requireOwnership: true,
  },
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const docReq = req as DocumentRequest;
    try {
      const userId = docReq.user.id;
      const userRole = docReq.user.role;
      const tenantId = docReq.user.tenant_id;
      const { documentId } = docReq.params;

      // Validate authentication
      if (!userId || !userRole) {
        res.status(401).json({ error: 'Nicht authentifiziert' });
        return;
      }

      if (!tenantId) {
        res.status(400).json({ error: 'Tenant nicht gefunden' });
        return;
      }

      logger.info(
        `Checking document access for user ${userId} (role: ${userRole}) to document ${documentId}`,
      );

      // Check document existence
      const document = await documentModel.findById(Number.parseInt(documentId, 10));
      if (!document) {
        logger.warn(`Document ${documentId} not found`);
        res.status(404).json({ error: 'Dokument nicht gefunden' });
        return;
      }

      // Type the document correctly
      const extDocument = document as ExtendedDocument;

      // Admin bypass
      if (options.allowAdmin === true && userRole === 'admin') {
        attachDocumentToRequest(
          docReq,
          extDocument,
          userId,
          documentId,
          'Admin access granted',
          next,
        );
        return;
      }

      // Check recipient-based access
      const recipientCheck = checkRecipientAccess(extDocument, userId, tenantId);
      if (recipientCheck.hasAccess) {
        attachDocumentToRequest(
          docReq,
          extDocument,
          userId,
          documentId,
          recipientCheck.reason ?? '',
          next,
        );
        return;
      }

      // Check department head access
      const deptHeadCheck = await checkDepartmentHeadAccess(
        options,
        userRole,
        userId,
        tenantId,
        extDocument,
      );
      if (deptHeadCheck.hasAccess) {
        attachDocumentToRequest(
          docReq,
          extDocument,
          userId,
          documentId,
          deptHeadCheck.reason ?? '',
          next,
        );
        return;
      }

      // Check if ownership is not required
      if (options.requireOwnership !== true) {
        attachDocumentToRequest(
          docReq,
          extDocument,
          userId,
          documentId,
          'General access granted (ownership not required)',
          next,
        );
        return;
      }

      // Access denied
      logger.warn(`Access denied for user ${userId} (role: ${userRole}) to document ${documentId}`);
      res.status(403).json({ error: 'Keine Berechtigung für dieses Dokument' });
    } catch (error: unknown) {
      logger.error('Error in checkDocumentAccess middleware:', error);
      res.status(500).json({ error: 'Fehler bei der Überprüfung der Dokumentenberechtigung' });
    }
  };
};

/**
 * Middleware für öffentliche Dokumente (kein Login erforderlich)
 */
export const checkPublicDocumentAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { documentId } = req.params;

    const document = await documentModel.findById(Number.parseInt(documentId, 10));
    if (!document) {
      res.status(404).json({
        error: 'Dokument nicht gefunden',
      });
      return;
    }

    // Prüfe, ob das Dokument öffentlich ist
    if (document.isPublic !== true) {
      res.status(403).json({
        error: 'Dieses Dokument ist nicht öffentlich zugänglich',
      });
      return;
    }

    // Store document in request - extend Request if needed
    const docReq = req as Request & { document: typeof document };
    docReq.document = document;
    next();
    return;
  } catch (error: unknown) {
    logger.error('Error in checkPublicDocumentAccess middleware:', error);
    res.status(500).json({
      error: 'Fehler beim Abrufen des Dokuments',
    });
    return;
  }
};

export default {
  checkDocumentAccess,
  checkPublicDocumentAccess,
};
