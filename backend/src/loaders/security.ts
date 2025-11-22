/**
 * Security Configuration Loader
 * Sets up all security-related middleware (CORS, CSP, Headers, etc.)
 */
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import { existsSync } from 'fs';
import path from 'path';

import { contentSecurityPolicy, redirectToDashboard } from '../middleware/pageAuth.js';
import {
  apiSecurityHeaders,
  corsOptions,
  sanitizeInputs,
  securityHeaders,
} from '../middleware/security-enhanced.js';
import { getCurrentDirPath } from '../utils/getCurrentDir.js';

// Constants
const CONTENT_TYPE_HEADER = 'Content-Type';
const MIME_TYPE_JAVASCRIPT = 'application/javascript';
const X_CONTENT_TYPE_OPTIONS = 'X-Content-Type-Options';

/**
 * Load security configuration
 * @param app - Express application instance
 */
export function loadSecurity(app: Application): void {
  // Get current directory
  const currentDirPath = getCurrentDirPath();

  // Apply security headers globally
  app.use(securityHeaders);

  // Apply CORS with environment-specific configuration
  app.use(cors(corsOptions));

  // Sanitize all inputs to prevent XSS
  app.use(sanitizeInputs);

  // Root redirect middleware - redirect ONLY / to appropriate dashboard (not subroutes)
  app.get('/', redirectToDashboard);

  // Content Security Policy for HTML pages
  app.use(contentSecurityPolicy);

  // Fix for JavaScript files being served with wrong MIME type
  app.use((req: Request, res: Response, next: NextFunction): void => {
    if (req.path.endsWith('.js')) {
      res.setHeader(CONTENT_TYPE_HEADER, MIME_TYPE_JAVASCRIPT);
      res.setHeader(X_CONTENT_TYPE_OPTIONS, 'nosniff');
    }
    next();
  });

  // TypeScript source map support in development
  if (process.env.NODE_ENV !== 'production') {
    app.use('/src', (_req: Request, res: Response, next: NextFunction): void => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    });

    const srcPath = path.join(currentDirPath, 'src');
    app.use('/src', express.static(srcPath, { dotfiles: 'allow' }));

    // Development-only route for TypeScript source files
    app.use('/src', (req: Request, res: Response, next: NextFunction): void => {
      // Only handle TypeScript file requests
      if (!req.path.endsWith('.ts') && !req.path.endsWith('.js')) {
        next();
        return;
      }

      const requestedPath = req.path.replace(/^\//, '');

      if (!requestedPath || requestedPath.includes('..')) {
        res.status(400).send('Invalid path');
        return;
      }

      const jsFileName = path.basename(req.path, '.js');
      const possiblePaths = [
        path.join(srcPath, requestedPath),
        path.join(srcPath, requestedPath.replace('.js', '.ts')),
        path.join(srcPath, path.dirname(requestedPath), `${jsFileName}.ts`),
      ];

      for (const filePath of possiblePaths) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Development-only TypeScript source serving, path is validated above
        if (existsSync(filePath)) {
          res.sendFile(filePath);
          return;
        }
      }
      next();
    });
  }

  // API security headers and validation
  app.use('/api', apiSecurityHeaders);

  // Override X-Frame-Options for document preview/download endpoints
  // Allow SAMEORIGIN so PDFs can be displayed in iframe modals
  app.use(
    '/api/v2/documents/:id/preview',
    (_req: Request, res: Response, next: NextFunction): void => {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      next();
    },
  );
  app.use(
    '/api/v2/documents/:id/download',
    (_req: Request, res: Response, next: NextFunction): void => {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      next();
    },
  );

  app.use('/api', (req: Request, res: Response, next: NextFunction): void => {
    // Validate Content-Type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get(CONTENT_TYPE_HEADER);
      if (
        !contentType?.includes('application/json') &&
        !contentType?.includes('multipart/form-data')
      ) {
        res.status(415).json({
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json or multipart/form-data',
        });
        return;
      }
    }
    next();
  });

  console.log('✅ Security middleware loaded');
}
