declare module 'express-validator' {
  import { Request, RequestHandler } from 'express';

  export interface ValidationError {
    type: string;
    msg: string;
    path: string;
    location: string;
    value?: any;
  }

  export interface Result {
    isEmpty(): boolean;
    array(): ValidationError[];
  }

  export interface ValidationChain extends RequestHandler {
    isInt(options?: any): ValidationChain;
    isEmail(): ValidationChain;
    isLength(options: { min?: number; max?: number }): ValidationChain;
    isArray(options?: any): ValidationChain;
    isObject(): ValidationChain;
    isBoolean(): ValidationChain;
    isString(): ValidationChain;
    isIn(values: any[]): ValidationChain;
    optional(options?: any): ValidationChain;
    withMessage(message: string): ValidationChain;
    custom(
      validator: (
        value: any,
        { req }: { req: Request }
      ) => boolean | Promise<boolean>
    ): ValidationChain;
    notEmpty(): ValidationChain;
    trim(): ValidationChain;
    escape(): ValidationChain;
    normalizeEmail(): ValidationChain;
    isNumeric(options?: any): ValidationChain;
    isAlphanumeric(locale?: string, options?: any): ValidationChain;
    matches(pattern: RegExp | string, modifiers?: string): ValidationChain;
    isISO8601(options?: any): ValidationChain;
    if(
      condition:
        | ValidationChain
        | ((value: any, { req }: { req: Request }) => boolean)
    ): ValidationChain;
    exists(options?: {
      checkNull?: boolean;
      checkFalsy?: boolean;
    }): ValidationChain;
  }

  export function body(
    field?: string | string[],
    message?: string
  ): ValidationChain;
  export function param(field: string, message?: string): ValidationChain;
  export function query(field: string, message?: string): ValidationChain;
  export function header(field: string, message?: string): ValidationChain;
  export function cookie(field: string, message?: string): ValidationChain;
  export function check(
    field: string | string[],
    message?: string
  ): ValidationChain;
  export function validationResult(req: Request): Result;
  export function matchedData(req: Request): any;
  export function checkSchema(schema: any): ValidationChain[];
  export function oneOf(chains: ValidationChain[]): ValidationChain;
}
