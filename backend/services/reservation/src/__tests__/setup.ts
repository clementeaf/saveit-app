/**
 * Jest Test Setup
 * Global setup and teardown for tests
 */

import { db } from '@saveit/database';
import { cache } from '@saveit/cache';

// Increase test timeout for integration tests
jest.setTimeout(30000);

beforeAll(async () => {
  // Connect to database and cache before all tests
  await cache.connect();
  
  // Verify database connection
  const dbHealth = await db.healthCheck();
  if (!dbHealth.healthy) {
    throw new Error('Database connection failed in test setup');
  }
});

afterAll(async () => {
  // Cleanup connections after all tests
  await cache.disconnect();
  await db.close();
});
