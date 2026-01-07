/**
 * API Client
 * Configured Axios instance with interceptors
 */

import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './config';
import { handleApiError } from './utils/errorHandler';

/**
 * Creates and configures an Axios instance
 * @returns Configured Axios instance
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: API_CONFIG.timeout,
    headers: API_CONFIG.headers,
  });

  // Request interceptor
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Add auth token if available
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      const apiError = handleApiError(error);
      
      // Handle specific error cases
      if (apiError.status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('auth_token');
        // window.location.href = '/login';
      }
      
      return Promise.reject(apiError);
    }
  );

  return client;
}

export const apiClient = createApiClient();

