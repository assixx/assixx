/**
 * Express Request type extensions
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        tenantId: number;
        role: string;
      };
      tenantId?: number;
    }
  }
}

export {};
