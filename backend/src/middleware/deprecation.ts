import { Request, Response, NextFunction } from "express";

/**
 * Middleware to add deprecation headers for API v1
 * @param version - The deprecated version (e.g., 'v1')
 * @param sunset - The sunset date in ISO format (e.g., '2025-12-31')
 */
export function deprecationMiddleware(_version: string, sunset: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if it's a v1 API endpoint (either /api/v1 or old /api paths without v2)
    if (
      req.path.startsWith("/api/v1") ||
      (req.path.startsWith("/api/") && !req.path.startsWith("/api/v2"))
    ) {
      res.setHeader("Deprecation", "true");
      res.setHeader("Sunset", sunset);
      res.setHeader("Link", '</api/v2>; rel="successor-version"');
    }
    next();
  };
}
