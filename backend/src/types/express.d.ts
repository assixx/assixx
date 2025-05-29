// Express Request Extensions Type Definitions

import { User, Tenant } from './models';

declare global {
  namespace Express {
    interface Request {
      // User Authentication
      user?: any; // Will be properly typed once User model is migrated
      userId?: number;
      
      // Tenant Information
      tenant?: Tenant;
      tenantId?: number;
      subdomain?: string;
      
      // File Upload
      file?: Express.Multer.File;
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
      
      // Feature Flags
      features?: string[];
      hasFeature?: (featureKey: string) => boolean;
      
      // Pagination
      pagination?: {
        page: number;
        limit: number;
        offset: number;
      };
      
      // Request Metadata
      requestId?: string;
      clientIp?: string;
      userAgent?: string;
    }
  }
}

// Multer Types
declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
}

// Export to make this a module
export {};