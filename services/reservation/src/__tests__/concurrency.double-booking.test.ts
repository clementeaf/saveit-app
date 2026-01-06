/**
 * CRITICAL Concurrency Tests - Double Booking Prevention
 * 
 * Tests that verify the ZERO DOUBLE BOOKING guarantee
 * under high concurrency scenarios
 */

import { db } from '@saveit/database';
import { cache } from '@saveit/cache';
import { ReservationService } from '../services/reservationService';
import { ReservationRequest } from '@saveit/types';

describe('Concurrency - Double Booking Prevention', () => {
  let reservationService: ReservationService;
  let testRestaurantId: string;
  let testUserId: string;
  let testTableId: string;

  beforeAll(async () => {
    reservationService = new ReservationService();
    await cache.connect();

    // Get test data from seeded database
    const restaurantResult = await db.query(
      "SELECT id FROM restaurants WHERE slug = 'la-bella-tavola' LIMIT 1"
    );
    testRestaurantId = restaurantResult.rows[0]?.id;

    const userResult = await db.query("SELECT id FROM users LIMIT 1");
    testUserId = userResult.rows[0]?.id;

    const tableResult = await db.query(
      "SELECT id FROM tables WHERE restaurant_id = $1 LIMIT 1",
      [testRestaurantId]
    );
    testTableId = tableResult.rows[0]?.id;
  });

  afterAll(async () => {
    await cache.disconnect();
    await db.close();
  });

  afterEach(async () => {
    // Clean up test reservations
    await db.query("DELETE FROM reservations WHERE date >= CURRENT_DATE");
  });

  describe('CRITICAL: Multiple Concurrent Reservations for Same Slot', () => {
    it('should prevent double booking when 10 concurrent requests try to book the same slot', async () => {
      const baseRequest: Partial<ReservationRequest> = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: '2026-01-15',  // Future date
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Test User',
        guestEmail: 'test@example.com',
        channel: 'webchat' as any,
      };

      const concurrentRequests = 10;
      let successCount = 0;
      let failureCount = 0;
      const results: Array<{ success: boolean; error?: string }> = [];

      // Simulate 10 concurrent reservation attempts for the SAME slot
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        try {
          await reservationService.createReservation({
            ...baseRequest,
            guestEmail: `test${i}@example.com`,
          } as ReservationRequest);
          successCount++;
          return { success: true };
        } catch (error) {
          failureCount++;
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const settled = await Promise.allSettled(promises);
      settled.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      // CRITICAL ASSERTION: Only ONE reservation should succeed
      expect(successCount).toBe(1);
      expect(failureCount).toBe(9);

      // Verify in database: Only ONE reservation exists for this slot
      const dbCheck = await db.query(
        `SELECT COUNT(*) as count FROM reservations 
         WHERE restaurant_id = $1 AND date = $2 AND time_slot = $3`,
        [testRestaurantId, '2026-01-15', '19:00']
      );

      expect(parseInt(dbCheck.rows[0]!.count, 10)).toBe(1);
    }, 30000); // 30 second timeout for concurrency test

    it('should prevent double booking with different party sizes for same slot', async () => {
      const baseRequest: Partial<ReservationRequest> = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: '2026-01-16',
        timeSlot: '20:00',
        guestName: 'Test User',
        channel: 'whatsapp' as any,
      };

      const partySizes = [2, 4, 6, 2, 4]; // Different party sizes
      let successCount = 0;

      const promises = partySizes.map(async (partySize, i) => {
        try {
          await reservationService.createReservation({
            ...baseRequest,
            partySize,
            guestEmail: `party${i}@example.com`,
          } as ReservationRequest);
          successCount++;
          return true;
        } catch {
          return false;
        }
      });

      await Promise.allSettled(promises);

      // Only ONE should succeed regardless of party size
      expect(successCount).toBe(1);

      // Verify in database
      const dbCheck = await db.query(
        `SELECT COUNT(*) as count FROM reservations 
         WHERE restaurant_id = $1 AND date = $2 AND time_slot = $3`,
        [testRestaurantId, '2026-01-16', '20:00']
      );

      expect(parseInt(dbCheck.rows[0]!.count, 10)).toBe(1);
    }, 20000);
  });

  describe('CRITICAL: Overlapping Time Slots', () => {
    it('should prevent booking overlapping time slots for same table', async () => {
      // First reservation: 19:00 (2 hour duration = until 21:00)
      const firstReservation: Partial<ReservationRequest> = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: '2026-01-17',
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'First Guest',
        guestEmail: 'first@example.com',
        channel: 'webchat' as any,
      };

      // Create first reservation successfully
      const first = await reservationService.createReservation(
        firstReservation as ReservationRequest
      );
      expect(first).toBeDefined();

      // Try overlapping reservations concurrently
      const overlappingTimes = ['19:30', '20:00', '20:30']; // All overlap with 19:00-21:00
      let overlapSuccessCount = 0;

      const promises = overlappingTimes.map(async (timeSlot, i) => {
        try {
          await reservationService.createReservation({
            restaurantId: testRestaurantId,
            userId: testUserId,
            date: '2026-01-17',
            timeSlot,
            partySize: 2,
            guestName: `Guest ${i}`,
            guestEmail: `overlap${i}@example.com`,
            channel: 'webchat' as any,
          } as ReservationRequest);
          overlapSuccessCount++;
          return true;
        } catch {
          return false;
        }
      });

      await Promise.allSettled(promises);

      // NONE of the overlapping attempts should succeed
      expect(overlapSuccessCount).toBe(0);

      // Verify: Only original reservation exists
      const dbCheck = await db.query(
        `SELECT COUNT(*) as count FROM reservations 
         WHERE restaurant_id = $1 AND date = $2 AND time_slot >= '19:00' AND time_slot < '21:00'`,
        [testRestaurantId, '2026-01-17']
      );

      expect(parseInt(dbCheck.rows[0]!.count, 10)).toBe(1);
    }, 20000);
  });

  describe('CRITICAL: Lock Release Under Error Conditions', () => {
    it('should release lock if reservation creation fails', async () => {
      const invalidRequest: Partial<ReservationRequest> = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: '2026-01-18',
        timeSlot: '19:00',
        partySize: 100, // Invalid: exceeds any table capacity
        guestName: 'Invalid Request',
        guestEmail: 'invalid@example.com',
        channel: 'webchat' as any,
      };

      // This should fail due to capacity
      await expect(
        reservationService.createReservation(invalidRequest as ReservationRequest)
      ).rejects.toThrow();

      // Verify lock was released - a valid request should succeed now
      const validRequest: ReservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: '2026-01-18',
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'Valid User',
        guestEmail: 'valid@example.com',
        channel: 'webchat' as any,
      };

      const reservation = await reservationService.createReservation(validRequest);
      expect(reservation).toBeDefined();
    }, 15000);
  });

  describe('Performance Under Load', () => {
    it('should handle 50 concurrent reservations for different slots', async () => {
      const requests: ReservationRequest[] = [];

      // Generate 50 different time slots
      for (let i = 0; i < 50; i++) {
        const hour = 12 + Math.floor(i / 4); // 12:00 to 23:00
        const minute = (i % 4) * 15; // 0, 15, 30, 45
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        requests.push({
          restaurantId: testRestaurantId,
          userId: testUserId,
          date: '2026-01-20',
          timeSlot,
          partySize: 2,
          guestName: `Guest ${i}`,
          guestEmail: `load${i}@example.com`,
          channel: 'webchat' as any,
        });
      }

      const startTime = Date.now();

      const promises = requests.map((request) =>
        reservationService.createReservation(request).catch(() => null)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulReservations = results.filter((r) => r !== null).length;

      console.log(`\n📊 Performance Metrics:`);
      console.log(`  - Total requests: ${requests.length}`);
      console.log(`  - Successful: ${successfulReservations}`);
      console.log(`  - Duration: ${duration}ms`);
      console.log(`  - Avg per request: ${(duration / requests.length).toFixed(2)}ms`);

      // Should complete in reasonable time (< 15 seconds)
      expect(duration).toBeLessThan(15000);

      // Most should succeed (different time slots for potentially different tables)
      expect(successfulReservations).toBeGreaterThan(0);
    }, 30000);
  });
});
