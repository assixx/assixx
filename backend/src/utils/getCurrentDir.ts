import path from "path";

/**
 * Get the current directory path for the app
 * Returns a consistent path that works in all environments
 */
export function getCurrentDirPath(): string {
  // For both test and production, use a path relative to backend/src
  // This avoids all import.meta issues
  const baseDir = process.cwd();

  // In tests, we're already in the backend directory
  if (
    process.env.NODE_ENV === "test" ||
    (process.env.JEST_WORKER_ID != null && process.env.JEST_WORKER_ID !== "")
  ) {
    return path.join(baseDir, "src");
  }

  // In production Docker container, the app runs from /app
  if (baseDir === "/app") {
    return path.join(baseDir, "backend", "src");
  }

  // In local development, find the src directory
  if (baseDir.includes("backend")) {
    return path.join(baseDir.split("backend")[0], "backend", "src");
  }

  // Fallback - assume we're in the project root
  return path.join(baseDir, "backend", "src");
}
