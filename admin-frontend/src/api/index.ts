/**
 * API Module Export
 * Centralized export for all API functionality
 */

export * from './config';
export * from './client';
export * from './services';
export * from './hooks';
export * from './types/common';
export * from './types/reservation';
export * from './types/chat';
export type {
  Restaurant,
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
} from './types/restaurant';
export type { BusinessHours as RestaurantBusinessHours } from './types/restaurant';
export * from './utils/errorHandler';

