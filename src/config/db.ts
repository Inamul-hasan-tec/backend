/**
 * Database Configuration
 * Manages MySQL connection pool
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hall_sync',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0'),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          ca: fs.readFileSync(
            path.resolve(
              process.cwd(),
              process.env.DB_SSL_CA_PATH || 'config/aiven-ca.pem'
            )
          ),
          rejectUnauthorized: true,
        }
      : undefined,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    logger.info('database_connection_check_succeeded', {
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      tls: Boolean(dbConfig.ssl),
    });
    connection.release();
    return true;
  } catch (error) {
    logger.error('database_connection_check_failed', { error });
    return false;
  }
}

/**
 * Execute a query
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (error) {
    logger.error('database_query_failed', { error });
    throw error;
  }
}

/**
 * Get a connection from pool for transactions
 */
export async function getConnection() {
  return await pool.getConnection();
}

/**
 * Close all connections
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('database_pool_closed');
}

export default pool;
