/**
 * Reservation API Types
 */

export interface Reservation {
  id: string;
  restaurantId: string;
  userId: string;
  tableId: string;
  date: string;
  time: string;
  partySize: number;
  status: ReservationStatus;
  channel: ReservationChannel;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus = 
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export type ReservationChannel = 
  | 'web'
  | 'phone'
  | 'walk-in'
  | 'third-party';

export interface CreateReservationRequest {
  restaurantId: string;
  tableId: string;
  date: string;
  time: string;
  partySize: number;
  channel: ReservationChannel;
  userId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  specialRequests?: string;
}

export interface UpdateReservationRequest {
  date?: string;
  time?: string;
  partySize?: number;
  status?: ReservationStatus;
  specialRequests?: string;
}

export interface AvailabilityRequest {
  restaurantId: string;
  date: string;
  partySize: number;
}

export interface AvailabilityResponse {
  availableSlots: TimeSlot[];
  restaurant: {
    id: string;
    name: string;
    businessHours: BusinessHours;
  };
}

export interface TimeSlot {
  time: string;
  available: boolean;
  availableTables: number;
}

export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
    isClosed: boolean;
  };
}

