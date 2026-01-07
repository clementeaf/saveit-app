/**
 * Reservation Service
 * Core business logic for reservations with distributed locking
 */

import { db } from '@saveit/database';
import { cache, CacheKeys } from '@saveit/cache';
import {
  Reservation,
  ReservationRequest,
  ReservationStatus,
  AvailableSlot,
  Table,
  ValidationError,
  ReservationConflictError,
  NotFoundError,
} from '@saveit/types';
import { logger, DateUtils, IdGenerator, config } from '@saveit/utils';

import { ReservationRepository } from '../repositories/reservationRepository';
import { RestaurantRepository } from '../repositories/restaurantRepository';

export class ReservationService {
  private reservationRepo: ReservationRepository;
  private restaurantRepo: RestaurantRepository;

  constructor() {
    this.reservationRepo = new ReservationRepository();
    this.restaurantRepo = new RestaurantRepository();
  }

  /**
   * Create a new reservation with distributed locking
   */
  async createReservation(request: ReservationRequest): Promise<Reservation> {
    logger.info('Creating reservation', {
      restaurantId: request.restaurantId,
      date: request.date,
      timeSlot: request.timeSlot,
      partySize: request.partySize,
    });

    // 1. Validate restaurant and get settings
    const restaurant = await this.restaurantRepo.getById(request.restaurantId);

    // 2. Validate reservation request
    this.validateReservationRequest(request, restaurant);

    // 3. Get available tables
    const availableTables = await this.reservationRepo.getAvailableTables(
      request.restaurantId,
      request.date,
      request.timeSlot,
      request.partySize,
      restaurant.reservationDurationMinutes
    );

    if (availableTables.length === 0) {
      throw new ReservationConflictError({
        date: request.date,
        timeSlot: request.timeSlot,
        partySize: request.partySize,
      });
    }

    // 4. Select best table (smallest that fits party size)
    const selectedTable = availableTables[0]!;

    // 5. Acquire distributed lock for the table/time slot
    const lockKey = CacheKeys.reservationLock(
      selectedTable.id,
      request.date,
      request.timeSlot
    );

    const lockValue = IdGenerator.lockValue();
    const lockTtl = config.reservationLockTtlSeconds;

    logger.debug('Acquiring reservation lock', { lockKey, lockValue, lockTtl });

    // Try to acquire lock with retries
    const lockAcquired = await cache.acquireLockWithRetry(lockKey, lockValue, lockTtl, 3, 100);

    if (!lockAcquired) {
      logger.warn('Failed to acquire reservation lock', { lockKey });
      throw new ReservationConflictError({
        message: 'Table is being reserved by another request',
      });
    }

    try {
      // 6. Create reservation within SERIALIZABLE transaction with CRITICAL validations
      const reservation = await db.serializableTransaction(async (client) => {
        // If no userId provided, create or find a guest user
        let userId = request.userId;
        if (!userId) {
          // Try to find existing user by email or phone first
          if (request.guestEmail) {
            const existingByEmail = await client.query<{ id: string }>(
              'SELECT id FROM users WHERE email = $1',
              [request.guestEmail]
            );
            if (existingByEmail.rows.length > 0) {
              userId = existingByEmail.rows[0]!.id;
            }
          }
          
          if (!userId && request.guestPhone) {
            const existingByPhone = await client.query<{ id: string }>(
              'SELECT id FROM users WHERE phone = $1',
              [request.guestPhone]
            );
            if (existingByPhone.rows.length > 0) {
              userId = existingByPhone.rows[0]!.id;
            }
          }
          
          // If user doesn't exist, create a new one
          if (!userId) {
            // Generate unique email/phone if not provided to avoid constraint violations
            const email = request.guestEmail || `guest_${Date.now()}@saveit.app`;
            const phone = request.guestPhone || `+guest_${Date.now()}`;
            
            const guestUserResult = await client.query<{ id: string }>(
              `INSERT INTO users (full_name, email, phone)
               VALUES ($1, $2, $3)
               RETURNING id`,
              [request.guestName, email, phone]
            );
            
            if (guestUserResult.rows.length === 0) {
              throw new ValidationError('Failed to create user');
            }
            
            userId = guestUserResult.rows[0]!.id;
          }
        }

        // CRITICAL VALIDATION 1: Check user conflicts with FOR UPDATE
        const hasUserConflict = await this.reservationRepo.checkUserConflict(
          userId,
          request.restaurantId,
          request.date,
          request.timeSlot,
          restaurant.reservationDurationMinutes,
          client
        );

        if (hasUserConflict) {
          throw new ValidationError('User already has a reservation within ±2 hours of this time slot', {
            userId,
            date: request.date,
            timeSlot: request.timeSlot,
          });
        }

        // CRITICAL VALIDATION 2: Double-check table availability with FOR UPDATE (pessimistic lock)
        const isAvailable = await this.reservationRepo.isTableAvailable(
          selectedTable.id,
          request.date,
          request.timeSlot,
          restaurant.reservationDurationMinutes,
          client
        );

        if (!isAvailable) {
          throw new ReservationConflictError({
            date: request.date,
            timeSlot: request.timeSlot,
            table: selectedTable.tableNumber,
          });
        }

        // CRITICAL VALIDATION 3: Verify table capacity within transaction
        if (request.partySize > selectedTable.capacity) {
          throw new ValidationError('Party size exceeds table capacity', {
            partySize: request.partySize,
            tableCapacity: selectedTable.capacity,
          });
        }

        // All validations passed - create the reservation with userId
        return await this.reservationRepo.create(
          { ...request, userId },
          selectedTable.id,
          client
        );
      });

      logger.info('Reservation created successfully', {
        reservationId: reservation.id,
        tableId: selectedTable.id,
        tableNumber: selectedTable.tableNumber,
      });

      // 7. Invalidate availability cache for this restaurant
      await this.invalidateAvailabilityCache(request.restaurantId);

      return reservation;
    } finally {
      // 8. Always release the lock
      await cache.releaseLock(lockKey, lockValue);
      logger.debug('Released reservation lock', { lockKey });
    }
  }

