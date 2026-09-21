import { Request, Response } from 'express';
import EmployeeRepository from '../repositories/EmployeeRepository';
import {
  CreateEmployeeProfileDTO,
  EmployeePaymentType,
  EmployeePersonType,
  EmployeeStatus,
  EventStaffStatus,
} from '../models/Employee';

const personTypes: EmployeePersonType[] = ['employee', 'vendor', 'contractor'];
const employeeStatuses: EmployeeStatus[] = ['active', 'inactive'];
const paymentTypes: EmployeePaymentType[] = ['monthly', 'daily', 'hourly', 'event', 'vendor'];
const staffStatuses: EventStaffStatus[] = [
  'planned',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
  'cancelled',
];

export class EmployeeController {
  async getEmployees(req: Request, res: Response): Promise<void> {
    try {
      const employees = await EmployeeRepository.getEmployees({
        status: req.query.status as EmployeeStatus,
        person_type: req.query.person_type as EmployeePersonType,
        hall_id: req.query.hall_id ? Number(req.query.hall_id) : undefined,
        search: req.query.search as string,
      });

      res.json({ success: true, data: employees, count: employees.length });
    } catch (error) {
      sendError(res, error, 'Failed to fetch employees and vendors');
    }
  }

  async createEmployee(req: Request, res: Response): Promise<void> {
    try {
      const payload = sanitizeEmployeePayload(req.body);
      const id = await EmployeeRepository.createEmployee(payload);
      const employee = await EmployeeRepository.getEmployeeById(id);

      res.status(201).json({
        success: true,
        message: 'Employee/vendor profile created',
        data: employee,
      });
    } catch (error) {
      sendError(res, error, 'Failed to create employee/vendor profile');
    }
  }

