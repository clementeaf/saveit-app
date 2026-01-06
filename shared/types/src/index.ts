/**
 * @saveit/types
 * Shared TypeScript types for SaveIt App
 */

export * from './channels';
export * from './reservation';
export * from './user';
export * from './errors';
export * from './events';

// Common utility types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: Date;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: Date;
  dependencies: {
    [key: string]: {
      status: 'up' | 'down';
      latency?: number;
      message?: string;
    };
  };
}
