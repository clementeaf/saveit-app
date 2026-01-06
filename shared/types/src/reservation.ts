/**
 * Reservation Domain Types
 */

import { ChannelType } from './channels';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance',
}

export interface Reservation {
  id: string;
  restaurantId: string;
  userId: string;
  tableId: string;
  date: string; // ISO date format YYYY-MM-DD
  timeSlot: string; // HH:mm format
  partySize: number;
  durationMinutes: number;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  specialRequests: string | null;
  status: ReservationStatus;
  channel: ChannelType;
  createdAt: Date;
  confirmedAt: Date | null;
  checkedInAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface Table {
  id: string;
  restaurantId: string;
  tableNumber: string;
  capacity: number;
  minCapacity: number;
  location: string | null;
  status: TableStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  businessHours: BusinessHours;
  maxAdvanceDays: number;
  minAdvanceHours: number;
  reservationDurationMinutes: number;
  cancellationHoursBefore: number;
  requiresDeposit: boolean;
  depositAmount: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessHours {
  monday?: TimeSlot[];
  tuesday?: TimeSlot[];
  wednesday?: TimeSlot[];
  thursday?: TimeSlot[];
  friday?: TimeSlot[];
  saturday?: TimeSlot[];
  sunday?: TimeSlot[];
}

export interface TimeSlot {
  open: string; // HH:mm format
  close: string; // HH:mm format
}

export interface ReservationRequest {
  restaurantId: string;
  userId: string;
  date: string;
  timeSlot: string;
  partySize: number;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  specialRequests?: string;
  channel: ChannelType;
  metadata?: Record<string, unknown>;
}

export interface AvailabilityQuery {
  restaurantId: string;
  date: string;
  partySize: number;
  preferredTimeSlot?: string;
}

export interface AvailableSlot {
  timeSlot: string;
  availableTables: Table[];
  capacity: number;
}

export interface ReservationLock {
  lockKey: string;
  reservationId: string;
  tableId: string;
  date: string;
  timeSlot: string;
  ttl: number;
  acquiredAt: Date;
}
