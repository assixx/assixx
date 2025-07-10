/**
 * Route Handler Type Utilities
 * Provides type-safe wrappers for Express route handlers with custom request types
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import {
  AuthenticatedRequest,
  ParamsRequest,
  BodyRequest,
  QueryRequest,
  FullRequest,
  OptionalAuthRequest,
  PublicRequest,
} from "../types/request.types";

/**
 * Type-safe wrapper for authenticated route handlers
 */
export function authHandler(
  handler: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler {
  return ((req: Request, res: Response, next: NextFunction) => {
    return handler(req as AuthenticatedRequest, res, next);
  }) as RequestHandler;
}

/**
 * Type-safe wrapper for route handlers with params
 */
export function paramsHandler<P extends ParamsDictionary = ParamsDictionary>(
  handler: (
    req: ParamsRequest<P>,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler<P> {
  return ((req: Request<P>, res: Response, next: NextFunction) => {
    return handler(req as ParamsRequest<P>, res, next);
  }) as RequestHandler<P>;
}

/**
 * Type-safe wrapper for route handlers with body
 */
export function bodyHandler<B = unknown>(
  handler: (
    req: BodyRequest<B>,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler<ParamsDictionary, unknown, B> {
  return ((
    req: Request<ParamsDictionary, unknown, B>,
    res: Response,
    next: NextFunction,
  ) => {
    return handler(req as BodyRequest<B>, res, next);
  }) as RequestHandler<ParamsDictionary, unknown, B>;
}

/**
 * Type-safe wrapper for route handlers with query
 */
export function queryHandler<Q extends ParsedQs = ParsedQs>(
  handler: (
    req: QueryRequest<Q>,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler<ParamsDictionary, unknown, unknown, Q> {
  return ((
    req: Request<ParamsDictionary, unknown, unknown, Q>,
    res: Response,
    next: NextFunction,
  ) => {
    return handler(req as QueryRequest<Q>, res, next);
  }) as RequestHandler<ParamsDictionary, unknown, unknown, Q>;
}

/**
 * Type-safe wrapper for route handlers with params and body
 */
export function paramsBodyHandler<
  P extends ParamsDictionary = ParamsDictionary,
  B = unknown,
>(
  handler: (
    req: ParamsRequest<P> & BodyRequest<B>,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler<P, unknown, B> {
  return ((req: Request<P, unknown, B>, res: Response, next: NextFunction) => {
    return handler(req as ParamsRequest<P> & BodyRequest<B>, res, next);
  }) as RequestHandler<P, unknown, B>;
}

/**
 * Type-safe wrapper for full request handlers
 */
export function fullHandler<
  B = unknown,
  Q extends ParsedQs = ParsedQs,
  P extends ParamsDictionary = ParamsDictionary,
>(
  handler: (
    req: FullRequest<B, Q, P>,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler<P, unknown, B, Q> {
  return ((
    req: Request<P, unknown, B, Q>,
    res: Response,
    next: NextFunction,
  ) => {
    return handler(req as FullRequest<B, Q, P>, res, next);
  }) as RequestHandler<P, unknown, B, Q>;
}

/**
 * Type-safe wrapper for public route handlers
 */
export function publicHandler(
  handler: (
    req: PublicRequest,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler {
  return ((req: Request, res: Response, next: NextFunction) => {
    return handler(req as PublicRequest, res, next);
  }) as RequestHandler;
}

/**
 * Type-safe wrapper for optional auth route handlers
 */
export function optionalAuthHandler(
  handler: (
    req: OptionalAuthRequest,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler {
  return ((req: Request, res: Response, next: NextFunction) => {
    return handler(req as OptionalAuthRequest, res, next);
  }) as RequestHandler;
}

/**
 * Generic async handler wrapper with error catching
 */
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req as T, res, next)).catch(next);
  };
}

/**
 * Combined type-safe async handler for authenticated requests
 */
export function authAsyncHandler(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>,
): RequestHandler {
  return asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  });
}

/**
 * Controller method wrapper for authenticated requests
 */
export function controllerAuth<T extends object>(
  controller: T,
  method: (
    this: T,
    req: AuthenticatedRequest,
    res: Response,
    next?: NextFunction,
  ) => void | Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    return method.call(controller, req as AuthenticatedRequest, res, next);
  };
}

/**
 * Controller method wrapper for params requests
 */
export function controllerParams<P extends ParamsDictionary, T extends object>(
  controller: T,
  method: (
    this: T,
    req: ParamsRequest<P>,
    res: Response,
    next?: NextFunction,
  ) => void | Promise<void>,
): RequestHandler<P> {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    return method.call(controller, req as ParamsRequest<P>, res, next);
  };
}

/**
 * Helper to create typed route handlers with automatic type inference
 */
export const typed = {
  auth: authHandler,
  params: paramsHandler,
  body: bodyHandler,
  query: queryHandler,
  paramsBody: paramsBodyHandler,
  full: fullHandler,
  public: publicHandler,
  optionalAuth: optionalAuthHandler,

  // Async versions
  authAsync: authAsyncHandler,
  asyncAuth: authAsyncHandler, // alias

  // Generic async
  async: asyncHandler,

  // Controller method wrappers
  controller: {
    auth: controllerAuth,
    params: controllerParams,
  },
};

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return "user" in req && req.user != null;
}

/**
 * Type guard to check if request has params
 */
export function hasParams<P extends ParamsDictionary>(
  req: Request,
): req is ParamsRequest<P> {
  return req.params != null;
}

/**
 * Type guard to check if request has body
 */
export function hasBody<B>(req: Request): req is BodyRequest<B> {
  return req.body != null;
}

/**
 * Middleware wrapper that ensures type compatibility
 */
export function middlewareWrapper<T extends Request = Request>(
  middleware: (
    req: T,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    return middleware(req as T, res, next);
  };
}
