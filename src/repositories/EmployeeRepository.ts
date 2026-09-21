import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';
import {
  CreateEmployeeProfileDTO,
  CreateEventStaffAssignmentDTO,
  EmployeeFilters,
  EmployeeProfile,
  EmployeeRosterSummary,
  EventStaffConflict,
  EventStaffAssignment,
  EventStaffStatus,
  UpdateEventStaffAssignmentDTO,
} from '../models/Employee';

export class EmployeeRepository {
  async getEmployees(filters?: EmployeeFilters): Promise<EmployeeProfile[]> {
    const tenantId = getTenantId();
    let sql = `
      SELECT ep.*, h.name AS hall_name
      FROM employee_profiles ep
      LEFT JOIN halls h ON h.id = ep.hall_id AND h.tenant_id = ep.tenant_id
      WHERE ep.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (filters?.status) {
      sql += ' AND ep.status = ?';
      params.push(filters.status);
    }
    if (filters?.person_type) {
      sql += ' AND ep.person_type = ?';
      params.push(filters.person_type);
    }
    if (filters?.hall_id !== undefined && filters.hall_id !== null) {
      sql += ' AND (ep.hall_id IS NULL OR ep.hall_id = ?)';
      params.push(filters.hall_id);
    }
    if (filters?.search) {
      sql += ' AND (ep.name LIKE ? OR ep.primary_role LIKE ? OR ep.skills LIKE ? OR ep.vendor_company LIKE ? OR ep.phone LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY ep.status ASC, ep.person_type ASC, ep.primary_role ASC, ep.name ASC';
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as EmployeeProfile[];
  }

  async getEmployeeById(id: number): Promise<EmployeeProfile | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ep.*, h.name AS hall_name
       FROM employee_profiles ep
       LEFT JOIN halls h ON h.id = ep.hall_id AND h.tenant_id = ep.tenant_id
       WHERE ep.id = ? AND ep.tenant_id = ?`,
      [id, tenantId]
    );
    return (rows[0] as EmployeeProfile) || null;
  }

  async createEmployee(data: CreateEmployeeProfileDTO): Promise<number> {
    const tenantId = getTenantId();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO employee_profiles (
         tenant_id, hall_id, person_type, name, phone, email, primary_role, skills,
         payment_type, rate, vendor_company, status, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        data.hall_id || null,
        data.person_type || 'employee',
        data.name.trim(),
        data.phone || null,
        data.email || null,
        data.primary_role || 'General Staff',
        data.skills || null,
        data.payment_type || 'event',
        data.rate === undefined ? null : data.rate,
        data.vendor_company || null,
        data.status || 'active',
        data.notes || null,
      ]
    );
    return result.insertId;
  }

  async updateEmployee(id: number, data: Partial<CreateEmployeeProfileDTO>): Promise<boolean> {
    const tenantId = getTenantId();
    const existing = await this.getEmployeeById(id);
    if (!existing) return false;

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE employee_profiles
       SET hall_id = ?, person_type = ?, name = ?, phone = ?, email = ?, primary_role = ?,
           skills = ?, payment_type = ?, rate = ?, vendor_company = ?, status = ?, notes = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        data.hall_id === undefined ? existing.hall_id : data.hall_id || null,
        data.person_type || existing.person_type,
        data.name === undefined ? existing.name : data.name.trim(),
        data.phone === undefined ? existing.phone : data.phone || null,
        data.email === undefined ? existing.email : data.email || null,
        data.primary_role || existing.primary_role,
        data.skills === undefined ? existing.skills : data.skills || null,
        data.payment_type || existing.payment_type,
        data.rate === undefined ? existing.rate : data.rate,
        data.vendor_company === undefined ? existing.vendor_company : data.vendor_company || null,
        data.status || existing.status,
        data.notes === undefined ? existing.notes : data.notes || null,
        id,
        tenantId,
      ]
    );
    return result.affectedRows > 0;
  }

  async getAssignments(bookingId?: number): Promise<{ summary: EmployeeRosterSummary; assignments: EventStaffAssignment[] }> {
    const tenantId = getTenantId();
    const params: any[] = [tenantId];
    let where = 'esa.tenant_id = ?';
    if (bookingId) {
      where += ' AND esa.booking_id = ?';
      params.push(bookingId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT esa.*, ep.phone AS employee_phone, ep.person_type AS employee_type
       , b.event_date, b.time_slot, c.name AS customer_name, h.name AS hall_name
       FROM event_staff_assignments esa
       LEFT JOIN employee_profiles ep ON ep.id = esa.employee_id AND ep.tenant_id = esa.tenant_id
       LEFT JOIN bookings b ON b.id = esa.booking_id AND b.tenant_id = esa.tenant_id
       LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
       LEFT JOIN halls h ON h.id = b.hall_id AND h.tenant_id = b.tenant_id
       WHERE ${where}
       ORDER BY b.event_date ASC, esa.booking_id DESC, esa.shift_start ASC, esa.created_at ASC`,
      params
    );
    const assignments = rows as EventStaffAssignment[];
    const summary = assignments.reduce<EmployeeRosterSummary>(
      (acc, assignment) => {
        acc.total += 1;
        if (assignment.status in acc) {
          acc[assignment.status as keyof EmployeeRosterSummary] += 1;
        }
        return acc;
      },
      { total: 0, planned: 0, confirmed: 0, checked_in: 0, completed: 0, no_show: 0 }
    );
    return { summary, assignments };
  }

  async getAssignmentById(id: number): Promise<EventStaffAssignment | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT esa.*, ep.phone AS employee_phone, ep.person_type AS employee_type
       FROM event_staff_assignments esa
       LEFT JOIN employee_profiles ep ON ep.id = esa.employee_id AND ep.tenant_id = esa.tenant_id
       WHERE esa.id = ? AND esa.tenant_id = ?`,
      [id, tenantId]
    );
    return (rows[0] as EventStaffAssignment) || null;
  }

  async createAssignment(data: CreateEventStaffAssignmentDTO): Promise<number> {
    const tenantId = getTenantId();
    const employee = data.employee_id ? await this.getEmployeeById(data.employee_id) : null;
    const displayName = data.display_name?.trim() || employee?.name;
    if (!displayName) throw new Error('Staff or vendor name is required');

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO event_staff_assignments (
         tenant_id, booking_id, employee_id, display_name, role, duty_area,
         shift_start, shift_end, status, payout_amount, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        data.booking_id,
        employee?.id || data.employee_id || null,
        displayName,
        data.role,
        data.duty_area || null,
        data.shift_start || null,
        data.shift_end || null,
        data.status || 'planned',
        data.payout_amount === undefined ? null : data.payout_amount,
        data.notes || null,
      ]
    );
    return result.insertId;
  }

  async updateAssignment(id: number, data: UpdateEventStaffAssignmentDTO): Promise<boolean> {
    const tenantId = getTenantId();
    const existing = await this.getAssignmentById(id);
    if (!existing) return false;

    const employee = data.employee_id ? await this.getEmployeeById(data.employee_id) : null;
    const displayName = data.display_name?.trim() || employee?.name || existing.display_name;

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE event_staff_assignments
       SET employee_id = ?, display_name = ?, role = ?, duty_area = ?, shift_start = ?,
           shift_end = ?, status = ?, payout_amount = ?, notes = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        data.employee_id === undefined ? existing.employee_id : data.employee_id || null,
        displayName,
        data.role === undefined ? existing.role : data.role,
        data.duty_area === undefined ? existing.duty_area : data.duty_area || null,
        data.shift_start === undefined ? existing.shift_start : data.shift_start || null,
        data.shift_end === undefined ? existing.shift_end : data.shift_end || null,
        data.status || existing.status,
        data.payout_amount === undefined ? existing.payout_amount : data.payout_amount,
        data.notes === undefined ? existing.notes : data.notes || null,
        id,
        tenantId,
      ]
    );
    return result.affectedRows > 0;
  }

  async updateAssignmentStatus(id: number, status: EventStaffStatus): Promise<boolean> {
    const tenantId = getTenantId();
    const checkIn = status === 'checked_in' ? ', check_in_at = COALESCE(check_in_at, NOW())' : '';
    const checkOut = status === 'completed' ? ', check_out_at = COALESCE(check_out_at, NOW())' : '';
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE event_staff_assignments
       SET status = ?${checkIn}${checkOut}
       WHERE id = ? AND tenant_id = ?`,
      [status, id, tenantId]
    );
    return result.affectedRows > 0;
  }

  async deleteAssignment(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM event_staff_assignments WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    return result.affectedRows > 0;
  }

  async getAssignmentConflicts(
    employeeId: number,
    bookingId: number,
    excludeAssignmentId?: number
  ): Promise<EventStaffConflict[]> {
    const tenantId = getTenantId();
    let excludeSql = '';
    if (excludeAssignmentId) {
      excludeSql = ' AND esa.id <> ?';
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         esa.id AS assignment_id,
         esa.booking_id,
         esa.display_name,
         esa.role,
         esa.duty_area,
         esa.status,
         esa.shift_start,
         esa.shift_end,
         b.event_date,
         b.time_slot,
         c.name AS customer_name,
         h.name AS hall_name
       FROM bookings target
       JOIN bookings b
         ON b.tenant_id = target.tenant_id
        AND b.event_date = target.event_date
        AND b.status <> 'cancelled'
        AND (
          b.time_slot = target.time_slot
          OR b.time_slot = 'full_day'
          OR target.time_slot = 'full_day'
        )
       JOIN event_staff_assignments esa
         ON esa.booking_id = b.id
        AND esa.tenant_id = b.tenant_id
        AND esa.employee_id = ?
        AND esa.status NOT IN ('completed', 'no_show', 'cancelled')
       LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
       LEFT JOIN halls h ON h.id = b.hall_id AND h.tenant_id = b.tenant_id
       WHERE target.tenant_id = ?
         AND target.id = ?
         AND target.status <> 'cancelled'
         ${excludeSql}
       ORDER BY b.event_date ASC, b.time_slot ASC, esa.shift_start ASC`,
      [employeeId, tenantId, bookingId, ...(excludeAssignmentId ? [excludeAssignmentId] : [])]
    );

    return rows as EventStaffConflict[];
  }
}

export default new EmployeeRepository();
