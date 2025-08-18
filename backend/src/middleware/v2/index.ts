/**
 * API v2 Middleware Exports
 * Central export point for all v2 middleware
 */

export {
  authenticateV2,
  optionalAuthV2,
  requireRoleV2,
  verifyRefreshToken,
} from "./auth.middleware";

// Re-export from parent directory for v2 usage
export { deprecationMiddleware } from "../deprecation";

// Default export with all middleware
import { deprecationMiddleware as deprecation } from "../deprecation";

import authMiddleware from "./auth.middleware";

export default {
  auth: authMiddleware,
  deprecation: deprecation,
};
