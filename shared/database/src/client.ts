/**
 * Database Client
 * Manages PostgreSQL connection pool and provides query interface
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { DatabaseError } from '@saveit/types';

import { getDatabaseConfig } from './config';

export class DatabaseClient {
  private pool: Pool;
  private static instance: DatabaseClient;

  private constructor() {
    const config = getDatabaseConfig();
    this.pool = new Pool(config);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    // Log pool events in development
    if (process.env.NODE_ENV === 'development') {
      this.pool.on('connect', () => {
        console.log('New database client connected to pool');
      });

      this.pool.on('remove', () => {
        console.log('Database client removed from pool');
      });
    }
  }

  /**
   * Get singleton instance of DatabaseClient
   */
  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  /**
   * Execute a query
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === 'development') {
        console.log('Executed query:', { text, duration, rows: result.rowCount });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error('Database query error:', { text, duration, error });
      throw new DatabaseError('Query execution failed', {
        query: text,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      console.error('Failed to get database client from pool:', error);
      throw new DatabaseError('Failed to acquire database connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute queries within a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction failed and rolled back:', error);
      throw new DatabaseError('Transaction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * Execute queries within a SERIALIZABLE transaction
   * Use this for critical operations that require strict isolation
   */
  public async serializableTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Serializable transaction failed and rolled back:', error);
      throw new DatabaseError('Serializable transaction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.query('SELECT 1');
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { healthy: false, latency: Date.now() - start };
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections in the pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
    console.log('Database pool closed');
  }
}

// Export singleton instance
export const db = DatabaseClient.getInstance();
