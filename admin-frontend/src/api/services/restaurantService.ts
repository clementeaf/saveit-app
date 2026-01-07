/**
 * Restaurant Service
 * API service for restaurant-related operations
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { ApiResponse, PaginatedResponse, PaginationParams } from '../types/common';
import type {
  Restaurant,
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
} from '../types/restaurant';

/**
 * Restaurant Service Class
 * Provides methods for restaurant CRUD operations
 */
class RestaurantService {
  /**
   * Get all restaurants with pagination
   * @param params - Pagination parameters
   * @returns Paginated restaurants
   */
  async getAll(params?: PaginationParams): Promise<PaginatedResponse<Restaurant>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Restaurant>>>(
      API_ENDPOINTS.restaurants,
      { params }
    );
    return response.data.data;
  }

  /**
   * Get restaurant by ID
   * @param id - Restaurant ID
   * @returns Restaurant details
   */
  async getById(id: string): Promise<Restaurant> {
    const response = await apiClient.get<ApiResponse<Restaurant>>(
      API_ENDPOINTS.restaurantById(id)
    );
    return response.data.data;
  }

  /**
   * Create a new restaurant
   * @param data - Restaurant data
   * @returns Created restaurant
   */
  async create(data: CreateRestaurantRequest): Promise<Restaurant> {
    const response = await apiClient.post<ApiResponse<Restaurant>>(
      API_ENDPOINTS.restaurants,
      data
    );
    return response.data.data;
  }

  /**
   * Update an existing restaurant
   * @param id - Restaurant ID
   * @param data - Updated restaurant data
   * @returns Updated restaurant
   */
  async update(id: string, data: UpdateRestaurantRequest): Promise<Restaurant> {
    const response = await apiClient.put<ApiResponse<Restaurant>>(
      API_ENDPOINTS.restaurantById(id),
      data
    );
    return response.data.data;
  }

  /**
   * Delete a restaurant
   * @param id - Restaurant ID
   * @returns Success message
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.restaurantById(id));
  }
}

export const restaurantService = new RestaurantService();

