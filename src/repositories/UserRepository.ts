/**
 * User Repository
 * Data access layer for users
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { BaseRepository } from './BaseRepository';
import { User, CreateUserDTO } from '../models/User';
import pool from '../config/db';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   * Used for login and duplicate checking
   */
  async findByEmail(email: string): Promise<User | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE email = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [email]);
    return rows.length > 0 ? (rows[0] as User) : null;
  }

  /**
   * Create a new user
   * Password should already be hashed before calling this
   */
  async create(userData: CreateUserDTO): Promise<number> {
    const sql = `
      INSERT INTO ${this.tableName} 
      (name, email, password, role, status) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute<ResultSetHeader>(sql, [
      userData.name,
      userData.email,
      userData.password,
      userData.role || 'staff',
      userData.status || 'active',
    ]);
    
    return result.insertId;
  }

  /**
   * Get all active users
   */
  async getActive(): Promise<User[]> {
    const sql = `
      SELECT id, name, email, role, status, created_at, updated_at
      FROM ${this.tableName} 
      WHERE status = 'active'
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, []);
    return rows as User[];
  }

  /**
   * Update user status
   */
  async updateStatus(id: number, status: 'active' | 'inactive'): Promise<boolean> {
    const sql = `UPDATE ${this.tableName} SET status = ? WHERE id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [status, id]);
    return result.affectedRows > 0;
  }

  /**
   * Update user password
   * Password should already be hashed before calling this
   */
  async updatePassword(id: number, hashedPassword: string): Promise<boolean> {
    const sql = `UPDATE ${this.tableName} SET password = ? WHERE id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [hashedPassword, id]);
    return result.affectedRows > 0;
  }

  /**
   * Get user by ID (without password)
   */
  async findByIdSafe(id: number): Promise<Omit<User, 'password'> | null> {
    const sql = `
      SELECT id, name, email, role, status, created_at, updated_at
      FROM ${this.tableName} 
      WHERE id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id]);
    return rows.length > 0 ? (rows[0] as Omit<User, 'password'>) : null;
  }
}