  /**
   * Get available time slots for a date
   */
  async getAvailability(
    restaurantId: string,
    date: string,
    partySize: number
  ): Promise<AvailableSlot[]> {
    const restaurant = await this.restaurantRepo.getById(restaurantId);

    // Get day of week
    const dateObj = DateUtils.fromISODate(date);
    const dayOfWeek = DateUtils.formatInTimezone(
      dateObj,
      restaurant.timezone,
      'EEEE'
    ).toLowerCase() as keyof typeof restaurant.businessHours;

    const businessHours = restaurant.businessHours[dayOfWeek];

    if (!businessHours || businessHours.length === 0) {
      return []; // Restaurant closed on this day
    }

    // Generate time slots based on business hours
    const slots: AvailableSlot[] = [];

    for (const hours of businessHours) {
      const timeSlots = DateUtils.generateTimeSlots(
        hours.open,
        hours.close,
        30 // 30-minute intervals
      );

      for (const timeSlot of timeSlots) {
        // Check cache first
        const cacheKey = CacheKeys.availableTables(restaurantId, date, timeSlot);
        let availableTables = await cache.get<Table[]>(cacheKey);

        if (!availableTables) {
          availableTables = await this.reservationRepo.getAvailableTables(
            restaurantId,
            date,
            timeSlot,
            partySize,
            restaurant.reservationDurationMinutes
          );

          // Cache for 5 minutes
          await cache.set(cacheKey, availableTables, 300);
        }

        if (availableTables.length > 0) {
          slots.push({
            timeSlot,
            availableTables,
            capacity: Math.max(...availableTables.map((t) => t.capacity)),
          });
        }
      }
    }

    return slots;
  }

  /**
   * Confirm a reservation
   */
  async confirmReservation(reservationId: string, date: string): Promise<Reservation> {
    logger.info('Confirming reservation', { reservationId, date });

    const reservation = await this.reservationRepo.getById(reservationId, date);

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    if (reservation.status !== 'pending') {
      throw new ValidationError('Reservation is not in pending status', {
        currentStatus: reservation.status,
      });
    }

    const updated = await this.reservationRepo.updateStatus(
      reservationId,
      date,
      ReservationStatus.CONFIRMED
    );

    await this.invalidateAvailabilityCache(reservation.restaurantId);

    return updated;
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(reservationId: string, date: string): Promise<Reservation> {
    logger.info('Cancelling reservation', { reservationId, date });

    const reservation = await this.reservationRepo.getById(reservationId, date);

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    if (!['pending', 'confirmed'].includes(reservation.status)) {
      throw new ValidationError('Cannot cancel reservation with current status', {
        currentStatus: reservation.status,
      });
    }

    const updated = await this.reservationRepo.updateStatus(
      reservationId,
      date,
      ReservationStatus.CANCELLED
    );

    await this.invalidateAvailabilityCache(reservation.restaurantId);

    return updated;
  }

  /**
   * Validate reservation request
   */
  private validateReservationRequest(
    request: ReservationRequest,
    restaurant: any
  ): void {
    const now = DateUtils.now(restaurant.timezone);
    const reservationDateTime = DateUtils.combineDateTime(request.date, request.timeSlot);

    // Check if date is in the past
    if (DateUtils.isBefore(reservationDateTime, now)) {
      throw new ValidationError('Cannot make reservation in the past');
    }

    // Check max advance days
    const daysDifference = DateUtils.differenceInHours(reservationDateTime, now) / 24;
    if (daysDifference > restaurant.maxAdvanceDays) {
      throw new ValidationError(`Cannot book more than ${restaurant.maxAdvanceDays} days in advance`);
    }

    // Check minimum advance hours
    const hoursDifference = DateUtils.differenceInHours(reservationDateTime, now);
    if (hoursDifference < restaurant.minAdvanceHours) {
      throw new ValidationError(`Must book at least ${restaurant.minAdvanceHours} hours in advance`);
    }
  }

  /**
   * Get reservation by ID
   */
  async getReservationById(reservationId: string, date: string): Promise<Reservation> {
    logger.info('Getting reservation by ID', { reservationId, date });

    const reservation = await this.reservationRepo.getById(reservationId, date);

    if (!reservation) {
      throw new NotFoundError('Reservation', reservationId);
    }

    return reservation;
  }

  /**
   * Get reservations by user
   */
  async getUserReservations(
    userId: string,
    filters?: { status?: string; startDate?: string; endDate?: string }
  ): Promise<Reservation[]> {
    logger.info('Getting user reservations', { userId, filters });
    return await this.reservationRepo.getByUserId(userId, filters);
  }

  /**
   * Get reservations by restaurant
   */
  async getRestaurantReservations(
    restaurantId: string,
    filters?: { date?: string; status?: string }
  ): Promise<Reservation[]> {
    logger.info('Getting restaurant reservations', { restaurantId, filters });
    return await this.reservationRepo.getByRestaurantId(restaurantId, filters);
  }

  /**
   * Invalidate availability cache for a restaurant
   */
  private async invalidateAvailabilityCache(restaurantId: string): Promise<void> {
    const pattern = CacheKeys.restaurantAvailabilityPattern(restaurantId);
    await cache.delPattern(pattern);
    logger.debug('Invalidated availability cache', { restaurantId, pattern });
  }
}
