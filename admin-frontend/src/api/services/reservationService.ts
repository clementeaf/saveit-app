/**
 * Reservation Service
 * API service for reservation-related operations
 */

import { apiClient } from '../client';
import { API_ENDPOINTS } from '../config';
import type { ApiResponse, PaginatedResponse, PaginationParams } from '../types/common';
import type {
  Reservation,
  CreateReservationRequest,
  UpdateReservationRequest,
  AvailabilityRequest,
  AvailabilityResponse,
} from '../types/reservation';

/**
 * Reservation Service Class
 * Provides methods for reservation CRUD operations
 */
class ReservationService {
  /**
   * Get all reservations with pagination
   * @param params - Pagination parameters
   * @returns Paginated reservations
   */
  async getAll(params?: PaginationParams): Promise<PaginatedResponse<Reservation>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Reservation>>>(
      API_ENDPOINTS.reservations,
      { params }
    );
    return response.data.data;
  }

  /**
   * Get reservation by ID
   * @param id - Reservation ID
   * @returns Reservation details
   */
  async getById(id: string): Promise<Reservation> {
    const response = await apiClient.get<ApiResponse<Reservation>>(
      API_ENDPOINTS.reservationById(id)
    );
    return response.data.data;
  }

  /**
   * Create a new reservation
   * @param data - Reservation data
   * @returns Created reservation
   */
  async create(data: CreateReservationRequest): Promise<Reservation> {
    const response = await apiClient.post<ApiResponse<Reservation>>(
      API_ENDPOINTS.reservations,
      data
    );
    return response.data.data;
  }

  /**
   * Update an existing reservation
   * @param id - Reservation ID
   * @param data - Updated reservation data
   * @returns Updated reservation
   */
  async update(id: string, data: UpdateReservationRequest): Promise<Reservation> {
    const response = await apiClient.put<ApiResponse<Reservation>>(
      API_ENDPOINTS.reservationById(id),
      data
    );
    return response.data.data;
  }

  /**
   * Delete a reservation
   * @param id - Reservation ID
   * @returns Success message
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.reservationById(id));
  }

  /**
   * Check availability for a restaurant
   * @param data - Availability request data
   * @returns Available time slots
   */
  async checkAvailability(data: AvailabilityRequest): Promise<AvailabilityResponse> {
    const response = await apiClient.post<ApiResponse<AvailabilityResponse>>(
      API_ENDPOINTS.reservationAvailability,
      data
    );
    return response.data.data;
  }
}

export const reservationService = new ReservationService();

