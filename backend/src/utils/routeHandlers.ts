/**
 * Route Handler Type Utilities
 * Provides type-safe wrappers for Express route handlers with custom request types
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

import {
  AuthenticatedRequest,
  BodyRequest,
  FullRequest,
  OptionalAuthRequest,
  ParamsRequest,
  PublicRequest,
  QueryRequest,
} from '../types/request.types';

/**
 * Type-safe wrapper for authenticated route handlers
 */
export function authHandler(
  handler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler {
  return (async (req: Request, res: Response, next: NextFunction) => {
    await handler(req as AuthenticatedRequest, res, next);
  }) as RequestHandler;
}

/**
 * Type-safe wrapper for route handlers with params
 */
export function paramsHandler<P extends ParamsDictionary = ParamsDictionary>(
  handler: (req: ParamsRequest<P>, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler<P> {
  return (async (req: Request<P>, res: Response, next: NextFunction) => {
    await handler(req as ParamsRequest<P>, res, next);
  }) as RequestHandler<P>;
}

/**
 * Type-safe wrapper for route handlers with body
 */
export function bodyHandler<B = unknown>(
  handler: (req: BodyRequest<B>, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler<ParamsDictionary, unknown, B> {
  return (async (req: Request<ParamsDictionary, unknown, B>, res: Response, next: NextFunction) => {
    await handler(req as BodyRequest<B>, res, next);
  }) as RequestHandler<ParamsDictionary, unknown, B>;
}

/**
 * Type-safe wrapper for route handlers with query
 */
export function queryHandler<Q extends ParsedQs = ParsedQs>(
  handler: (req: QueryRequest<Q>, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler<ParamsDictionary, unknown, unknown, Q> {
  return (async (
    req: Request<ParamsDictionary, unknown, unknown, Q>,
    res: Response,
    next: NextFunction,
  ) => {
    await handler(req as QueryRequest<Q>, res, next);
  }) as RequestHandler<ParamsDictionary, unknown, unknown, Q>;
}

/**
 * Type-safe wrapper for route handlers with params and body
 */
export function paramsBodyHandler<P extends ParamsDictionary = ParamsDictionary, B = unknown>(
  handler: (
    req: ParamsRequest<P> & BodyRequest<B>,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
): RequestHandler<P, unknown, B> {
  return (async (req: Request<P, unknown, B>, res: Response, next: NextFunction) => {
    await handler(req as ParamsRequest<P> & BodyRequest<B>, res, next);
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
  handler: (req: FullRequest<B, Q, P>, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler<P, unknown, B, Q> {
  return (async (req: Request<P, unknown, B, Q>, res: Response, next: NextFunction) => {
    await handler(req as FullRequest<B, Q, P>, res, next);
  }) as RequestHandler<P, unknown, B, Q>;
}

/**
 * Type-safe wrapper for public route handlers
 */
export function publicHandler(
  handler: (req: PublicRequest, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler {
  return (async (req: Request, res: Response, next: NextFunction) => {
    await handler(req as PublicRequest, res, next);
  }) as RequestHandler;
}

/**
 * Type-safe wrapper for optional auth route handlers
 */
export function optionalAuthHandler(
  handler: (req: OptionalAuthRequest, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler {
  return (async (req: Request, res: Response, next: NextFunction) => {
    await handler(req as OptionalAuthRequest, res, next);
  }) as RequestHandler;
}

/**
 * Generic async handler wrapper with error catching
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    })();
  };
}

/**
 * Combined type-safe async handler for authenticated requests
 */
export function authAsyncHandler(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        await handler(req as AuthenticatedRequest, res);
      } catch (error: unknown) {
        next(error);
      }
    })();
  };
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
  return async (req: Request, res: Response, next: NextFunction) => {
    await method.call(controller, req as AuthenticatedRequest, res, next);
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
  return async (req: Request<P>, res: Response, next: NextFunction) => {
    await method.call(controller, req as ParamsRequest<P>, res, next);
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
  return 'user' in req && req.user != null;
}

/**
 * Type guard to check if request has params
 */
export function hasParams<P extends ParamsDictionary>(req: Request): req is ParamsRequest<P> {
  return Object.keys(req.params).length > 0;
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
export function middlewareWrapper(
  middleware: (req: Request, res: Response, next: NextFunction) => void | Promise<void>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    await middleware(req, res, next);
  };
}
