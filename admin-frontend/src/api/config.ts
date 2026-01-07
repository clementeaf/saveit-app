/**
 * API Configuration
 * Centralized configuration for API client
 */

export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
} as const;

export const API_ENDPOINTS = {
  // Health
  health: '/health',
  
  // Reservations
  reservations: '/api/reservations',
  reservationById: (id: string) => `/api/reservations/${id}`,
  reservationAvailability: '/api/reservations/availability',
  
  // Restaurants
  restaurants: '/api/restaurants',
  restaurantById: (id: string) => `/api/restaurants/${id}`,
  
  // Users
  users: '/api/users',
  userById: (id: string) => `/api/users/${id}`,
} as const;

