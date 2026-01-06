/**
 * Test Data Factory
 * Helpers for creating test data objects
 */

import { ReservationRequest, ChannelType } from '@saveit/types';

export class TestDataFactory {
  /**
   * Create a valid reservation request with default values
   */
  static createReservationRequest(
    overrides?: Partial<ReservationRequest>
  ): ReservationRequest {
    const defaults: ReservationRequest = {
      restaurantId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      date: '2026-03-15',
      timeSlot: '19:00',
      partySize: 2,
      guestName: 'Test User',
      guestPhone: '+12125551234',
      guestEmail: 'test@example.com',
      channel: ChannelType.WEBCHAT,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create multiple reservation requests with incremental differences
   */
  static createMultipleReservationRequests(
    count: number,
    baseRequest?: Partial<ReservationRequest>
  ): ReservationRequest[] {
    return Array.from({ length: count }, (_, index) => {
      return this.createReservationRequest({
        ...baseRequest,
        guestName: `Test User ${index + 1}`,
        guestEmail: `test${index + 1}@example.com`,
      });
    });
  }

  /**
   * Create a reservation request for a specific time slot
   */
  static createReservationForTimeSlot(
    timeSlot: string,
    overrides?: Partial<ReservationRequest>
  ): ReservationRequest {
    return this.createReservationRequest({
      timeSlot,
      ...overrides,
    });
  }

  /**
   * Create a reservation request for a specific date
   */
  static createReservationForDate(
    date: string,
    overrides?: Partial<ReservationRequest>
  ): ReservationRequest {
    return this.createReservationRequest({
      date,
      ...overrides,
    });
  }

  /**
   * Create a reservation request with minimal required fields
   */
  static createMinimalReservationRequest(
    restaurantId: string,
    userId: string,
    date: string,
    timeSlot: string
  ): ReservationRequest {
    return {
      restaurantId,
      userId,
      date,
      timeSlot,
      partySize: 2,
      guestName: 'Minimal Test User',
      channel: ChannelType.WEBCHAT,
    };
  }

  /**
   * Create a reservation request with all optional fields
   */
  static createFullReservationRequest(
    overrides?: Partial<ReservationRequest>
  ): ReservationRequest {
    return this.createReservationRequest({
      guestPhone: '+12125551234',
      guestEmail: 'full@example.com',
      specialRequests: 'Window seat, vegetarian menu',
      metadata: {
        source: 'test',
        campaignId: 'test-campaign-001',
      },
      ...overrides,
    });
  }

  /**
   * Create requests for concurrent booking testing
   */
  static createConcurrentRequests(
    count: number,
    sameSlot: boolean = true
  ): ReservationRequest[] {
    const baseTimeSlot = '19:00';
    const baseDate = '2026-03-20';

    return Array.from({ length: count }, (_, index) => {
      const timeSlot = sameSlot ? baseTimeSlot : `${19 + index}:00`;
      
      return this.createReservationRequest({
        date: baseDate,
        timeSlot,
        guestName: `Concurrent User ${index + 1}`,
        guestEmail: `concurrent${index + 1}@example.com`,
      });
    });
  }

  /**
   * Generate time slots array
   */
  static generateTimeSlots(
    startHour: number = 11,
    endHour: number = 22,
    intervalMinutes: number = 30
  ): string[] {
    const slots: string[] = [];
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        if (hour === endHour && minute > 0) break;
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    
    return slots;
  }

  /**
   * Generate dates array (future dates only)
   */
  static generateFutureDates(count: number, startDaysFromNow: number = 7): string[] {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = 0; i < count; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + startDaysFromNow + i);
      dates.push(futureDate.toISOString().split('T')[0]!);
    }
    
    return dates;
  }

  /**
   * Create a date N days from now
   */
  static getFutureDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Create a past date (for negative testing)
   */
  static getPastDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Generate party sizes
   */
  static generatePartySizes(min: number = 1, max: number = 10): number[] {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }
}
