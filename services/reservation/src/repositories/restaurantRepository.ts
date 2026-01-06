/**
 * Restaurant Repository
 * Database operations for restaurants
 */

import { Repository } from '@saveit/database';
import { Restaurant, NotFoundError } from '@saveit/types';

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  business_hours: Record<string, unknown>;
  max_advance_days: number;
  min_advance_hours: number;
  reservation_duration_minutes: number;
  cancellation_hours_before: number;
  requires_deposit: boolean;
  deposit_amount: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class RestaurantRepository extends Repository<RestaurantRow> {
  private mapRowToRestaurant(row: RestaurantRow): Restaurant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: row.address,
      phone: row.phone,
      email: row.email,
      timezone: row.timezone,
      businessHours: row.business_hours as Restaurant['businessHours'],
      maxAdvanceDays: row.max_advance_days,
      minAdvanceHours: row.min_advance_hours,
      reservationDurationMinutes: row.reservation_duration_minutes,
      cancellationHoursBefore: row.cancellation_hours_before,
      requiresDeposit: row.requires_deposit,
      depositAmount: row.deposit_amount,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get restaurant by ID
   */
  async getById(id: string): Promise<Restaurant> {
    const query = `SELECT * FROM restaurants WHERE id = $1 AND is_active = TRUE`;
    const result = await this.query<RestaurantRow>(query, [id]);

    if (!result.rows[0]) {
      throw new NotFoundError('Restaurant', id);
    }

    return this.mapRowToRestaurant(result.rows[0]);
  }

  /**
   * Get restaurant by slug
   */
  async getBySlug(slug: string): Promise<Restaurant> {
    const query = `SELECT * FROM restaurants WHERE slug = $1 AND is_active = TRUE`;
    const result = await this.query<RestaurantRow>(query, [slug]);

    if (!result.rows[0]) {
      throw new NotFoundError('Restaurant', slug);
    }

    return this.mapRowToRestaurant(result.rows[0]);
  }

  /**
   * Get all active restaurants
   */
  async getAll(): Promise<Restaurant[]> {
    const query = `SELECT * FROM restaurants WHERE is_active = TRUE ORDER BY name ASC`;
    const result = await this.query<RestaurantRow>(query);
    return result.rows.map((row) => this.mapRowToRestaurant(row));
  }
}
