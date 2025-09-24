// D1 Database utility functions for Cloudflare Workers

import { Env, QueryOptions, APIError } from './types';

/**
 * Database utility class for D1 operations
 */
export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Execute a prepared statement with parameters
   */
  async execute<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<D1Result<T>> {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        return await stmt.bind(...params).all();
      }
      return await stmt.all();
    } catch (error) {
      console.error('Database execute error:', error);
      throw new APIError(500, 'Database operation failed');
    }
  }

  /**
   * Execute a single row query
   */
  async findOne<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T | null> {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        return await stmt.bind(...params).first();
      }
      return await stmt.first();
    } catch (error) {
      console.error('Database findOne error:', error);
      throw new APIError(500, 'Database operation failed');
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T = any>(
    queries: Array<{ sql: string; params?: any[] }>
  ): Promise<D1Result<T>[]> {
    try {
      const statements = queries.map(({ sql, params = [] }) => {
        const stmt = this.db.prepare(sql);
        return params.length > 0 ? stmt.bind(...params) : stmt;
      });

      return await this.db.batch(statements);
    } catch (error) {
      console.error('Database transaction error:', error);
      throw new APIError(500, 'Transaction failed');
    }
  }

  /**
   * Insert a record and return the inserted ID
   */
  async insert(
    table: string,
    data: Record<string, any>
  ): Promise<number> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    try {
      const result = await this.db
        .prepare(sql)
        .bind(...values)
        .run();

      return result.meta.last_row_id as number;
    } catch (error) {
      console.error('Database insert error:', error);
      throw new APIError(500, 'Insert operation failed');
    }
  }

  /**
   * Update records in a table
   */
  async update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>
  ): Promise<number> {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');

    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const sql = `UPDATE ${table} SET ${setClause}, updated_at = datetime('now') WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];

    try {
      const result = await this.db
        .prepare(sql)
        .bind(...params)
        .run();

      return result.meta.changes;
    } catch (error) {
      console.error('Database update error:', error);
      throw new APIError(500, 'Update operation failed');
    }
  }

  /**
   * Delete records from a table
   */
  async delete(
    table: string,
    where: Record<string, any>
  ): Promise<number> {
    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    const params = Object.values(where);

    try {
      const result = await this.db
        .prepare(sql)
        .bind(...params)
        .run();

      return result.meta.changes;
    } catch (error) {
      console.error('Database delete error:', error);
      throw new APIError(500, 'Delete operation failed');
    }
  }

  /**
   * Build and execute a SELECT query with options
   */
  async find<T = any>(
    table: string,
    options: QueryOptions = {}
  ): Promise<T[]> {
    let sql = `SELECT * FROM ${table}`;
    const params: any[] = [];

    // Add WHERE clause
    if (options.where && Object.keys(options.where).length > 0) {
      const whereConditions = Object.keys(options.where)
        .map(key => {
          params.push(options.where![key]);
          return `${key} = ?`;
        })
        .join(' AND ');
      sql += ` WHERE ${whereConditions}`;
    }

    // Add ORDER BY clause
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy.column} ${options.orderBy.direction.toUpperCase()}`;
    }

    // Add LIMIT and OFFSET
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    try {
      const result = await this.execute<T>(sql, params);
      return result.results as T[];
    } catch (error) {
      console.error('Database find error:', error);
      throw new APIError(500, 'Query operation failed');
    }
  }

  /**
   * Count records in a table
   */
  async count(
    table: string,
    where?: Record<string, any>
  ): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const whereConditions = Object.keys(where)
        .map(key => {
          params.push(where[key]);
          return `${key} = ?`;
        })
        .join(' AND ');
      sql += ` WHERE ${whereConditions}`;
    }

    const result = await this.findOne<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  /**
   * Check if a record exists
   */
  async exists(
    table: string,
    where: Record<string, any>
  ): Promise<boolean> {
    const count = await this.count(table, where);
    return count > 0;
  }

  /**
   * Paginate query results
   */
  async paginate<T = any>(
    table: string,
    page: number = 1,
    pageSize: number = 20,
    options: QueryOptions = {}
  ) {
    const offset = (page - 1) * pageSize;
    const items = await this.find<T>(table, {
      ...options,
      limit: pageSize,
      offset,
    });

    const total = await this.count(table, options.where);
    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
}

/**
 * Create a database instance from environment
 */
export function createDatabase(env: Env): Database {
  return new Database(env.DB);
}

/**
 * Database migration runner
 */
export class Migration {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Check if a migration has been applied
   */
  async isApplied(version: string): Promise<boolean> {
    const result = await this.db.findOne(
      'SELECT * FROM migration_history WHERE version = ?',
      [version]
    );
    return result !== null;
  }

  /**
   * Apply a migration
   */
  async apply(
    version: string,
    description: string,
    sql: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Execute migration SQL
      await this.db.execute(sql);

      // Record migration
      await this.db.insert('migration_history', {
        version,
        description,
        execution_time_ms: Date.now() - startTime,
      });

      console.log(`Migration ${version} applied successfully`);
    } catch (error) {
      console.error(`Migration ${version} failed:`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runPending(migrations: Array<{
    version: string;
    description: string;
    sql: string;
  }>): Promise<void> {
    for (const migration of migrations) {
      const isApplied = await this.isApplied(migration.version);
      if (!isApplied) {
        await this.apply(
          migration.version,
          migration.description,
          migration.sql
        );
      }
    }
  }
}

/**
 * Database connection health check
 */
export async function checkDatabaseHealth(db: Database): Promise<boolean> {
  try {
    const result = await db.findOne('SELECT 1 as health');
    return result !== null;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Utility to safely parse JSON from database
 */
export function parseJsonField<T = any>(
  value: string | null | undefined,
  defaultValue: T
): T {
  if (!value) return defaultValue;

  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Utility to stringify JSON for database storage
 */
export function stringifyJsonField(value: any): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Build a WHERE clause from conditions
 */
export function buildWhereClause(
  conditions: Record<string, any>
): { clause: string; params: any[] } {
  const params: any[] = [];
  const clauses: string[] = [];

  for (const [key, value] of Object.entries(conditions)) {
    if (value === null) {
      clauses.push(`${key} IS NULL`);
    } else if (value === undefined) {
      // Skip undefined values
      continue;
    } else if (Array.isArray(value)) {
      // Handle IN clause
      const placeholders = value.map(() => '?').join(', ');
      clauses.push(`${key} IN (${placeholders})`);
      params.push(...value);
    } else if (typeof value === 'object' && value !== null) {
      // Handle special operators
      if ('$gt' in value) {
        clauses.push(`${key} > ?`);
        params.push(value.$gt);
      }
      if ('$gte' in value) {
        clauses.push(`${key} >= ?`);
        params.push(value.$gte);
      }
      if ('$lt' in value) {
        clauses.push(`${key} < ?`);
        params.push(value.$lt);
      }
      if ('$lte' in value) {
        clauses.push(`${key} <= ?`);
        params.push(value.$lte);
      }
      if ('$ne' in value) {
        clauses.push(`${key} != ?`);
        params.push(value.$ne);
      }
      if ('$like' in value) {
        clauses.push(`${key} LIKE ?`);
        params.push(value.$like);
      }
    } else {
      clauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  return {
    clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}