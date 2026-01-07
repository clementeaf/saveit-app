/**
 * Restaurant API Types
 */

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  cuisine: string;
  capacity: number;
  businessHours: BusinessHours;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
    isClosed: boolean;
  };
}

export interface CreateRestaurantRequest {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  cuisine: string;
  capacity: number;
  businessHours: BusinessHours;
}

export interface UpdateRestaurantRequest {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  cuisine?: string;
  capacity?: number;
  businessHours?: BusinessHours;
  isActive?: boolean;
}

