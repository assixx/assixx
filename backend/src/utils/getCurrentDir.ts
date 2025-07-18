import path from "path";
import { fileURLToPath } from "url";

/**
 * Get the current directory path
 * Handles both CommonJS and ESM environments
 */
export function getCurrentDirPath(): string {
  // In test environment, use relative path from backend root
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return path.join(process.cwd(), 'src');
  }
  
  // In CommonJS environment
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  
  // In ESM environment - this line will never be reached in tests
  // because tests run in CommonJS mode
  return path.dirname(fileURLToPath(import.meta.url));
}