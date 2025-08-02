/**
 * ServiceError class for structured error handling in service layer
 */

export class ServiceError extends Error {
  public code: string;
  public statusCode: number;
  public details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;

    // Map error codes to HTTP status codes
    switch (code) {
      case "NOT_FOUND":
        this.statusCode = 404;
        break;
      case "BAD_REQUEST":
      case "VALIDATION_ERROR":
        this.statusCode = 400;
        break;
      case "UNAUTHORIZED":
        this.statusCode = 401;
        break;
      case "FORBIDDEN":
        this.statusCode = 403;
        break;
      case "CONFLICT":
        this.statusCode = 409;
        break;
      case "SERVER_ERROR":
      default:
        this.statusCode = 500;
        break;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }
}
