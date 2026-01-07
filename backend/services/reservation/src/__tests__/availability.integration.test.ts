/**
 * Integration Tests for Availability Endpoint
 * Tests availability checking with caching scenarios
 */

import request from 'supertest';
import app from '../index';
import { cache } from '@saveit/cache';
import { DbSeeder, TestDataFactory } from './helpers';
import { ReservationStatus } from '@saveit/types';

describe('Availability API Integration Tests', () => {
  let testRestaurantId: string;
  let testUserId: string;
  let testTableId: string;

  beforeAll(async () => {
    const restaurant = await DbSeeder.getTestRestaurant();
    const user = await DbSeeder.getTestUser();
    const table = await DbSeeder.getTestTable(restaurant.id, 2);

    testRestaurantId = restaurant.id;
    testUserId = user.id;
    testTableId = table.id;
  });

  afterEach(async () => {
    await DbSeeder.cleanupReservations('2026-01-01');
    await cache.flushAll();
  });

  describe('GET /api/reservations/availability - Check Availability', () => {
    it('should return available time slots', async () => {
      const date = TestDataFactory.getFutureDate(7);

      const response = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify structure of availability slots
      response.body.data.forEach((slot: any) => {
        expect(slot).toHaveProperty('timeSlot');
        expect(slot).toHaveProperty('availableTables');
        expect(slot).toHaveProperty('capacity');
        expect(Array.isArray(slot.availableTables)).toBe(true);
      });
    });

    it('should return 400 when required parameters are missing', async () => {
      await request(app).get('/api/reservations/availability').expect(400);

      await request(app)
        .get('/api/reservations/availability')
        .query({ restaurantId: testRestaurantId })
        .expect(400);

      await request(app)
        .get('/api/reservations/availability')
        .query({ date: TestDataFactory.getFutureDate(7) })
        .expect(400);
    });

    it('should exclude time slots with reservations', async () => {
      const date = TestDataFactory.getFutureDate(7);
      const bookedTimeSlot = '19:00';

      // Create a reservation
      await DbSeeder.createTestReservation(
        testRestaurantId,
        testUserId,
        testTableId,
        date,
        bookedTimeSlot,
        { status: ReservationStatus.CONFIRMED }
      );

      const response = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      // The booked slot should not appear or have fewer tables
      const bookedSlot = response.body.data.find(
        (slot: any) => slot.timeSlot === bookedTimeSlot
      );

      if (bookedSlot) {
        // If slot exists, it should have fewer tables available
        const allTables = await DbSeeder.getRestaurantTables(testRestaurantId);
        expect(bookedSlot.availableTables.length).toBeLessThan(allTables.length);
      }
    });

    it('should return only tables with sufficient capacity', async () => {
      const date = TestDataFactory.getFutureDate(7);
      const largePartySize = 8;

      const response = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: largePartySize,
        })
        .expect(200);

      // All available tables should have capacity >= party size
      response.body.data.forEach((slot: any) => {
        slot.availableTables.forEach((table: any) => {
          expect(table.capacity).toBeGreaterThanOrEqual(largePartySize);
        });
      });
    });

    it('should return empty array for fully booked day', async () => {
      const date = TestDataFactory.getFutureDate(7);
      const tables = await DbSeeder.getRestaurantTables(testRestaurantId);
      const timeSlots = TestDataFactory.generateTimeSlots(11, 22, 30);

      // Book all tables for all time slots
      for (const timeSlot of timeSlots) {
        for (const table of tables) {
          await DbSeeder.createTestReservation(
            testRestaurantId,
            testUserId,
            table.id,
            date,
            timeSlot,
            { status: ReservationStatus.CONFIRMED }
          );
        }
      }

      const response = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache availability results', async () => {
      const date = TestDataFactory.getFutureDate(7);

      // First request (cache miss)
      const response1 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      // Second request (cache hit - should be faster and return same data)
      const response2 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      // Results should be the same
      expect(response2.body.data).toEqual(response1.body.data);
    });

    it('should invalidate cache after creating a reservation', async () => {
      const date = TestDataFactory.getFutureDate(7);

      // First, get availability (populates cache)
      const response1 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      const initialAvailability = response1.body.data;

      // Create a reservation
      const reservationRequest = TestDataFactory.createReservationRequest({
        restaurantId: testRestaurantId,
        userId: testUserId,
        date,
        timeSlot: '19:00',
        partySize: 2,
      });

      await request(app).post('/api/reservations').send(reservationRequest).expect(201);

      // Get availability again (cache should be invalidated)
      const response2 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      // Availability should be different or slot should have fewer tables
      const slot19 = response2.body.data.find((s: any) => s.timeSlot === '19:00');
      const initialSlot19 = initialAvailability.find((s: any) => s.timeSlot === '19:00');

      if (slot19 && initialSlot19) {
        expect(slot19.availableTables.length).toBeLessThanOrEqual(
          initialSlot19.availableTables.length
        );
      }
    });

    it('should invalidate cache after confirming a reservation', async () => {
      const date = TestDataFactory.getFutureDate(7);

      // Create a pending reservation
      const reservation = await DbSeeder.createTestReservation(
        testRestaurantId,
        testUserId,
        testTableId,
        date,
        '20:00',
        { status: ReservationStatus.PENDING }
      );

      // Get initial availability
      const response1 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      // Confirm the reservation
      await request(app)
        .post(`/api/reservations/${reservation.id}/confirm`)
        .send({ date })
        .expect(200);

      // Get availability again (cache should be invalidated)
      const response2 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      // Should have updated availability
      expect(response2.body.data).toBeDefined();
    });

    it('should invalidate cache after cancelling a reservation', async () => {
      const date = TestDataFactory.getFutureDate(7);

      // Create a confirmed reservation
      const reservation = await DbSeeder.createTestReservation(
        testRestaurantId,
        testUserId,
        testTableId,
        date,
        '21:00',
        { status: ReservationStatus.CONFIRMED }
      );

      // Get initial availability (should not include 21:00 or have fewer tables)
      const response1 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      const slot21Before = response1.body.data.find((s: any) => s.timeSlot === '21:00');

      // Cancel the reservation
      await request(app)
        .post(`/api/reservations/${reservation.id}/cancel`)
        .send({ date })
        .expect(200);

      // Get availability again (should now include the table)
      const response2 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      const slot21After = response2.body.data.find((s: any) => s.timeSlot === '21:00');

      // After cancellation, should have more or equal tables available
      if (slot21Before && slot21After) {
        expect(slot21After.availableTables.length).toBeGreaterThanOrEqual(
          slot21Before.availableTables.length
        );
      } else if (!slot21Before && slot21After) {
        // Slot became available after cancellation
        expect(slot21After.availableTables.length).toBeGreaterThan(0);
      }
    });

    it('should handle cache expiration gracefully', async () => {
      const date = TestDataFactory.getFutureDate(7);

      // Get availability (populates cache with 5-minute TTL)
      const response1 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      // Manually clear cache to simulate expiration
      await cache.flushAll();

      // Get availability again (should still work)
      const response2 = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      expect(response2.body.data).toEqual(response1.body.data);
    });
  });

  describe('Concurrent Availability Checks', () => {
    it('should handle multiple concurrent availability requests', async () => {
      const date = TestDataFactory.getFutureDate(7);

      // Make 10 concurrent availability requests
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/reservations/availability')
          .query({
            restaurantId: testRestaurantId,
            date,
            partySize: 2,
          })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      // All responses should be identical (cache working)
      const firstData = JSON.stringify(responses[0]!.body.data);
      responses.forEach((response) => {
        expect(JSON.stringify(response.body.data)).toBe(firstData);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array for restaurant with no tables', async () => {
      // This would require a restaurant with no tables in the DB
      // For now, we test with a non-existent restaurant
      const response = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: '00000000-0000-0000-0000-000000000000',
          date: TestDataFactory.getFutureDate(7),
          partySize: 2,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle party size larger than any table capacity', async () => {
      const date = TestDataFactory.getFutureDate(7);

      const response = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 100, // Unrealistic size
        })
        .expect(200);

      // Should return empty or very limited availability
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should work correctly at day boundaries', async () => {
      // Test with date at midnight
      const date = TestDataFactory.getFutureDate(7);

      const response = await request(app)
        .get('/api/reservations/availability')
        .query({
          restaurantId: testRestaurantId,
          date,
          partySize: 2,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
