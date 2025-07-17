/**
 * Logger Configuration
 * Winston-based logging system with file rotation and console output
 */

import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log directory
const logDir = path.join(__dirname, "../../../backend/logs");

// Log levels interface - Unused
// interface LogLevel {
//   error: string;
//   warn: string;
//   info: string;
//   http: string;
//   verbose: string;
//   debug: string;
//   silly: string;
// }

// Custom metadata interface
interface LogMetadata {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | object
    | Array<unknown>;
}

// Custom format for better readability
const customFormat = winston.format.printf(
  ({
    level,
    message,
    timestamp,
    ...metadata
  }: winston.Logform.TransformableInfo) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }
);

// Logger configuration interface
interface LoggerConfig {
  level: string;
  format: winston.Logform.Format;
  defaultMeta: LogMetadata;
  transports: winston.transport[];
}

// Create logger instance
const logger: winston.Logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat
  ),
  defaultMeta: { service: "assixx-backend" } as LogMetadata,
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
} as LoggerConfig);

// Console logging for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Export logger instance with typed methods
export { logger };

// Default export
export default { logger };
