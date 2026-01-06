#!/usr/bin/env node
/**
 * Database Migration Script
 * Runs SQL migration files against PostgreSQL database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'saveit',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Create migrations table if it doesn't exist
 */
async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
  console.log('✓ Migrations table ready');
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations() {
  const result = await pool.query(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return result.rows.map((row) => row.filename);
}

/**
 * Get list of migration files
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/**
 * Execute a migration file
 */
async function executeMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`Running migration: ${filename}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Execute the migration SQL
    await client.query(sql);
    
    // Record the migration
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [filename]
    );
    
    await client.query('COMMIT');
    console.log(`✓ Migration completed: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Migration failed: ${filename}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reset database (drop all tables)
 */
async function resetDatabase() {
  console.log('⚠️  Resetting database...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop all tables
    await client.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    // Drop all types
    await client.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e') 
        LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    await client.query('COMMIT');
    console.log('✓ Database reset completed');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Database reset failed');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main migration function
 */
async function migrate(options = {}) {
  try {
    console.log('Starting database migration...\n');

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection established');

    // Reset if requested
    if (options.reset) {
      await resetDatabase();
    }

    // Create migrations table
    await createMigrationsTable();

    // Get executed and pending migrations
    const executed = await getExecutedMigrations();
    const allMigrations = getMigrationFiles();
    const pending = allMigrations.filter((file) => !executed.includes(file));

    if (pending.length === 0) {
      console.log('\n✓ No pending migrations');
      return;
    }

    console.log(`\nFound ${pending.length} pending migration(s):\n`);
    pending.forEach((file) => console.log(`  - ${file}`));
    console.log('');

    // Execute pending migrations
    for (const file of pending) {
      await executeMigration(file);
    }

    console.log('\n✓ All migrations completed successfully');
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  reset: args.includes('--reset') || args.includes('-r'),
};

// Run migrations
migrate(options);
