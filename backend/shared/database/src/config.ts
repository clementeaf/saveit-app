/**
 * Database Configuration
 */

import { PoolConfig } from 'pg';

export interface DatabaseConfig extends PoolConfig {
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export function getDatabaseConfig(): DatabaseConfig {
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error('Database configuration missing. Required: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
  }

  return {
    host,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database,
    user,
    password,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // SSL configuration
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}
