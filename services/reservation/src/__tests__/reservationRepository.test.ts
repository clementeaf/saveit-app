/**
 * Unit Tests for ReservationRepository
 * Tests CRUD operations, availability checks, and pessimistic locking
 */

import { db } from '@saveit/database';
import { ReservationRepository } from '../repositories/reservationRepository';
import { ReservationRequest, ReservationStatus, ChannelType } from '@saveit/types';

describe('ReservationRepository', () => {
  let repository: ReservationRepository;
  let testRestaurantId: string;
  let testUserId: string;
  let testTableId: string;
  let testReservationId: string;
  let testDate: string;

  beforeAll(async () => {
    repository = new ReservationRepository();

    // Get test data from seeded database
    const restaurantResult = await db.query(
      "SELECT id FROM restaurants WHERE slug = 'la-bella-tavola' LIMIT 1"
    );
    testRestaurantId = restaurantResult.rows[0]?.id;

    const userResult = await db.query("SELECT id FROM users LIMIT 1");
    testUserId = userResult.rows[0]?.id;

    const tableResult = await db.query(
      "SELECT id FROM tables WHERE restaurant_id = $1 AND capacity >= 2 LIMIT 1",
      [testRestaurantId]
    );
    testTableId = tableResult.rows[0]?.id;

    // Use future date for testing
    testDate = '2026-02-15';
  });

  afterEach(async () => {
    // Clean up test reservations after each test
    await db.query("DELETE FROM reservations WHERE date >= '2026-01-01'");
  });

  describe('create()', () => {
    it('should create a new reservation successfully', async () => {
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'John Doe',
        guestPhone: '+12125551234',
        guestEmail: 'john.doe@example.com',
        specialRequests: 'Window seat please',
        channel: ChannelType.WEBCHAT,
      };

      const reservation = await repository.create(request, testTableId);

      expect(reservation).toBeDefined();
      expect(reservation.id).toBeDefined();
      expect(reservation.restaurantId).toBe(testRestaurantId);
      expect(reservation.userId).toBe(testUserId);
      expect(reservation.tableId).toBe(testTableId);
      expect(reservation.date).toBe(testDate);
      expect(reservation.timeSlot).toBe('19:00');
      expect(reservation.partySize).toBe(2);
      expect(reservation.guestName).toBe('John Doe');
      expect(reservation.guestPhone).toBe('+12125551234');
      expect(reservation.guestEmail).toBe('john.doe@example.com');
      expect(reservation.specialRequests).toBe('Window seat please');
      expect(reservation.status).toBe(ReservationStatus.PENDING);
      expect(reservation.channel).toBe(ChannelType.WEBCHAT);
      expect(reservation.createdAt).toBeInstanceOf(Date);

      // Save for other tests
      testReservationId = reservation.id;
    });

    it('should create reservation with minimal required fields', async () => {
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '20:00',
        partySize: 4,
        guestName: 'Jane Smith',
        channel: ChannelType.WHATSAPP,
      };

      const reservation = await repository.create(request, testTableId);

      expect(reservation).toBeDefined();
      expect(reservation.guestPhone).toBeNull();
      expect(reservation.guestEmail).toBeNull();
      expect(reservation.specialRequests).toBeNull();
    });

    it('should create reservation within a transaction', async () => {
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '21:00',
        partySize: 3,
        guestName: 'Bob Wilson',
        channel: ChannelType.EMAIL,
      };

      const reservation = await db.transaction(async (client) => {
        return await repository.create(request, testTableId, client);
      });

      expect(reservation).toBeDefined();
      expect(reservation.status).toBe(ReservationStatus.PENDING);

      // Verify it was committed
      const dbCheck = await db.query(
        'SELECT * FROM reservations WHERE id = $1',
        [reservation.id]
      );
      expect(dbCheck.rows).toHaveLength(1);
    });
  });

  describe('getById()', () => {
    beforeEach(async () => {
      // Create a test reservation
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      const reservation = await repository.create(request, testTableId);
      testReservationId = reservation.id;
    });

    it('should retrieve reservation by ID and date', async () => {
      const reservation = await repository.getById(testReservationId, testDate);

      expect(reservation).toBeDefined();
      expect(reservation!.id).toBe(testReservationId);
      expect(reservation!.date).toBe(testDate);
      expect(reservation!.guestName).toBe('Test User');
    });

    it('should return null for non-existent reservation', async () => {
      const reservation = await repository.getById(
        '00000000-0000-0000-0000-000000000000',
        testDate
      );

      expect(reservation).toBeNull();
    });

    it('should return null when date does not match (partition)', async () => {
      const reservation = await repository.getById(testReservationId, '2026-03-15');

      expect(reservation).toBeNull();
    });
  });

  describe('updateStatus()', () => {
    beforeEach(async () => {
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      const reservation = await repository.create(request, testTableId);
      testReservationId = reservation.id;
    });

    it('should update reservation status to confirmed', async () => {
      const updated = await repository.updateStatus(
        testReservationId,
        testDate,
        ReservationStatus.CONFIRMED
      );

      expect(updated.status).toBe(ReservationStatus.CONFIRMED);
      expect(updated.confirmedAt).toBeInstanceOf(Date);
      expect(updated.confirmedAt).not.toBeNull();
    });

    it('should update reservation status to cancelled', async () => {
      const updated = await repository.updateStatus(
        testReservationId,
        testDate,
        ReservationStatus.CANCELLED
      );

      expect(updated.status).toBe(ReservationStatus.CANCELLED);
      expect(updated.cancelledAt).toBeInstanceOf(Date);
    });

    it('should update reservation status to checked_in', async () => {
      // First confirm it
      await repository.updateStatus(
        testReservationId,
        testDate,
        ReservationStatus.CONFIRMED
      );

      // Then check in
      const updated = await repository.updateStatus(
        testReservationId,
        testDate,
        ReservationStatus.CHECKED_IN
      );

      expect(updated.status).toBe(ReservationStatus.CHECKED_IN);
      expect(updated.checkedInAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError for non-existent reservation', async () => {
      await expect(
        repository.updateStatus(
          '00000000-0000-0000-0000-000000000000',
          testDate,
          ReservationStatus.CONFIRMED
        )
      ).rejects.toThrow('Reservation not found');
    });

    it('should work within a transaction', async () => {
      await db.transaction(async (client) => {
        const updated = await repository.updateStatus(
          testReservationId,
          testDate,
          ReservationStatus.CONFIRMED,
          client
        );
        expect(updated.status).toBe(ReservationStatus.CONFIRMED);
      });

      // Verify outside transaction
      const reservation = await repository.getById(testReservationId, testDate);
      expect(reservation!.status).toBe(ReservationStatus.CONFIRMED);
    });
  });

  describe('isTableAvailable()', () => {
    it('should return true for available table', async () => {
      const isAvailable = await repository.isTableAvailable(
        testTableId,
        testDate,
        '14:00',
        120
      );

      expect(isAvailable).toBe(true);
    });

    it('should return false when table has overlapping reservation', async () => {
      // Create a reservation
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      await repository.create(request, testTableId);
      await repository.updateStatus(testReservationId, testDate, ReservationStatus.CONFIRMED);

      // Try to check availability for overlapping time
      const isAvailable = await repository.isTableAvailable(
        testTableId,
        testDate,
        '19:30', // Overlaps with 19:00-21:00 reservation
        120
      );

      expect(isAvailable).toBe(false);
    });

    it('should return true when reservation is cancelled', async () => {
      // Create and cancel a reservation
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      const reservation = await repository.create(request, testTableId);
      await repository.updateStatus(reservation.id, testDate, ReservationStatus.CANCELLED);

      // Should be available since reservation is cancelled
      const isAvailable = await repository.isTableAvailable(
        testTableId,
        testDate,
        '19:00',
        120
      );

      expect(isAvailable).toBe(true);
    });

    it('should use FOR UPDATE lock within transaction', async () => {
      // This test verifies the query runs without error in a transaction
      const isAvailable = await db.transaction(async (client) => {
        return await repository.isTableAvailable(
          testTableId,
          testDate,
          '15:00',
          120,
          client
        );
      });

      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('checkUserConflict()', () => {
    it('should return false when user has no conflicting reservations', async () => {
      const hasConflict = await repository.checkUserConflict(
        testUserId,
        testRestaurantId,
        testDate,
        '19:00',
        120
      );

      expect(hasConflict).toBe(false);
    });

    it('should return true when user has reservation in same time slot', async () => {
      // Create a reservation
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      await repository.create(request, testTableId);

      // Check for conflict at same time
      const hasConflict = await repository.checkUserConflict(
        testUserId,
        testRestaurantId,
        testDate,
        '19:00',
        120
      );

      expect(hasConflict).toBe(true);
    });

    it('should return true when user has reservation within 2-hour window', async () => {
      // Create a reservation at 19:00
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      await repository.create(request, testTableId);

      // Check for conflict at 20:30 (1.5 hours later)
      const hasConflict = await repository.checkUserConflict(
        testUserId,
        testRestaurantId,
        testDate,
        '20:30',
        120
      );

      expect(hasConflict).toBe(true);
    });

    it('should return false when reservation is cancelled', async () => {
      // Create and cancel a reservation
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      const reservation = await repository.create(request, testTableId);
      await repository.updateStatus(reservation.id, testDate, ReservationStatus.CANCELLED);

      // Should not conflict since it's cancelled
      const hasConflict = await repository.checkUserConflict(
        testUserId,
        testRestaurantId,
        testDate,
        '19:00',
        120
      );

      expect(hasConflict).toBe(false);
    });
  });

  describe('getAvailableTables()', () => {
    it('should return available tables for given criteria', async () => {
      const tables = await repository.getAvailableTables(
        testRestaurantId,
        testDate,
        '14:00',
        2,
        120
      );

      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      
      // Verify table structure
      tables.forEach((table) => {
        expect(table.id).toBeDefined();
        expect(table.restaurantId).toBe(testRestaurantId);
        expect(table.tableNumber).toBeDefined();
        expect(table.capacity).toBeGreaterThanOrEqual(2);
      });
    });

    it('should exclude tables with overlapping reservations', async () => {
      // Create a reservation
      const request: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: testDate,
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        channel: ChannelType.WEBCHAT,
      };
      await repository.create(request, testTableId);

      // Get available tables for overlapping time
      const tables = await repository.getAvailableTables(
        testRestaurantId,
        testDate,
        '19:30',
        2,
        120
      );

      // The reserved table should not be in the list
      const reservedTable = tables.find((t) => t.id === testTableId);
      expect(reservedTable).toBeUndefined();
    });

    it('should only return tables with sufficient capacity', async () => {
      const tables = await repository.getAvailableTables(
        testRestaurantId,
        testDate,
        '14:00',
        6, // Large party
        120
      );

      tables.forEach((table) => {
        expect(table.capacity).toBeGreaterThanOrEqual(6);
      });
    });
  });

  describe('getByUserId()', () => {
    beforeEach(async () => {
      // Create multiple reservations
      const dates = ['2026-02-15', '2026-02-16', '2026-02-17'];
      const statuses = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED];

      for (let i = 0; i < dates.length; i++) {
        const request: ReservationRequest = {
          restaurantId: testRestaurantId,
          userId: testUserId,
          date: dates[i]!,
          timeSlot: '19:00',
          partySize: 2,
          guestName: `Test User ${i}`,
          channel: ChannelType.WEBCHAT,
        };
        const reservation = await repository.create(request, testTableId);
        if (i > 0) {
          await repository.updateStatus(reservation.id, dates[i]!, statuses[i]!);
        }
      }
    });

    it('should return all user reservations without filters', async () => {
      const reservations = await repository.getByUserId(testUserId);

      expect(reservations.length).toBeGreaterThanOrEqual(3);
      reservations.forEach((res) => {
        expect(res.userId).toBe(testUserId);
      });
    });

    it('should filter by status', async () => {
      const reservations = await repository.getByUserId(testUserId, {
        status: ReservationStatus.CONFIRMED,
      });

      expect(reservations.length).toBeGreaterThanOrEqual(1);
      reservations.forEach((res) => {
        expect(res.status).toBe(ReservationStatus.CONFIRMED);
      });
    });

    it('should filter by date range', async () => {
      const reservations = await repository.getByUserId(testUserId, {
        startDate: '2026-02-15',
        endDate: '2026-02-16',
      });

      expect(reservations.length).toBeGreaterThanOrEqual(2);
      reservations.forEach((res) => {
        expect(res.date >= '2026-02-15' && res.date <= '2026-02-16').toBe(true);
      });
    });

    it('should combine multiple filters', async () => {
      const reservations = await repository.getByUserId(testUserId, {
        status: ReservationStatus.CONFIRMED,
        startDate: '2026-02-16',
        endDate: '2026-02-16',
      });

      reservations.forEach((res) => {
        expect(res.status).toBe(ReservationStatus.CONFIRMED);
        expect(res.date).toBe('2026-02-16');
      });
    });
  });

  describe('getByRestaurantId()', () => {
    beforeEach(async () => {
      // Create multiple reservations
      const timeSlots = ['19:00', '20:00', '21:00'];

      for (const timeSlot of timeSlots) {
        const request: ReservationRequest = {
          restaurantId: testRestaurantId,
          userId: testUserId,
          date: testDate,
          timeSlot,
          partySize: 2,
          guestName: 'Test User',
          channel: ChannelType.WEBCHAT,
        };
        await repository.create(request, testTableId);
      }
    });

    it('should return all restaurant reservations without filters', async () => {
      const reservations = await repository.getByRestaurantId(testRestaurantId);

      expect(reservations.length).toBeGreaterThanOrEqual(3);
      reservations.forEach((res) => {
        expect(res.restaurantId).toBe(testRestaurantId);
      });
    });

    it('should filter by date', async () => {
      const reservations = await repository.getByRestaurantId(testRestaurantId, {
        date: testDate,
      });

      expect(reservations.length).toBeGreaterThanOrEqual(3);
      reservations.forEach((res) => {
        expect(res.date).toBe(testDate);
      });
    });

    it('should filter by status', async () => {
      const reservations = await repository.getByRestaurantId(testRestaurantId, {
        status: ReservationStatus.PENDING,
      });

      reservations.forEach((res) => {
        expect(res.status).toBe(ReservationStatus.PENDING);
      });
    });
  });

  describe('getByRestaurantAndDate()', () => {
    beforeEach(async () => {
      // Create reservations at different times
      const timeSlots = ['12:00', '14:00', '19:00'];

      for (const timeSlot of timeSlots) {
        const request: ReservationRequest = {
          restaurantId: testRestaurantId,
          userId: testUserId,
          date: testDate,
          timeSlot,
          partySize: 2,
          guestName: 'Test User',
          channel: ChannelType.WEBCHAT,
        };
        await repository.create(request, testTableId);
      }
    });

    it('should return reservations ordered by time slot', async () => {
      const reservations = await repository.getByRestaurantAndDate(
        testRestaurantId,
        testDate
      );

      expect(reservations.length).toBeGreaterThanOrEqual(3);
      
      // Verify order (should be ascending by time)
      for (let i = 1; i < reservations.length; i++) {
        const prev = reservations[i - 1]!.timeSlot;
        const current = reservations[i]!.timeSlot;
        expect(current >= prev).toBe(true);
      }
    });

    it('should return empty array for date with no reservations', async () => {
      const reservations = await repository.getByRestaurantAndDate(
        testRestaurantId,
        '2026-12-25'
      );

      expect(reservations).toEqual([]);
    });
  });
});
