// Express Request Extensions Type Definitions
import { Pool } from 'mysql2/promise';

import { AuthUser } from './request.types';
import { TenantInfo } from './tenant.types';

declare global {
  namespace Express {
    interface Request {
      // User Authentication
      user?: AuthUser;
      userId?: number;

      // Tenant Information
      tenant?: TenantInfo | null;
      tenantId?: number | null;
      tenantDb?: Pool;
      subdomain?: string;

      // File Upload
      file?: Express.Multer.File;
      files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;

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

    interface Response {
      locals: {
        csrfToken?: string;
        [key: string]: unknown;
      };
    }
  }
}

// Export to make this a module
export {};