  async updateEmployee(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const updated = await EmployeeRepository.updateEmployee(id, sanitizeEmployeePayload(req.body, true));

      if (!updated) {
        res.status(404).json({ success: false, message: 'Employee/vendor profile not found' });
        return;
      }

      const employee = await EmployeeRepository.getEmployeeById(id);
      res.json({
        success: true,
        message: 'Employee/vendor profile updated',
        data: employee,
      });
    } catch (error) {
      sendError(res, error, 'Failed to update employee/vendor profile');
    }
  }

  async getAssignments(req: Request, res: Response): Promise<void> {
    try {
      const result = await EmployeeRepository.getAssignments(
        req.query.booking_id ? Number(req.query.booking_id) : undefined
      );
      res.json({ success: true, data: result });
    } catch (error) {
      sendError(res, error, 'Failed to fetch duty roster');
    }
  }

  async createAssignment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body.booking_id) {
        res.status(400).json({ success: false, message: 'Booking is required' });
        return;
      }
      if (!req.body.role?.trim()) {
        res.status(400).json({ success: false, message: 'Duty role is required' });
        return;
      }
      if (!req.body.employee_id && !req.body.display_name?.trim()) {
        res.status(400).json({ success: false, message: 'Select a staff member or enter an external name' });
        return;
      }

      const id = await EmployeeRepository.createAssignment({
        booking_id: Number(req.body.booking_id),
        employee_id: req.body.employee_id ? Number(req.body.employee_id) : null,
        display_name: req.body.display_name,
        role: req.body.role,
        duty_area: req.body.duty_area,
        shift_start: req.body.shift_start,
        shift_end: req.body.shift_end,
        status: req.body.status,
        payout_amount: req.body.payout_amount === '' ? null : req.body.payout_amount,
        notes: req.body.notes,
      });

      const result = await EmployeeRepository.getAssignments(Number(req.body.booking_id));
      res.status(201).json({
        success: true,
        message: 'Duty assigned',
        data: { assignment_id: id, ...result },
      });
    } catch (error) {
      sendError(res, error, 'Failed to create duty assignment');
    }
  }

  async updateAssignment(req: Request, res: Response): Promise<void> {
    try {
      if (req.body.role !== undefined && !req.body.role?.trim()) {
        res.status(400).json({ success: false, message: 'Duty role is required' });
        return;
      }
      if (
        req.body.employee_id !== undefined &&
        !req.body.employee_id &&
        req.body.display_name !== undefined &&
        !req.body.display_name?.trim()
      ) {
        res.status(400).json({ success: false, message: 'Select a staff member or enter an external name' });
        return;
      }
      if (req.body.status && !staffStatuses.includes(req.body.status)) {
        res.status(400).json({ success: false, message: 'Invalid duty status' });
        return;
      }

      const updated = await EmployeeRepository.updateAssignment(Number(req.params.id), {
        employee_id: req.body.employee_id === '' ? null : req.body.employee_id,
        display_name: req.body.display_name,
        role: req.body.role,
        duty_area: req.body.duty_area,
        shift_start: req.body.shift_start,
        shift_end: req.body.shift_end,
        status: req.body.status,
        payout_amount: req.body.payout_amount === '' ? null : req.body.payout_amount,
        notes: req.body.notes,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'Duty assignment not found' });
        return;
      }

      res.json({ success: true, message: 'Duty assignment updated' });
    } catch (error) {
      sendError(res, error, 'Failed to update duty assignment');
    }
  }

  async updateAssignmentStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = req.body.status as EventStaffStatus;
      if (!staffStatuses.includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid duty status' });
        return;
      }

      const updated = await EmployeeRepository.updateAssignmentStatus(Number(req.params.id), status);
      if (!updated) {
        res.status(404).json({ success: false, message: 'Duty assignment not found' });
        return;
      }

      res.json({ success: true, message: 'Duty status updated' });
    } catch (error) {
      sendError(res, error, 'Failed to update duty status');
    }
  }

  async deleteAssignment(req: Request, res: Response): Promise<void> {
    try {
      const deleted = await EmployeeRepository.deleteAssignment(Number(req.params.id));
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Duty assignment not found' });
        return;
      }

      res.json({ success: true, message: 'Duty assignment removed' });
    } catch (error) {
      sendError(res, error, 'Failed to remove duty assignment');
    }
  }

  async getAssignmentConflicts(req: Request, res: Response): Promise<void> {
    try {
      const employeeId = Number(req.query.employee_id);
      const bookingId = Number(req.query.booking_id);
      const excludeAssignmentId = req.query.exclude_assignment_id
        ? Number(req.query.exclude_assignment_id)
        : undefined;

      if (!employeeId || !bookingId) {
        res.status(400).json({ success: false, message: 'employee_id and booking_id are required' });
        return;
      }

      const conflicts = await EmployeeRepository.getAssignmentConflicts(
        employeeId,
        bookingId,
        excludeAssignmentId
      );

      res.json({ success: true, data: conflicts, count: conflicts.length });
    } catch (error) {
      sendError(res, error, 'Failed to check duty conflicts');
    }
  }
}

function sanitizeEmployeePayload(body: any, partial = false): CreateEmployeeProfileDTO {
  if (!partial && !body.name?.trim()) {
    throw new Error('Name is required');
  }
  if (body.person_type && !personTypes.includes(body.person_type)) {
    throw new Error('Invalid person type');
  }
  if (body.status && !employeeStatuses.includes(body.status)) {
    throw new Error('Invalid employee status');
  }
  if (body.payment_type && !paymentTypes.includes(body.payment_type)) {
    throw new Error('Invalid payment type');
  }

  return {
    hall_id: body.hall_id === '' ? null : body.hall_id,
    person_type: body.person_type,
    name: body.name,
    phone: body.phone,
    email: body.email,
    primary_role: body.primary_role,
    skills: body.skills,
    payment_type: body.payment_type,
    rate: body.rate === '' ? null : body.rate,
    vendor_company: body.vendor_company,
    status: body.status,
    notes: body.notes,
  };
}

function sendError(res: Response, error: unknown, fallbackMessage: string): void {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = message.includes('not found')
    ? 404
    : message.includes('Invalid') || message.includes('required')
      ? 400
      : 500;

  res.status(status).json({ success: false, message });
}

export default new EmployeeController();
