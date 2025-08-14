import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env.test
config({ path: path.join(__dirname, "../../.env.test") });

// Set test environment variables with defaults
const setEnvDefault = (key: string, value: string): void => {
  const currentValue = process.env[key];
  if (currentValue === undefined || currentValue === "") {
    process.env[key] = value;
  }
};

setEnvDefault("NODE_ENV", "test");
setEnvDefault("DB_HOST", process.env.CI === "true" ? "mysql" : "localhost");
setEnvDefault("DB_PORT", process.env.CI === "true" ? "3306" : "3307");
setEnvDefault("DB_USER", "assixx_user");
setEnvDefault("DB_PASSWORD", "AssixxP@ss2025!");
setEnvDefault("DB_NAME", "main_test");
setEnvDefault("JWT_SECRET", "test-secret-key-for-github-actions");
setEnvDefault("SMTP_HOST", "smtp.gmail.com");
setEnvDefault("SMTP_PORT", "587");

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: (): void => {
    /* no-op */
  },
  debug: (): void => {
    /* no-op */
  },
  info: (): void => {
    /* no-op */
  },
  warn: (): void => {
    /* no-op */
  },
  error: (): void => {
    /* no-op */
  },
};
