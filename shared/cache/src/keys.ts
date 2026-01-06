/**
 * Cache Key Builder
 * Standardized cache key generation
 */

export class CacheKeys {
  private static readonly PREFIX = 'saveit';

  /**
   * Reservation lock key
   */
  static reservationLock(tableId: string, date: string, timeSlot: string): string {
    return `${this.PREFIX}:lock:reservation:${tableId}:${date}:${timeSlot}`;
  }

  /**
   * Available tables cache key
   */
  static availableTables(restaurantId: string, date: string, timeSlot: string): string {
    return `${this.PREFIX}:available-tables:${restaurantId}:${date}:${timeSlot}`;
  }

  /**
   * Restaurant data cache key
   */
  static restaurant(restaurantId: string): string {
    return `${this.PREFIX}:restaurant:${restaurantId}`;
  }

  /**
   * User data cache key
   */
  static user(userId: string): string {
    return `${this.PREFIX}:user:${userId}`;
  }

  /**
   * Conversation state cache key
   */
  static conversationState(conversationId: string): string {
    return `${this.PREFIX}:conversation:${conversationId}`;
  }

  /**
   * User channel identifier cache key
   */
  static userChannel(channel: string, channelUserId: string): string {
    return `${this.PREFIX}:user-channel:${channel}:${channelUserId}`;
  }

  /**
   * Reservation by ID cache key
   */
  static reservation(reservationId: string): string {
    return `${this.PREFIX}:reservation:${reservationId}`;
  }

  /**
   * Table data cache key
   */
  static table(tableId: string): string {
    return `${this.PREFIX}:table:${tableId}`;
  }

  /**
   * Restaurant availability pattern (for invalidation)
   */
  static restaurantAvailabilityPattern(restaurantId: string): string {
    return `${this.PREFIX}:available-tables:${restaurantId}:*`;
  }

  /**
   * All reservation locks pattern (for cleanup)
   */
  static allReservationLocksPattern(): string {
    return `${this.PREFIX}:lock:reservation:*`;
  }

  /**
   * Rate limit key
   */
  static rateLimit(identifier: string, action: string): string {
    return `${this.PREFIX}:rate-limit:${action}:${identifier}`;
  }

  /**
   * Session key
   */
  static session(sessionId: string): string {
    return `${this.PREFIX}:session:${sessionId}`;
  }

  /**
   * Generic cache key builder
   */
  static custom(...parts: string[]): string {
    return `${this.PREFIX}:${parts.join(':')}`;
  }
}
