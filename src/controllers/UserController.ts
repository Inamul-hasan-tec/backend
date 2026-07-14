import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { TenantRequest } from '../middleware/tenantMiddleware';
import { isValidEmail } from '../utils/validation';
import AuditRepository from '../repositories/AuditRepository';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get all users for current tenant
   */
  async getAllUsers(req: TenantRequest, res: Response): Promise<void> {
    try {
      const users = await this.userService.getAllUsersByTenant();
      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await this.userService.getUserByIdWithTenant(parseInt(id));
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user',
      });
    }
  }

  /**
   * Create new user
   */
  async createUser(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { name, email, password, role } = req.body;

      // Validation
      if (!name || !email || !password || !role) {
        res.status(400).json({
          success: false,
          message: 'Please provide all required fields: name, email, password, role',
        });
        return;
      }

      if (!isValidEmail(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
        return;
      }

      // Don't allow creating super admin users
      if (role === 'super_admin') {
        res.status(403).json({
          success: false,
          message: 'Cannot create super admin users',
        });
        return;
      }

      const result = await this.userService.register({
        tenant_id: 0, // Ignored by repository as it uses getTenantId()
        name,
        email,
        password,
        role,
      });
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'user.created',
        entityType: 'user',
        entityId: result.user.id,
        newValues: { name, email, role },
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      const message = error instanceof Error ? error.message : 'Failed to create user';
      const statusCode = message.includes('already exists') ? 409 : 400;
      
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }

  /**
   * Update user
   */
  async updateUser(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, email, role } = req.body;

      // Validate user exists and belongs to tenant
      const existingUser = await this.userService.getUserByIdWithTenant(parseInt(id));
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Don't allow changing to super admin
      if (role === 'super_admin') {
        res.status(403).json({
          success: false,
          message: 'Cannot assign super admin role',
        });
        return;
      }

      // Don't allow user to change their own role to prevent privilege escalation
      if (req.user && parseInt(id) === req.user.id && role !== existingUser.role) {
        res.status(403).json({
          success: false,
          message: 'Cannot change your own role',
        });
        return;
      }

      const updatedUser = await this.userService.updateUser(parseInt(id), {
        name,
        email,
        role,
      });
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'user.updated',
        entityType: 'user',
        entityId: parseInt(id),
        oldValues: { name: existingUser.name, email: existingUser.email, role: existingUser.role },
        newValues: { name, email, role },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      const message = error instanceof Error ? error.message : 'Failed to update user';
      
      res.status(400).json({
        success: false,
        message,
      });
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate user exists and belongs to tenant
      const existingUser = await this.userService.getUserByIdWithTenant(parseInt(id));
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Don't allow user to delete themselves
      if (req.user && parseInt(id) === req.user.id) {
        res.status(403).json({
          success: false,
          message: 'Cannot delete your own account',
        });
        return;
      }

      // Don't allow deleting super admin users
      if (existingUser.is_super_admin) {
        res.status(403).json({
          success: false,
          message: 'Cannot delete super admin users',
        });
        return;
      }

      await this.userService.deleteUser(parseInt(id));
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'user.deleted',
        entityType: 'user',
        entityId: parseInt(id),
        oldValues: { name: existingUser.name, email: existingUser.email, role: existingUser.role },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
      });
    }
  }

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active or inactive',
        });
        return;
      }

      // Validate user exists and belongs to tenant
      const existingUser = await this.userService.getUserByIdWithTenant(parseInt(id));
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Don't allow user to deactivate themselves
      if (req.user && parseInt(id) === req.user.id && status === 'inactive') {
        res.status(403).json({
          success: false,
          message: 'Cannot deactivate your own account',
        });
        return;
      }

      // Don't allow deactivating super admin users
      if (existingUser.is_super_admin && status === 'inactive') {
        res.status(403).json({
          success: false,
          message: 'Cannot deactivate super admin users',
        });
        return;
      }

      if (status === 'active') {
        await this.userService.activateUser(parseInt(id));
      } else {
        await this.userService.deactivateUser(parseInt(id));
      }
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'user.status_changed',
        entityType: 'user',
        entityId: parseInt(id),
        oldValues: { status: existingUser.status },
        newValues: { status },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: `User ${status} successfully`,
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user status',
      });
    }
  }

  /**
   * Change user role
   */
  async changeUserRole(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role) {
        res.status(400).json({
          success: false,
          message: 'Role is required',
        });
        return;
      }

      // Don't allow assigning super admin role
      if (role === 'super_admin') {
        res.status(403).json({
          success: false,
          message: 'Cannot assign super admin role',
        });
        return;
      }

      // Validate user exists and belongs to tenant
      const existingUser = await this.userService.getUserByIdWithTenant(parseInt(id));
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Don't allow user to change their own role
      if (req.user && parseInt(id) === req.user.id) {
        res.status(403).json({
          success: false,
          message: 'Cannot change your own role',
        });
        return;
      }

      const updatedUser = await this.userService.updateUser(parseInt(id), { role });
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'user.role_changed',
        entityType: 'user',
        entityId: parseInt(id),
        oldValues: { role: existingUser.role },
        newValues: { role },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: 'User role changed successfully',
        data: updatedUser,
      });
    } catch (error) {
      console.error('Error changing user role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change user role',
      });
    }
  }

}
