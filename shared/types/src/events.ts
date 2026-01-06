/**
 * Event Types for EventBridge/Event-Driven Architecture
 */

import { ChannelType } from './channels';
import { ReservationStatus } from './reservation';

export enum EventType {
  // Reservation events
  RESERVATION_CREATED = 'reservation.created',
  RESERVATION_CONFIRMED = 'reservation.confirmed',
  RESERVATION_CANCELLED = 'reservation.cancelled',
  RESERVATION_CHECKED_IN = 'reservation.checked_in',
  RESERVATION_COMPLETED = 'reservation.completed',
  RESERVATION_NO_SHOW = 'reservation.no_show',

  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',

  // Notification events
  NOTIFICATION_SEND = 'notification.send',
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',

  // QR code events
  QR_CODE_GENERATED = 'qr_code.generated',
  QR_CODE_SCANNED = 'qr_code.scanned',

  // Analytics events
  ANALYTICS_TRACK = 'analytics.track',
}

export interface BaseEvent<T = unknown> {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  version: string;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface ReservationCreatedEvent {
  reservationId: string;
  restaurantId: string;
  userId: string;
  tableId: string;
  date: string;
  timeSlot: string;
  partySize: number;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  channel: ChannelType;
}

export interface ReservationStatusChangedEvent {
  reservationId: string;
  restaurantId: string;
  userId: string;
  previousStatus: ReservationStatus;
  newStatus: ReservationStatus;
  changedAt: Date;
  changedBy?: string;
  reason?: string;
}

export interface NotificationEvent {
  recipientId: string;
  channel: ChannelType;
  type: 'reservation_confirmation' | 'reservation_reminder' | 'reservation_cancellation' | 'qr_code';
  templateId: string;
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high';
}

export interface QRCodeGeneratedEvent {
  reservationId: string;
  code: string;
  s3Url: string;
  expiresAt: Date;
}

export interface AnalyticsEvent {
  userId?: string;
  restaurantId?: string;
  eventName: string;
  properties: Record<string, unknown>;
  channel?: ChannelType;
}

export type DomainEvent =
  | BaseEvent<ReservationCreatedEvent>
  | BaseEvent<ReservationStatusChangedEvent>
  | BaseEvent<NotificationEvent>
  | BaseEvent<QRCodeGeneratedEvent>
  | BaseEvent<AnalyticsEvent>;
