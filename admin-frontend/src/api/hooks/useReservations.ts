/**
 * Reservation Hooks
 * React Query hooks for reservation operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '../services/reservationService';
import type { PaginationParams } from '../types/common';
import type {
  CreateReservationRequest,
  UpdateReservationRequest,
  AvailabilityRequest,
} from '../types/reservation';

/**
 * Query keys for reservation queries
 */
export const reservationKeys = {
  all: ['reservations'] as const,
  lists: () => [...reservationKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => [...reservationKeys.lists(), params] as const,
  details: () => [...reservationKeys.all, 'detail'] as const,
  detail: (id: string) => [...reservationKeys.details(), id] as const,
  availability: () => [...reservationKeys.all, 'availability'] as const,
};

/**
 * Hook to fetch all reservations
 */
export function useReservations(params?: PaginationParams) {
  return useQuery({
    queryKey: reservationKeys.list(params),
    queryFn: () => reservationService.getAll(params),
  });
}

/**
 * Hook to fetch a single reservation
 */
export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => reservationService.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a reservation
 */
export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReservationRequest) => reservationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
  });
}

/**
 * Hook to update a reservation
 */
export function useUpdateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReservationRequest }) =>
      reservationService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook to delete a reservation
 */
export function useDeleteReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reservationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
  });
}

/**
 * Hook to check availability
 */
export function useCheckAvailability() {
  return useMutation({
    mutationFn: (data: AvailabilityRequest) => reservationService.checkAvailability(data),
  });
}

