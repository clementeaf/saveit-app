/**
 * Base Repository Class
 * Provides common database operations
 */

import { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { DatabaseClient } from './client';

export abstract class Repository<T extends QueryResultRow> {
  protected db: DatabaseClient;

  constructor() {
    this.db = DatabaseClient.getInstance();
  }

  /**
   * Execute a query
   */
  protected async query<R extends QueryResultRow = T>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<R>> {
    return this.db.query<R>(text, params);
  }

  /**
   * Find one record by ID
   */
  protected async findById(
    table: string,
    id: string,
    client?: PoolClient
  ): Promise<T | null> {
    const query = `SELECT * FROM ${table} WHERE id = $1`;
    const result = client
      ? await client.query<T>(query, [id])
      : await this.db.query<T>(query, [id]);

    return result.rows[0] || null;
  }

  /**
   * Find multiple records
   */
  protected async findMany(
    table: string,
    conditions: Record<string, unknown>,
    client?: PoolClient
  ): Promise<T[]> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);

    if (keys.length === 0) {
      const query = `SELECT * FROM ${table}`;
      const result = client
        ? await client.query<T>(query)
        : await this.db.query<T>(query);
      return result.rows;
    }

    const whereClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(' AND ');
    const query = `SELECT * FROM ${table} WHERE ${whereClause}`;

    const result = client
      ? await client.query<T>(query, values)
      : await this.db.query<T>(query, values);

    return result.rows;
  }

  /**
   * Insert a record
   */
  protected async insert(
    table: string,
    data: Record<string, unknown>,
    client?: PoolClient
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
    const columns = keys.join(', ');

    const query = `
      INSERT INTO ${table} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = client
      ? await client.query<T>(query, values)
      : await this.db.query<T>(query, values);

    return result.rows[0]!;
  }

  /**
   * Update a record by ID
   */
  protected async update(
    table: string,
    id: string,
    data: Record<string, unknown>,
    client?: PoolClient
  ): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      return this.findById(table, id, client);
    }

    const setClause = keys.map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = client
      ? await client.query<T>(query, [id, ...values])
      : await this.db.query<T>(query, [id, ...values]);

    return result.rows[0] || null;
  }

  /**
   * Delete a record by ID
   */
  protected async delete(
    table: string,
    id: string,
    client?: PoolClient
  ): Promise<boolean> {
    const query = `DELETE FROM ${table} WHERE id = $1`;
    const result = client
      ? await client.query(query, [id])
      : await this.db.query(query, [id]);

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count records
   */
  protected async count(
    table: string,
    conditions?: Record<string, unknown>,
    client?: PoolClient
  ): Promise<number> {
    if (!conditions || Object.keys(conditions).length === 0) {
      const query = `SELECT COUNT(*) as count FROM ${table}`;
      const result = client
        ? await client.query<{ count: string }>(query)
        : await this.db.query<{ count: string }>(query);
      return parseInt(result.rows[0]!.count, 10);
    }

    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(' AND ');
    const query = `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`;

    const result = client
      ? await client.query<{ count: string }>(query, values)
      : await this.db.query<{ count: string }>(query, values);

    return parseInt(result.rows[0]!.count, 10);
  }

  /**
   * Execute within a transaction
   */
  public async withTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    return this.db.transaction(callback);
  }

  /**
   * Execute within a serializable transaction
   */
  public async withSerializableTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    return this.db.serializableTransaction(callback);
  }
}
