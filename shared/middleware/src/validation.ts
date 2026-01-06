/**
 * Request Validation Middleware
 * Validates request body, query, and params using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

import { ValidationError } from '@saveit/types';

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidationOptions {
  schema: z.ZodSchema;
  target?: ValidationTarget;
}

/**
 * Validate request data against a Zod schema
 */
export function validate(options: ValidationOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { schema, target = 'body' } = options;

    try {
      const data = req[target];
      const validated = schema.parse(data);
      req[target] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        next(
          new ValidationError('Request validation failed', {
            target,
            errors: details,
          })
        );
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate request body
 */
export function validateBody(schema: z.ZodSchema) {
  return validate({ schema, target: 'body' });
}

/**
 * Validate request query
 */
export function validateQuery(schema: z.ZodSchema) {
  return validate({ schema, target: 'query' });
}

/**
 * Validate request params
 */
export function validateParams(schema: z.ZodSchema) {
  return validate({ schema, target: 'params' });
}
