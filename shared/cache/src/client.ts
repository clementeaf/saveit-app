/**
 * Redis Client
 * Provides caching and distributed locking capabilities
 */

import { createClient, RedisClientType } from 'redis';

import { LockAcquisitionError } from '@saveit/types';

import { getRedisConfig } from './config';

export class RedisClient {
  private client: RedisClientType;
  private static instance: RedisClient;
  private isConnected = false;

  private constructor() {
    const config = getRedisConfig();
    this.client = createClient({
      url: config.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Event handlers
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client: Connecting...');
    });

    this.client.on('ready', () => {
      console.log('Redis Client: Ready');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis Client: Reconnecting...');
    });

    this.client.on('end', () => {
      console.log('Redis Client: Connection closed');
      this.isConnected = false;
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }

  /**
   * Get a value by key
   */
  public async get<T = string>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Set a value with optional TTL (in seconds)
   */
  public async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await this.client.setEx(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Delete multiple keys matching a pattern
   */
  public async delPattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return 0;
    return await this.client.del(keys);
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set TTL on a key (in seconds)
   */
  public async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  /**
   * Increment a value
   */
  public async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  /**
   * Decrement a value
   */
  public async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }

  /**
   * Acquire a distributed lock using SETNX
   * Returns true if lock was acquired, false otherwise
   */
  public async acquireLock(
    lockKey: string,
    lockValue: string,
    ttl: number
  ): Promise<boolean> {
    try {
      // SETNX with TTL (atomic operation)
      const result = await this.client.set(lockKey, lockValue, {
        NX: true, // Only set if key doesn't exist
        EX: ttl, // Expire after ttl seconds
      });

      return result === 'OK';
    } catch (error) {
      console.error('Failed to acquire lock:', { lockKey, error });
      throw new LockAcquisitionError(lockKey);
    }
  }

  /**
   * Release a distributed lock
   * Uses Lua script to ensure atomic check-and-delete
   */
  public async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    // Lua script to check value and delete atomically
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.client.eval(script, {
        keys: [lockKey],
        arguments: [lockValue],
      });

      return result === 1;
    } catch (error) {
      console.error('Failed to release lock:', { lockKey, error });
      return false;
    }
  }

  /**
   * Extend a distributed lock TTL
   * CRITICAL: Only extends if lockValue matches (owner verification)
   * Uses Lua script to ensure atomic check-and-extend
   */
  public async extendLock(
    lockKey: string,
    lockValue: string,
    additionalSeconds: number
  ): Promise<boolean> {
    // Lua script to verify ownership and extend TTL atomically
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await this.client.eval(script, {
        keys: [lockKey],
        arguments: [lockValue, additionalSeconds.toString()],
      });

      return result === 1;
    } catch (error) {
      console.error('Failed to extend lock:', { lockKey, error });
      return false;
    }
  }

  /**
   * Acquire lock with retry logic
   */
  public async acquireLockWithRetry(
    lockKey: string,
    lockValue: string,
    ttl: number,
    maxRetries: number = 3,
    retryDelay: number = 100
  ): Promise<boolean> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const acquired = await this.acquireLock(lockKey, lockValue, ttl);

      if (acquired) {
        return true;
      }

      // Wait before retry
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    return false;
  }

  /**
   * Execute a function with distributed lock
   */
  public async withLock<T>(
    lockKey: string,
    ttl: number,
    callback: () => Promise<T>
  ): Promise<T> {
    const lockValue = `${Date.now()}-${Math.random()}`;
    const acquired = await this.acquireLockWithRetry(lockKey, lockValue, ttl);

    if (!acquired) {
      throw new LockAcquisitionError(lockKey);
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Get multiple keys
   */
  public async mget<T = string>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    const values = await this.client.mGet(keys);
    return values.map((value) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    });
  }

  /**
   * Set multiple keys
   */
  public async mset(keyValues: Record<string, unknown>): Promise<void> {
    const pairs: [string, string][] = Object.entries(keyValues).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]);

    await this.client.mSet(pairs);
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.client.ping();
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      console.error('Redis health check failed:', error);
      return { healthy: false, latency: Date.now() - start };
    }
  }

  /**
   * Get Redis info
   */
  public async getInfo(): Promise<string> {
    return await this.client.info();
  }

  /**
   * Flush all data (use with caution!)
   */
  public async flushAll(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      await this.client.flushAll();
    } else {
      throw new Error('flushAll is not allowed in production');
    }
  }
}

// Export singleton instance
export const cache = RedisClient.getInstance();
