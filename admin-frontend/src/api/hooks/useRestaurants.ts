/**
 * Restaurant Hooks
 * React Query hooks for restaurant operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantService } from '../services/restaurantService';
import type { PaginationParams } from '../types/common';
import type {
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
} from '../types/restaurant';

/**
 * Query keys for restaurant queries
 */
export const restaurantKeys = {
  all: ['restaurants'] as const,
  lists: () => [...restaurantKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => [...restaurantKeys.lists(), params] as const,
  details: () => [...restaurantKeys.all, 'detail'] as const,
  detail: (id: string) => [...restaurantKeys.details(), id] as const,
};

/**
 * Hook to fetch all restaurants
 */
export function useRestaurants(params?: PaginationParams) {
  return useQuery({
    queryKey: restaurantKeys.list(params),
    queryFn: () => restaurantService.getAll(params),
  });
}

/**
 * Hook to fetch a single restaurant
 */
export function useRestaurant(id: string) {
  return useQuery({
    queryKey: restaurantKeys.detail(id),
    queryFn: () => restaurantService.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a restaurant
 */
export function useCreateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRestaurantRequest) => restaurantService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restaurantKeys.lists() });
    },
  });
}

/**
 * Hook to update a restaurant
 */
export function useUpdateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRestaurantRequest }) =>
      restaurantService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: restaurantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: restaurantKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook to delete a restaurant
 */
export function useDeleteRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restaurantService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restaurantKeys.lists() });
    },
  });
}

