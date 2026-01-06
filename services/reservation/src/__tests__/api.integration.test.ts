/**
 * Integration Tests for Reservation API Endpoints
 * Tests the complete HTTP API with real database and cache
 */

import request from 'supertest';
import app from '../index';
import { db } from '@saveit/database';
import { cache } from '@saveit/cache';
import { DbSeeder, TestDataFactory } from './helpers';
import { ReservationStatus, ChannelType } from '@saveit/types';

describe('Reservation API Integration Tests', () => {
  let testRestaurantId: string;
  let testUserId: string;
  let testTableId: string;

  beforeAll(async () => {
    // Get test data
    const restaurant = await DbSeeder.getTestRestaurant();
    const user = await DbSeeder.getTestUser();
    const table = await DbSeeder.getTestTable(restaurant.id, 2);

    testRestaurantId = restaurant.id;
    testUserId = user.id;
    testTableId = table.id;
  });

  afterEach(async () => {
    // Clean up test reservations after each test
    await DbSeeder.cleanupReservations('2026-01-01');
    // Clear cache
    await cache.flushAll();
  });

  describe('POST /api/reservations - Create Reservation', () => {
    it('should create a new reservation successfully', async () => {
      const reservationRequest = TestDataFactory.createReservationRequest({
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: TestDataFactory.getFutureDate(7),
        timeSlot: '19:00',
        partySize: 2,
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        channel: ChannelType.WEBCHAT,
      });

      const response = await request(app)
        .post('/api/reservations')
        .send(reservationRequest)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.restaurantId).toBe(testRestaurantId);
      expect(response.body.data.userId).toBe(testUserId);
      expect(response.body.data.guestName).toBe('John Doe');
      expect(response.body.data.status).toBe(ReservationStatus.PENDING);
    });

    it('should create reservation with minimal required fields', async () => {
      const reservationRequest = {
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: TestDataFactory.getFutureDate(10),
        timeSlot: '20:00',
        partySize: 4,
        guestName: 'Jane Smith',
        channel: ChannelType.WHATSAPP,
      };

      const response = await request(app)
        .post('/api/reservations')
        .send(reservationRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.guestName).toBe('Jane Smith');
      expect(response.body.data.partySize).toBe(4);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidRequest = {
        restaurantId: testRestaurantId,
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/reservations')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for conflicting reservation (double booking)', async () => {
      const date = TestDataFactory.getFutureDate(7);
      const timeSlot = '19:00';

      // Create first reservation
      const firstRequest = TestDataFactory.createReservationRequest({
        restaurantId: testRestaurantId,
        userId: testUserId,
        date,
        timeSlot,
      });

      await request(app).post('/api/reservations').send(firstRequest).expect(201);

      // Try to create another reservation for same slot
      const secondRequest = TestDataFactory.createReservationRequest({
        restaurantId: testRestaurantId,
        userId: testUserId,
        date,
        timeSlot,
        guestEmail: 'different@example.com',
      });

      const response = await request(app)
        .post('/api/reservations')
        .send(secondRequest)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESERVATION_CONFLICT');
    });

    it('should return 400 for past date', async () => {
      const pastDate = TestDataFactory.getPastDate(1);
      const request_data = TestDataFactory.createReservationRequest({
        restaurantId: testRestaurantId,
        userId: testUserId,
        date: pastDate,
      });

      const response = await request(app)
        .post('/api/reservations')
        .send(request_data)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const request_data = TestDataFactory.createReservationRequest({
        restaurantId: '00000000-0000-0000-0000-000000000000',
        userId: testUserId,
      });

      const response = await request(app)
        .post('/api/reservations')
        .send(request_data)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/reservations/:id - Get Reservation', () => {
    let reservationId: string;
    let reservationDate: string;

    beforeEach(async () => {
      // Create a test reservation
      reservationDate = TestDataFactory.getFutureDate(7);
      const reservation = await DbSeeder.createTestReservation(
        testRestaurantId,
        testUserId,
        testTableId,
        reservationDate,
        '19:00',
        { guestName: 'Test Guest' }
      );
      reservationId = reservation.id;
    });

    it('should retrieve reservation by ID', async () => {
      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .query({ date: reservationDate })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(reservationId);
      expect(response.body.data.guestName).toBe('Test Guest');
      expect(response.body.data.date).toBe(reservationDate);
    });

    it('should return 400 when date query parameter is missing', async () => {
      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app)
        .get('/api/reservations/00000000-0000-0000-0000-000000000000')
        .query({ date: reservationDate })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/reservations/:id/confirm - Confirm Reservation', () => {
    let reservationId: string;
    let reservationDate: string;

    beforeEach(async () => {
      reservationDate = TestDataFactory.getFutureDate(7);
      const reservation = await DbSeeder.createTestReservation(
        testRestaurantId,
        testUserId,
        testTableId,
        reservationDate,
        '19:00'
      );
      reservationId = reservation.id;
    });

    it('should confirm a pending reservation', async () => {
      const response = await request(app)
        .post(`/api/reservations/${reservationId}/confirm`)
        .send({ date: reservationDate })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(ReservationStatus.CONFIRMED);
      expect(response.body.data.confirmedAt).toBeDefined();
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app)
        .post('/api/reservations/00000000-0000-0000-0000-000000000000/confirm')
        .send({ date: reservationDate })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when trying to confirm already confirmed reservation', async () => {
      // First confirmation
      await request(app)
        .post(`/api/reservations/${reservationId}/confirm`)
        .send({ date: reservationDate })
        .expect(200);

      // Second confirmation attempt
      const response = await request(app)
        .post(`/api/reservations/${reservationId}/confirm`)
        .send({ date: reservationDate })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/reservations/:id/cancel - Cancel Reservation', () => {
    let reservationId: string;
    let reservationDate: string;

    beforeEach(async () => {
      reservationDate = TestDataFactory.getFutureDate(7);
      const reservation = await DbSeeder.createTestReservation(
        testRestaurantId,
        testUserId,
        testTableId,
        reservationDate,
        '19:00'
      );
      reservationId = reservation.id;
    });

    it('should cancel a pending reservation', async () => {
      const response = await request(app)
        .post(`/api/reservations/${reservationId}/cancel`)
        .send({ date: reservationDate })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(ReservationStatus.CANCELLED);
      expect(response.body.data.cancelledAt).toBeDefined();
    });

    it('should cancel a confirmed reservation', async () => {
      // First confirm it
      await DbSeeder.createTestReservation(
        testRestaurantId,
        testUserId,
        testTableId,
        reservationDate,
        '20:00',
        { status: ReservationStatus.CONFIRMED }
      );

      // Then cancel
      const reservation = await db.query(
        'SELECT id FROM reservations WHERE time_slot = $1 AND date = $2',
        ['20:00', reservationDate]
      );
      const confirmedId = reservation.rows[0]?.id;

      const response = await request(app)
        .post(`/api/reservations/${confirmedId}/cancel`)
        .send({ date: reservationDate })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(ReservationStatus.CANCELLED);
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app)
        .post('/api/reservations/00000000-0000-0000-0000-000000000000/cancel')
        .send({ date: reservationDate })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations/user/:userId - Get User Reservations', () => {
    beforeEach(async () => {
      // Create multiple reservations for the user
      const dates = TestDataFactory.generateFutureDates(3, 7);

      for (const date of dates) {
        await DbSeeder.createTestReservation(
          testRestaurantId,
          testUserId,
          testTableId,
          date,
          '19:00'
        );
      }
    });

    it('should retrieve all user reservations', async () => {
      const response = await request(app)
        .get(`/api/reservations/user/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);

      response.body.data.forEach((reservation: any) => {
        expect(reservation.userId).toBe(testUserId);
      });
    });

    it('should filter by status', async () => {
      // Confirm one reservation
      const reservation = await db.query(
        'SELECT id, date FROM reservations WHERE user_id = $1 LIMIT 1',
        [testUserId]
      );
      const resId = reservation.rows[0]?.id;
      const resDate = reservation.rows[0]?.date;

      await request(app)
        .post(`/api/reservations/${resId}/confirm`)
        .send({ date: resDate })
        .expect(200);

      // Query confirmed reservations
      const response = await request(app)
        .get(`/api/reservations/user/${testUserId}`)
        .query({ status: ReservationStatus.CONFIRMED })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((reservation: any) => {
        expect(reservation.status).toBe(ReservationStatus.CONFIRMED);
      });
    });

    it('should return empty array for user with no reservations', async () => {
      const response = await request(app)
        .get('/api/reservations/user/00000000-0000-0000-0000-000000000000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/reservations/restaurant/:restaurantId - Get Restaurant Reservations', () => {
    beforeEach(async () => {
      const date = TestDataFactory.getFutureDate(7);
      const timeSlots = ['18:00', '19:00', '20:00'];

      for (const timeSlot of timeSlots) {
        await DbSeeder.createTestReservation(
          testRestaurantId,
          testUserId,
          testTableId,
          date,
          timeSlot
        );
      }
    });

    it('should retrieve all restaurant reservations', async () => {
      const response = await request(app)
        .get(`/api/reservations/restaurant/${testRestaurantId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);

      response.body.data.forEach((reservation: any) => {
        expect(reservation.restaurantId).toBe(testRestaurantId);
      });
    });

    it('should filter by date', async () => {
      const date = TestDataFactory.getFutureDate(7);

      const response = await request(app)
        .get(`/api/reservations/restaurant/${testRestaurantId}`)
        .query({ date })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((reservation: any) => {
        expect(reservation.date).toBe(date);
      });
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/reservations/restaurant/${testRestaurantId}`)
        .query({ status: ReservationStatus.PENDING })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((reservation: any) => {
        expect(reservation.status).toBe(ReservationStatus.PENDING);
      });
    });
  });
});
