/**
 * Unit Tests for Redis Distributed Locks
 * Tests critical lock functionality: acquire, release, extend
 */

import { RedisClient } from '../client';

describe('RedisClient - Distributed Locks', () => {
  let client: RedisClient;

  beforeAll(async () => {
    client = RedisClient.getInstance();
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  beforeEach(async () => {
    // Clean all locks before each test
    await client.flushAll();
  });

  describe('acquireLock', () => {
    it('should successfully acquire a lock when available', async () => {
      const lockKey = 'test:lock:1';
      const lockValue = 'unique-value-1';
      const ttl = 30;

      const result = await client.acquireLock(lockKey, lockValue, ttl);

      expect(result).toBe(true);

      // Verify lock exists
      const storedValue = await client.get(lockKey);
      expect(storedValue).toBe(lockValue);
    });

    it('should fail to acquire lock when already taken', async () => {
      const lockKey = 'test:lock:2';
      const lockValue1 = 'value-1';
      const lockValue2 = 'value-2';
      const ttl = 30;

      // First acquisition should succeed
      const result1 = await client.acquireLock(lockKey, lockValue1, ttl);
      expect(result1).toBe(true);

      // Second acquisition should fail
      const result2 = await client.acquireLock(lockKey, lockValue2, ttl);
      expect(result2).toBe(false);

      // Original value should remain
      const storedValue = await client.get(lockKey);
      expect(storedValue).toBe(lockValue1);
    });

    it('should acquire lock after TTL expires', async () => {
      const lockKey = 'test:lock:3';
      const lockValue1 = 'value-1';
      const lockValue2 = 'value-2';
      const ttl = 1; // 1 second

      // Acquire first lock
      await client.acquireLock(lockKey, lockValue1, ttl);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be able to acquire now
      const result = await client.acquireLock(lockKey, lockValue2, ttl);
      expect(result).toBe(true);

      const storedValue = await client.get(lockKey);
      expect(storedValue).toBe(lockValue2);
    });
  });

  describe('releaseLock', () => {
    it('should successfully release owned lock', async () => {
      const lockKey = 'test:lock:4';
      const lockValue = 'owner-value';
      const ttl = 30;

      await client.acquireLock(lockKey, lockValue, ttl);

      const released = await client.releaseLock(lockKey, lockValue);
      expect(released).toBe(true);

      // Verify lock is gone
      const exists = await client.exists(lockKey);
      expect(exists).toBe(false);
    });

    it('should fail to release lock with wrong value', async () => {
      const lockKey = 'test:lock:5';
      const lockValue = 'correct-value';
      const wrongValue = 'wrong-value';
      const ttl = 30;

      await client.acquireLock(lockKey, lockValue, ttl);

      const released = await client.releaseLock(lockKey, wrongValue);
      expect(released).toBe(false);

      // Lock should still exist
      const exists = await client.exists(lockKey);
      expect(exists).toBe(true);

      // Original value should remain
      const storedValue = await client.get(lockKey);
      expect(storedValue).toBe(lockValue);
    });

    it('should return false when releasing non-existent lock', async () => {
      const lockKey = 'test:lock:nonexistent';
      const lockValue = 'any-value';

      const released = await client.releaseLock(lockKey, lockValue);
      expect(released).toBe(false);
    });
  });

  describe('extendLock', () => {
    it('should successfully extend owned lock', async () => {
      const lockKey = 'test:lock:6';
      const lockValue = 'owner-value';
      const initialTtl = 2;
      const extendBy = 10;

      await client.acquireLock(lockKey, lockValue, initialTtl);

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Extend the lock
      const extended = await client.extendLock(lockKey, lockValue, extendBy);
      expect(extended).toBe(true);

      // Wait another 2 seconds (would have expired without extend)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Lock should still exist
      const exists = await client.exists(lockKey);
      expect(exists).toBe(true);
    });

    it('should fail to extend lock with wrong value', async () => {
      const lockKey = 'test:lock:7';
      const lockValue = 'correct-value';
      const wrongValue = 'wrong-value';
      const ttl = 30;

      await client.acquireLock(lockKey, lockValue, ttl);

      const extended = await client.extendLock(lockKey, wrongValue, 60);
      expect(extended).toBe(false);
    });

    it('should fail to extend non-existent lock', async () => {
      const lockKey = 'test:lock:nonexistent';
      const lockValue = 'any-value';

      const extended = await client.extendLock(lockKey, lockValue, 60);
      expect(extended).toBe(false);
    });
  });

  describe('acquireLockWithRetry', () => {
    it('should acquire lock immediately if available', async () => {
      const lockKey = 'test:lock:8';
      const lockValue = 'value';
      const ttl = 30;

      const result = await client.acquireLockWithRetry(lockKey, lockValue, ttl, 3, 100);
      expect(result).toBe(true);
    });

    it('should retry and eventually acquire lock', async () => {
      const lockKey = 'test:lock:9';
      const lockValue1 = 'value-1';
      const lockValue2 = 'value-2';
      const shortTtl = 1;

      // Acquire lock with short TTL
      await client.acquireLock(lockKey, lockValue1, shortTtl);

      // Try to acquire with retry - should succeed after TTL expires
      const result = await client.acquireLockWithRetry(lockKey, lockValue2, 30, 5, 300);
      expect(result).toBe(true);
    });

    it('should fail after max retries if lock held', async () => {
      const lockKey = 'test:lock:10';
      const lockValue1 = 'value-1';
      const lockValue2 = 'value-2';
      const longTtl = 60;

      // Acquire lock with long TTL
      await client.acquireLock(lockKey, lockValue1, longTtl);

      // Try to acquire with limited retries - should fail
      const result = await client.acquireLockWithRetry(lockKey, lockValue2, 30, 2, 50);
      expect(result).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute callback with lock and release after', async () => {
      const lockKey = 'test:lock:11';
      const ttl = 30;
      let executed = false;

      await client.withLock(lockKey, ttl, async () => {
        executed = true;
        return 'success';
      });

      expect(executed).toBe(true);

      // Lock should be released
      const exists = await client.exists(lockKey);
      expect(exists).toBe(false);
    });

    it('should release lock even if callback throws', async () => {
      const lockKey = 'test:lock:12';
      const ttl = 30;

      await expect(
        client.withLock(lockKey, ttl, async () => {
          throw new Error('Callback error');
        })
      ).rejects.toThrow('Callback error');

      // Lock should still be released
      const exists = await client.exists(lockKey);
      expect(exists).toBe(false);
    });

    it('should throw if cannot acquire lock', async () => {
      const lockKey = 'test:lock:13';
      const lockValue = 'existing';
      const ttl = 60;

      // Hold the lock
      await client.acquireLock(lockKey, lockValue, ttl);

      // withLock should fail
      await expect(
        client.withLock(lockKey, 30, async () => {
          return 'should not execute';
        })
      ).rejects.toThrow();
    });
  });

  describe('Concurrency - Race Conditions', () => {
    it('should handle concurrent lock acquisitions safely', async () => {
      const lockKey = 'test:lock:concurrent';
      const ttl = 30;
      const concurrentAttempts = 10;
      let successCount = 0;

      // Simulate 10 concurrent attempts to acquire the same lock
      const promises = Array.from({ length: concurrentAttempts }, (_, i) =>
        client.acquireLock(lockKey, `value-${i}`, ttl).then((success) => {
          if (success) successCount++;
          return success;
        })
      );

      await Promise.all(promises);

      // Only ONE should succeed
      expect(successCount).toBe(1);

      // Verify lock exists
      const exists = await client.exists(lockKey);
      expect(exists).toBe(true);
    });
  });
});
