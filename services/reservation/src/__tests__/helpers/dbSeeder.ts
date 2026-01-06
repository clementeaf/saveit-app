/**
 * Database Seeding Helper for Tests
 * Helpers for setting up and tearing down test data
 */

import { db } from '@saveit/database';
import { ChannelType, ReservationStatus } from '@saveit/types';

export interface TestRestaurant {
  id: string;
  slug: string;
  name: string;
}

export interface TestUser {
  id: string;
  email: string;
  fullName: string;
}

export interface TestTable {
  id: string;
  restaurantId: string;
  tableNumber: string;
  capacity: number;
}

export interface TestReservation {
  id: string;
  restaurantId: string;
  userId: string;
  tableId: string;
  date: string;
  timeSlot: string;
}

export class DbSeeder {
  /**
   * Get test restaurant from seeded data
   */
  static async getTestRestaurant(): Promise<TestRestaurant> {
    const result = await db.query(
      "SELECT id, slug, name FROM restaurants WHERE slug = 'la-bella-tavola' AND is_active = TRUE LIMIT 1"
    );

    if (!result.rows[0]) {
      throw new Error('Test restaurant not found in database. Run seed script first.');
    }

    return {
      id: result.rows[0].id,
      slug: result.rows[0].slug,
      name: result.rows[0].name,
    };
  }

  /**
   * Get test user from seeded data
   */
  static async getTestUser(): Promise<TestUser> {
    const result = await db.query('SELECT id, email, full_name FROM users LIMIT 1');

    if (!result.rows[0]) {
      throw new Error('Test user not found in database. Run seed script first.');
    }

    return {
      id: result.rows[0].id,
      email: result.rows[0].email,
      fullName: result.rows[0].full_name,
    };
  }

  /**
   * Get multiple test users
   */
  static async getTestUsers(count: number = 3): Promise<TestUser[]> {
    const result = await db.query(
      'SELECT id, email, full_name FROM users ORDER BY created_at LIMIT $1',
      [count]
    );

    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
    }));
  }

  /**
   * Get test table from seeded data
   */
  static async getTestTable(restaurantId: string, minCapacity: number = 2): Promise<TestTable> {
    const result = await db.query(
      `SELECT id, restaurant_id, table_number, capacity 
       FROM tables 
       WHERE restaurant_id = $1 AND capacity >= $2 AND is_active = TRUE
       ORDER BY capacity ASC
       LIMIT 1`,
      [restaurantId, minCapacity]
    );

    if (!result.rows[0]) {
      throw new Error(
        `Test table not found for restaurant ${restaurantId} with capacity >= ${minCapacity}`
      );
    }

    return {
      id: result.rows[0].id,
      restaurantId: result.rows[0].restaurant_id,
      tableNumber: result.rows[0].table_number,
      capacity: result.rows[0].capacity,
    };
  }

  /**
   * Get all tables for a restaurant
   */
  static async getRestaurantTables(restaurantId: string): Promise<TestTable[]> {
    const result = await db.query(
      `SELECT id, restaurant_id, table_number, capacity 
       FROM tables 
       WHERE restaurant_id = $1 AND is_active = TRUE
       ORDER BY capacity ASC`,
      [restaurantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      capacity: row.capacity,
    }));
  }

  /**
   * Create a test reservation directly in database
   */
  static async createTestReservation(
    restaurantId: string,
    userId: string,
    tableId: string,
    date: string,
    timeSlot: string,
    options?: {
      partySize?: number;
      status?: ReservationStatus;
      guestName?: string;
      channel?: ChannelType;
    }
  ): Promise<TestReservation> {
    const result = await db.query(
      `INSERT INTO reservations 
       (restaurant_id, user_id, table_id, date, time_slot, party_size, 
        duration_minutes, guest_name, status, channel, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, restaurant_id, user_id, table_id, date, time_slot`,
      [
        restaurantId,
        userId,
        tableId,
        date,
        timeSlot,
        options?.partySize || 2,
        120,
        options?.guestName || 'Test Guest',
        options?.status || ReservationStatus.PENDING,
        options?.channel || ChannelType.WEBCHAT,
        JSON.stringify({}),
      ]
    );

    return {
      id: result.rows[0]!.id,
      restaurantId: result.rows[0]!.restaurant_id,
      userId: result.rows[0]!.user_id,
      tableId: result.rows[0]!.table_id,
      date: result.rows[0]!.date,
      timeSlot: result.rows[0]!.time_slot,
    };
  }

  /**
   * Create multiple test reservations
   */
  static async createMultipleReservations(
    restaurantId: string,
    userId: string,
    tableId: string,
    count: number,
    baseDate: string = '2026-03-15'
  ): Promise<TestReservation[]> {
    const reservations: TestReservation[] = [];

    for (let i = 0; i < count; i++) {
      const hour = 18 + i; // Start from 18:00
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;

      const reservation = await this.createTestReservation(
        restaurantId,
        userId,
        tableId,
        baseDate,
        timeSlot,
        {
          guestName: `Test Guest ${i + 1}`,
        }
      );

      reservations.push(reservation);
    }

    return reservations;
  }

  /**
   * Clean up test reservations (for dates >= specified date)
   */
  static async cleanupReservations(fromDate: string = '2026-01-01'): Promise<void> {
    await db.query('DELETE FROM reservations WHERE date >= $1', [fromDate]);
  }

  /**
   * Clean up all test data (use with caution!)
   */
  static async cleanupAllTestData(): Promise<void> {
    await db.query('DELETE FROM reservations WHERE date >= $1', ['2026-01-01']);
    await db.query('DELETE FROM conversations');
    await db.query('DELETE FROM messages');
  }

  /**
   * Get reservation count for a specific slot
   */
  static async getReservationCount(
    restaurantId: string,
    date: string,
    timeSlot: string
  ): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM reservations 
       WHERE restaurant_id = $1 AND date = $2 AND time_slot = $3
       AND status IN ('confirmed', 'checked_in', 'pending')`,
      [restaurantId, date, timeSlot]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Check if table is available (direct DB query)
   */
  static async isTableAvailableDirect(
    tableId: string,
    date: string,
    timeSlot: string
  ): Promise<boolean> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM reservations
       WHERE table_id = $1 AND date = $2
       AND status IN ('confirmed', 'checked_in', 'pending')
       AND (
         (time_slot, time_slot + (duration_minutes || ' minutes')::INTERVAL) OVERLAPS
         ($3::time, $3::time + (120 || ' minutes')::INTERVAL)
       )`,
      [tableId, date, timeSlot]
    );

    return parseInt(result.rows[0]?.count || '0', 10) === 0;
  }

  /**
   * Wait for async operations (useful for integration tests)
   */
  static async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute multiple operations in a transaction (for test setup)
   */
  static async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return await db.transaction(callback);
  }

  /**
   * Get database statistics (for debugging)
   */
  static async getStats(): Promise<{
    restaurants: number;
    users: number;
    tables: number;
    reservations: number;
  }> {
    const [restaurants, users, tables, reservations] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM restaurants WHERE is_active = TRUE'),
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query('SELECT COUNT(*) as count FROM tables WHERE is_active = TRUE'),
      db.query("SELECT COUNT(*) as count FROM reservations WHERE date >= '2026-01-01'"),
    ]);

    return {
      restaurants: parseInt(restaurants.rows[0]?.count || '0', 10),
      users: parseInt(users.rows[0]?.count || '0', 10),
      tables: parseInt(tables.rows[0]?.count || '0', 10),
      reservations: parseInt(reservations.rows[0]?.count || '0', 10),
    };
  }
}
