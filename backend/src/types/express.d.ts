// Express Request Extensions Type Definitions

import { TenantInfo } from "./tenant.types";

declare global {
  namespace Express {
    interface Request {
      // User Authentication
      user?: any; // Will be properly typed once User model is migrated
      userId?: number;

      // Tenant Information
      tenant?: TenantInfo | null;
      tenantId?: number | null;
      subdomain?: string;

      // File Upload
      file?: Express.Multer.File;
      files?:
        | Express.Multer.File[]
        | { [fieldname: string]: Express.Multer.File[] };

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

// Export to make this a module
export {};
