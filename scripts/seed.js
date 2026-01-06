#!/usr/bin/env node
/**
 * Database Seed Script
 * Loads test data into the database
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'saveit',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Seed data
 */
async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('Starting database seed...\n');

    await client.query('BEGIN');

    // 1. Create test users
    console.log('Creating test users...');
    const usersResult = await client.query(`
      INSERT INTO users (email, phone, full_name) VALUES
        ('john.doe@example.com', '+1234567890', 'John Doe'),
        ('jane.smith@example.com', '+1234567891', 'Jane Smith'),
        (NULL, '+1234567892', 'Bob Johnson'),
        ('alice.wilson@example.com', NULL, 'Alice Wilson')
      RETURNING id, full_name;
    `);
    console.log(`✓ Created ${usersResult.rowCount} users`);

    const userIds = usersResult.rows.map((row) => row.id);

    // 2. Create test restaurant
    console.log('Creating test restaurant...');
    const restaurantResult = await client.query(`
      INSERT INTO restaurants (
        name, 
        slug, 
        address, 
        phone, 
        email, 
        timezone,
        business_hours,
        max_advance_days,
        min_advance_hours,
        reservation_duration_minutes,
        cancellation_hours_before
      ) VALUES (
        'La Bella Tavola',
        'la-bella-tavola',
        '123 Main Street, New York, NY 10001',
        '+1234567899',
        'info@labellatavolademo.com',
        'America/New_York',
        '{
          "monday": {"open": "12:00", "close": "22:00"},
          "tuesday": {"open": "12:00", "close": "22:00"},
          "wednesday": {"open": "12:00", "close": "22:00"},
          "thursday": {"open": "12:00", "close": "22:00"},
          "friday": {"open": "12:00", "close": "23:00"},
          "saturday": {"open": "11:00", "close": "23:00"},
          "sunday": {"open": "11:00", "close": "21:00"}
        }'::jsonb,
        90,
        2,
        120,
        24
      )
      RETURNING id, name;
    `);
    console.log(`✓ Created restaurant: ${restaurantResult.rows[0].name}`);

    const restaurantId = restaurantResult.rows[0].id;

    // 3. Create test tables
    console.log('Creating restaurant tables...');
    const tablesResult = await client.query(`
      INSERT INTO tables (restaurant_id, table_number, capacity, min_capacity, location) VALUES
        ($1, 'T1', 2, 1, 'Window'),
        ($1, 'T2', 2, 1, 'Window'),
        ($1, 'T3', 4, 2, 'Main Floor'),
        ($1, 'T4', 4, 2, 'Main Floor'),
        ($1, 'T5', 6, 4, 'Private Room'),
        ($1, 'T6', 8, 6, 'Private Room'),
        ($1, 'T7', 2, 1, 'Bar'),
        ($1, 'T8', 4, 2, 'Patio')
      RETURNING id, table_number, capacity;
    `, [restaurantId]);
    console.log(`✓ Created ${tablesResult.rowCount} tables`);

    const tableIds = tablesResult.rows.map((row) => row.id);

    // 4. Create user channel identifiers
    console.log('Creating user channel identifiers...');
    await client.query(`
      INSERT INTO user_channel_identifiers (user_id, channel, channel_user_id) VALUES
        ($1, 'whatsapp', 'wa_12345'),
        ($2, 'instagram', 'ig_54321'),
        ($3, 'webchat', 'web_11111'),
        ($4, 'email', 'email_22222')
    `, [userIds[0], userIds[1], userIds[2], userIds[3]]);
    console.log('✓ Created user channel identifiers');

    // 5. Create sample reservations
    console.log('Creating sample reservations...');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const formatDate = (date) => date.toISOString().split('T')[0];

    await client.query(`
      INSERT INTO reservations (
        restaurant_id, 
        user_id, 
        table_id, 
        date, 
        time_slot, 
        party_size,
        guest_name,
        guest_phone,
        guest_email,
        status,
        channel,
        special_requests
      ) VALUES
        ($1, $2, $3, $4, '19:00', 2, 'John Doe', '+1234567890', 'john.doe@example.com', 'confirmed', 'whatsapp', 'Window seat please'),
        ($1, $5, $6, $4, '20:00', 4, 'Jane Smith', '+1234567891', 'jane.smith@example.com', 'confirmed', 'instagram', NULL),
        ($1, $7, $8, $9, '18:30', 2, 'Bob Johnson', '+1234567892', NULL, 'pending', 'webchat', 'Anniversary dinner'),
        ($1, $10, $11, $12, '19:30', 6, 'Alice Wilson', NULL, 'alice.wilson@example.com', 'confirmed', 'email', 'Birthday celebration')
    `, [
      restaurantId, userIds[0], tableIds[0], formatDate(tomorrow),
      userIds[1], tableIds[2], 
      userIds[2], tableIds[6], formatDate(tomorrow),
      userIds[3], tableIds[4], formatDate(nextWeek)
    ]);
    console.log('✓ Created sample reservations');

    await client.query('COMMIT');
    console.log('\n✓ Database seed completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n✗ Seed failed:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seed
seedDatabase();
