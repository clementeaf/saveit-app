/**
 * Reservation Repository
 * Database operations for reservations
 */

import { PoolClient } from 'pg';

import { Repository } from '@saveit/database';
import {
  Reservation,
  ReservationStatus,
  ReservationRequest,
  Table,
  TableStatus,
  NotFoundError,
} from '@saveit/types';

interface ReservationRow {
  id: string;
  restaurant_id: string;
  user_id: string;
  table_id: string;
  date: string;
  time_slot: string;
  party_size: number;
  duration_minutes: number;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  special_requests: string | null;
  status: ReservationStatus;
  channel: string;
  created_at: Date;
  confirmed_at: Date | null;
  checked_in_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  metadata: Record<string, unknown>;
}

export class ReservationRepository extends Repository<ReservationRow> {
  private mapRowToReservation(row: ReservationRow): Reservation {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      userId: row.user_id,
      tableId: row.table_id,
      date: row.date,
      timeSlot: row.time_slot,
      partySize: row.party_size,
      durationMinutes: row.duration_minutes,
      guestName: row.guest_name,
      guestPhone: row.guest_phone,
      guestEmail: row.guest_email,
      specialRequests: row.special_requests,
      status: row.status,
      channel: row.channel as Reservation['channel'],
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      checkedInAt: row.checked_in_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      metadata: row.metadata,
    };
  }

  /**
   * Create a new reservation
   */
  async create(
    request: ReservationRequest,
    tableId: string,
    client?: PoolClient
  ): Promise<Reservation> {
    const query = `
      INSERT INTO reservations (
        restaurant_id, user_id, table_id, date, time_slot,
        party_size, duration_minutes, guest_name, guest_phone,
        guest_email, special_requests, status, channel, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      request.restaurantId,
      request.userId,
      tableId,
      request.date,
      request.timeSlot,
      request.partySize,
      120, // Default duration
      request.guestName,
      request.guestPhone || null,
      request.guestEmail || null,
      request.specialRequests || null,
      'pending',
      request.channel,
      JSON.stringify({}),
    ];

    const result = client
      ? await client.query<ReservationRow>(query, values)
      : await this.query<ReservationRow>(query, values);

    return this.mapRowToReservation(result.rows[0]!);
  }

  /**
   * Get reservation by ID
   */
  async getById(id: string, date: string): Promise<Reservation | null> {
    const query = `
      SELECT * FROM reservations
      WHERE id = $1 AND date = $2
    `;

    const result = await this.query<ReservationRow>(query, [id, date]);
    return result.rows[0] ? this.mapRowToReservation(result.rows[0]) : null;
  }

  /**
   * Update reservation status
   */
  async updateStatus(
    id: string,
    date: string,
    status: ReservationStatus,
    client?: PoolClient
  ): Promise<Reservation> {
    const statusTimestamp = `${status}_at`;
    const query = `
      UPDATE reservations
      SET status = $1, ${statusTimestamp} = CURRENT_TIMESTAMP
      WHERE id = $2 AND date = $3
      RETURNING *
    `;

    const result = client
      ? await client.query<ReservationRow>(query, [status, id, date])
      : await this.query<ReservationRow>(query, [status, id, date]);

    if (!result.rows[0]) {
      throw new NotFoundError('Reservation', id);
    }

    return this.mapRowToReservation(result.rows[0]);
  }

  /**
   * Check if table is available for given time slot with PESSIMISTIC LOCK
   * CRITICAL: Uses FOR UPDATE to prevent race conditions
   * MUST be called within a transaction
   */
  async isTableAvailable(
    tableId: string,
    date: string,
    timeSlot: string,
    durationMinutes: number = 120,
    client?: PoolClient
  ): Promise<boolean> {
    // CRITICAL: This query MUST run in a transaction with FOR UPDATE
    // to guarantee no other transaction can book this table simultaneously
    // Split into two queries because PostgreSQL doesn't allow FOR UPDATE with GROUP BY
    
    // First: Lock the table row and get its status
    const tableQuery = `
      SELECT 
        t.id,
        t.status,
        t.capacity
      FROM tables t
      WHERE t.id = $1
        AND t.is_active = TRUE
      FOR UPDATE OF t  -- PESSIMISTIC LOCK: Blocks the table row until transaction completes
    `;

    const tableResult = client
      ? await client.query<{ id: string; status: string; capacity: number }>(tableQuery, [tableId])
      : await this.query<{ id: string; status: string; capacity: number }>(tableQuery, [tableId]);

    if (tableResult.rows.length === 0) {
      return false; // Table doesn't exist or is not active
    }

    const table = tableResult.rows[0]!;
    
    if (table.status !== 'available') {
      return false; // Table is not available
    }

    // Second: Count overlapping reservations
    const reservationsQuery = `
      SELECT COUNT(*) as active_reservations
      FROM reservations r
      WHERE r.table_id = $1
        AND r.date = $2
        AND r.status IN ('confirmed', 'checked_in', 'pending')
        AND (
          -- Check if time slots overlap
          (r.time_slot, r.time_slot + (r.duration_minutes || ' minutes')::INTERVAL) OVERLAPS
          ($3::time, $3::time + ($4 || ' minutes')::INTERVAL)
        )
    `;

    const reservationsResult = client
      ? await client.query<{ active_reservations: string }>(reservationsQuery, [
          tableId,
          date,
          timeSlot,
          durationMinutes,
        ])
      : await this.query<{ active_reservations: string }>(reservationsQuery, [
          tableId,
          date,
          timeSlot,
          durationMinutes,
        ]);

    const activeReservations = parseInt(reservationsResult.rows[0]?.active_reservations || '0', 10);
    
    return activeReservations === 0;
  }

  /**
   * Check if user has conflicting reservations
   * CRITICAL: Validates that user doesn't have another reservation in conflicting time
   * MUST be called within a transaction with FOR UPDATE
   */
  async checkUserConflict(
    userId: string,
    restaurantId: string,
    date: string,
    timeSlot: string,
    _durationMinutes: number = 120,
    client?: PoolClient
  ): Promise<boolean> {
    // Check if user has any reservation within ±2 hours window
    const query = `
      SELECT id 
      FROM reservations 
      WHERE 
        user_id = $1 
        AND restaurant_id = $2
        AND date = $3
        AND status IN ('confirmed', 'checked_in', 'pending')
        AND (
          -- Conflicting time window (±2 hours)
          (time_slot >= ($4::time - interval '2 hours') 
           AND time_slot <= ($4::time + interval '2 hours'))
        )
      FOR UPDATE  -- PESSIMISTIC LOCK on user's reservations
      LIMIT 1
    `;

    const result = client
      ? await client.query<{ id: string }>(query, [userId, restaurantId, date, timeSlot])
      : await this.query<{ id: string }>(query, [userId, restaurantId, date, timeSlot]);

    return result.rows.length > 0; // true if conflict exists
  }

  /**
   * Get available tables for a restaurant
   */
  async getAvailableTables(
    restaurantId: string,
    date: string,
    timeSlot: string,
    partySize: number,
    durationMinutes: number = 120
  ): Promise<Table[]> {
    const query = `
      SELECT * FROM get_available_tables($1, $2, $3, $4, $5)
    `;

    const result = await this.query<{
      table_id: string;
      table_number: string;
      capacity: number;
      location: string | null;
    }>(query, [restaurantId, date, timeSlot, partySize, durationMinutes]);

    return result.rows.map((row) => ({
      id: row.table_id,
      restaurantId,
      tableNumber: row.table_number,
      capacity: row.capacity,
      minCapacity: 1,
      location: row.location,
      status: TableStatus.AVAILABLE,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Get reservations by user
   */
  async getByUser(userId: string, includeCompleted: boolean = false): Promise<Reservation[]> {
    const query = includeCompleted
      ? `SELECT * FROM reservations WHERE user_id = $1 ORDER BY date DESC, time_slot DESC LIMIT 50`
      : `SELECT * FROM reservations WHERE user_id = $1 AND status NOT IN ('completed', 'cancelled', 'no_show') ORDER BY date ASC, time_slot ASC`;

    const result = await this.query<ReservationRow>(query, [userId]);
    return result.rows.map((row) => this.mapRowToReservation(row));
  }

  /**
   * Get reservations by user with filters
   */
  async getByUserId(
    userId: string,
    filters?: { status?: string; startDate?: string; endDate?: string }
  ): Promise<Reservation[]> {
    let query = 'SELECT * FROM reservations WHERE user_id = $1';
    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.startDate) {
      query += ` AND date >= $${paramIndex}`;
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND date <= $${paramIndex}`;
      values.push(filters.endDate);
      paramIndex++;
    }

    query += ' ORDER BY date DESC, time_slot DESC LIMIT 50';

    const result = await this.query<ReservationRow>(query, values);
    return result.rows.map((row) => this.mapRowToReservation(row));
  }

  /**
   * Get reservations by restaurant with filters
   */
  async getByRestaurantId(
    restaurantId: string,
    filters?: { date?: string; status?: string }
  ): Promise<Reservation[]> {
    let query = 'SELECT * FROM reservations WHERE restaurant_id = $1';
    const values: any[] = [restaurantId];
    let paramIndex = 2;

    if (filters?.date) {
      query += ` AND date = $${paramIndex}`;
      values.push(filters.date);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }

    query += ' ORDER BY date ASC, time_slot ASC';

    const result = await this.query<ReservationRow>(query, values);
    return result.rows.map((row) => this.mapRowToReservation(row));
  }

  /**
   * Get reservations by restaurant and date
   */
  async getByRestaurantAndDate(restaurantId: string, date: string): Promise<Reservation[]> {
    const query = `
      SELECT * FROM reservations
      WHERE restaurant_id = $1 AND date = $2
      ORDER BY time_slot ASC
    `;

    const result = await this.query<ReservationRow>(query, [restaurantId, date]);
    return result.rows.map((row) => this.mapRowToReservation(row));
  }
}
