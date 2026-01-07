/**
 * Unit Tests for RestaurantRepository
 * Tests restaurant retrieval operations
 */

import { db } from '@saveit/database';
import { RestaurantRepository } from '../repositories/restaurantRepository';
import { NotFoundError } from '@saveit/types';

describe('RestaurantRepository', () => {
  let repository: RestaurantRepository;
  let testRestaurantId: string;
  let testRestaurantSlug: string;

  beforeAll(async () => {
    repository = new RestaurantRepository();

    // Get test restaurant from seeded database
    const result = await db.query(
      "SELECT id, slug FROM restaurants WHERE slug = 'la-bella-tavola' LIMIT 1"
    );
    testRestaurantId = result.rows[0]?.id;
    testRestaurantSlug = result.rows[0]?.slug;
  });

  describe('getById()', () => {
    it('should retrieve restaurant by ID', async () => {
      const restaurant = await repository.getById(testRestaurantId);

      expect(restaurant).toBeDefined();
      expect(restaurant.id).toBe(testRestaurantId);
      expect(restaurant.name).toBeDefined();
      expect(restaurant.slug).toBe(testRestaurantSlug);
      expect(restaurant.address).toBeDefined();
      expect(restaurant.phone).toBeDefined();
      expect(restaurant.email).toBeDefined();
      expect(restaurant.timezone).toBeDefined();
      expect(restaurant.isActive).toBe(true);
    });

    it('should return restaurant with business hours', async () => {
      const restaurant = await repository.getById(testRestaurantId);

      expect(restaurant.businessHours).toBeDefined();
      expect(typeof restaurant.businessHours).toBe('object');
      
      // Check structure of business hours
      Object.values(restaurant.businessHours).forEach((daySchedule) => {
        if (Array.isArray(daySchedule) && daySchedule.length > 0) {
          expect(daySchedule[0]).toHaveProperty('open');
          expect(daySchedule[0]).toHaveProperty('close');
        }
      });
    });

    it('should return restaurant with reservation settings', async () => {
      const restaurant = await repository.getById(testRestaurantId);

      expect(restaurant.maxAdvanceDays).toBeGreaterThan(0);
      expect(restaurant.minAdvanceHours).toBeGreaterThanOrEqual(0);
      expect(restaurant.reservationDurationMinutes).toBeGreaterThan(0);
      expect(restaurant.cancellationHoursBefore).toBeGreaterThanOrEqual(0);
      expect(typeof restaurant.requiresDeposit).toBe('boolean');
    });

    it('should return restaurant with timestamps', async () => {
      const restaurant = await repository.getById(testRestaurantId);

      expect(restaurant.createdAt).toBeInstanceOf(Date);
      expect(restaurant.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError for non-existent restaurant', async () => {
      await expect(
        repository.getById('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(NotFoundError);

      await expect(
        repository.getById('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Restaurant not found');
    });

    it('should throw NotFoundError for inactive restaurant', async () => {
      // Create an inactive restaurant for testing
      const insertResult = await db.query(
        `INSERT INTO restaurants 
         (name, slug, address, phone, email, timezone, business_hours, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          'Inactive Restaurant',
          'inactive-test',
          '123 Test St',
          '+12125551234',
          'inactive@test.com',
          'America/New_York',
          JSON.stringify({}),
          false, // inactive
        ]
      );
      const inactiveId = insertResult.rows[0]!.id;

      await expect(repository.getById(inactiveId)).rejects.toThrow(NotFoundError);

      // Cleanup
      await db.query('DELETE FROM restaurants WHERE id = $1', [inactiveId]);
    });
  });

  describe('getBySlug()', () => {
    it('should retrieve restaurant by slug', async () => {
      const restaurant = await repository.getBySlug(testRestaurantSlug);

      expect(restaurant).toBeDefined();
      expect(restaurant.id).toBe(testRestaurantId);
      expect(restaurant.slug).toBe(testRestaurantSlug);
      expect(restaurant.name).toBeDefined();
    });

    it('should be case-sensitive for slug', async () => {
      // Assuming slug is lowercase in seed data
      const uppercaseSlug = testRestaurantSlug.toUpperCase();
      
      await expect(repository.getBySlug(uppercaseSlug)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError for non-existent slug', async () => {
      await expect(
        repository.getBySlug('non-existent-restaurant')
      ).rejects.toThrow(NotFoundError);

      await expect(
        repository.getBySlug('non-existent-restaurant')
      ).rejects.toThrow('Restaurant not found');
    });

    it('should throw NotFoundError for inactive restaurant slug', async () => {
      // Create an inactive restaurant
      const insertResult = await db.query(
        `INSERT INTO restaurants 
         (name, slug, address, phone, email, timezone, business_hours, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING slug`,
        [
          'Inactive Restaurant 2',
          'inactive-test-2',
          '123 Test St',
          '+12125551235',
          'inactive2@test.com',
          'America/New_York',
          JSON.stringify({}),
          false,
        ]
      );
      const inactiveSlug = insertResult.rows[0]!.slug;

      await expect(repository.getBySlug(inactiveSlug)).rejects.toThrow(
        NotFoundError
      );

      // Cleanup
      await db.query('DELETE FROM restaurants WHERE slug = $1', [inactiveSlug]);
    });
  });

  describe('getAll()', () => {
    it('should retrieve all active restaurants', async () => {
      const restaurants = await repository.getAll();

      expect(Array.isArray(restaurants)).toBe(true);
      expect(restaurants.length).toBeGreaterThan(0);

      // Verify all are active
      restaurants.forEach((restaurant) => {
        expect(restaurant.isActive).toBe(true);
      });
    });

    it('should return restaurants ordered by name', async () => {
      const restaurants = await repository.getAll();

      // Verify alphabetical order
      for (let i = 1; i < restaurants.length; i++) {
        const prevName = restaurants[i - 1]!.name.toLowerCase();
        const currName = restaurants[i]!.name.toLowerCase();
        expect(currName >= prevName).toBe(true);
      }
    });
    
    it('should include the test restaurant', async () => {
      const restaurants = await repository.getAll();

      const testRestaurant = restaurants.find((r) => r.id === testRestaurantId);
      expect(testRestaurant).toBeDefined();
      expect(testRestaurant!.slug).toBe(testRestaurantSlug);
    });

    it('should not include inactive restaurants', async () => {
      // Create an inactive restaurant
      const insertResult = await db.query(
        `INSERT INTO restaurants 
         (name, slug, address, phone, email, timezone, business_hours, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          'Inactive Restaurant 3',
          'inactive-test-3',
          '123 Test St',
          '+12125551236',
          'inactive3@test.com',
          'America/New_York',
          JSON.stringify({}),
          false,
        ]
      );
      const inactiveId = insertResult.rows[0]!.id;

      const restaurants = await repository.getAll();

      const inactiveRestaurant = restaurants.find((r) => r.id === inactiveId);
      expect(inactiveRestaurant).toBeUndefined();

      // Cleanup
      await db.query('DELETE FROM restaurants WHERE id = $1', [inactiveId]);
    });

    it('should return complete restaurant objects', async () => {
      const restaurants = await repository.getAll();

      restaurants.forEach((restaurant) => {
        expect(restaurant.id).toBeDefined();
        expect(restaurant.name).toBeDefined();
        expect(restaurant.slug).toBeDefined();
        expect(restaurant.address).toBeDefined();
        expect(restaurant.phone).toBeDefined();
        expect(restaurant.email).toBeDefined();
        expect(restaurant.timezone).toBeDefined();
        expect(restaurant.businessHours).toBeDefined();
        expect(restaurant.maxAdvanceDays).toBeGreaterThan(0);
        expect(restaurant.minAdvanceHours).toBeGreaterThanOrEqual(0);
        expect(restaurant.reservationDurationMinutes).toBeGreaterThan(0);
        expect(restaurant.createdAt).toBeInstanceOf(Date);
        expect(restaurant.updatedAt).toBeInstanceOf(Date);
      });
    });

    it('should handle empty result set gracefully', async () => {
      // Temporarily mark all restaurants as inactive
      await db.query('UPDATE restaurants SET is_active = FALSE');

      const restaurants = await repository.getAll();
      expect(restaurants).toEqual([]);

      // Restore
      await db.query('UPDATE restaurants SET is_active = TRUE');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null deposit amount', async () => {
      const restaurant = await repository.getById(testRestaurantId);

      // Deposit amount can be null if not required
      if (!restaurant.requiresDeposit) {
        expect(restaurant.depositAmount === null || typeof restaurant.depositAmount === 'number').toBe(true);
      }
    });

    it('should handle empty business hours gracefully', async () => {
      // Create a restaurant with empty business hours
      const insertResult = await db.query(
        `INSERT INTO restaurants 
         (name, slug, address, phone, email, timezone, business_hours, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          'No Hours Restaurant',
          'no-hours-test',
          '123 Test St',
          '+12125551237',
          'nohours@test.com',
          'America/New_York',
          JSON.stringify({}),
          true,
        ]
      );
      const noHoursId = insertResult.rows[0]!.id;

      const restaurant = await repository.getById(noHoursId);
      expect(restaurant.businessHours).toBeDefined();
      expect(typeof restaurant.businessHours).toBe('object');

      // Cleanup
      await db.query('DELETE FROM restaurants WHERE id = $1', [noHoursId]);
    });
  });
});
