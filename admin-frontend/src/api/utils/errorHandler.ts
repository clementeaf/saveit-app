/**
 * API Error Handler
 * Centralized error handling for API responses
 */

import { AxiosError } from 'axios';
import type { ApiError } from '../types/common';

/**
 * Transforms Axios errors into standardized API errors
 * @param error - Axios error object
 * @returns Standardized API error
 */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const response = error.response;
    
    if (response) {
      return {
        message: response.data?.message || error.message || 'An error occurred',
        status: response.status,
        errors: response.data?.errors,
      };
    }
    
    if (error.request) {
      return {
        message: 'Network error: Unable to reach the server',
        status: 0,
      };
    }
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      status: 0,
    };
  }
  
  return {
    message: 'An unknown error occurred',
    status: 0,
  };
}

/**
 * Checks if an error is a network error
 * @param error - API error
 * @returns True if network error
 */
export function isNetworkError(error: ApiError): boolean {
  return error.status === 0;
}

/**
 * Checks if an error is a client error (4xx)
 * @param error - API error
 * @returns True if client error
 */
export function isClientError(error: ApiError): boolean {
  return error.status >= 400 && error.status < 500;
}

/**
 * Checks if an error is a server error (5xx)
 * @param error - API error
 * @returns True if server error
 */
export function isServerError(error: ApiError): boolean {
  return error.status >= 500;
}

