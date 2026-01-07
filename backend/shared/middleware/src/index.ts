/**
 * @saveit/middleware
 * Express middleware for SaveIt App
 */

export { errorHandler } from './errorHandler';
export { requestLogger } from './requestLogger';
export { validate, validateBody, validateQuery, validateParams } from './validation';
export { rateLimit, strictRateLimit, standardRateLimit } from './rateLimit';
export { asyncHandler } from './asyncHandler';
export { cors } from './cors';

// Default CORS middleware for development
import { cors } from './cors';
export const corsMiddleware = cors({
  origins: ['*'],
  credentials: true,
});
