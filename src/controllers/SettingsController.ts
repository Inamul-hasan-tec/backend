import { Request, Response } from 'express';
import { SettingsService } from '../services/SettingsService';
import AuditRepository from '../repositories/AuditRepository';
import { getTenantId } from '../utils/tenantContext';

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  // ============================================
  // Personal Settings
  // ============================================
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const profile = await this.settingsService.getUserProfile(userId);
      res.json({ success: true, data: profile });
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, email, phone } = req.body;
      const updatedProfile = await this.settingsService.updateUserProfile(userId, {
        name,
        email,
        phone
      });
      await AuditRepository.recordTenant({
        actorUserId: userId,
        action: 'profile.updated',
        entityType: 'user',
        entityId: userId,
        newValues: { name, email, phone },
        ipAddress: req.ip,
      });

      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        data: updatedProfile 
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        res.status(400).json({ 
          success: false, 
          error: 'Current password and new password are required' 
        });
        return;
      }

      await this.settingsService.changePassword(userId, current_password, new_password);
      await AuditRepository.recordTenant({
        actorUserId: userId,
        action: 'password.changed',
        entityType: 'user',
        entityId: userId,
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      console.error('Change password error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ============================================
  // Business Profile
  // ============================================
  async getBusinessProfile(req: Request, res: Response): Promise<void> {
    try {
      const profile = await this.settingsService.getBusinessProfile();
      res.json({ success: true, data: profile });
    } catch (error: any) {
      console.error('Get business profile error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateBusinessProfile(req: Request, res: Response): Promise<void> {
    try {
      const updatedProfile = await this.settingsService.updateBusinessProfile(req.body);
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'business_profile.updated',
        entityType: 'business_profile',
        entityId: getTenantId(),
        newValues: req.body,
        ipAddress: req.ip,
      });

      res.json({ 
        success: true, 
        message: 'Business profile updated successfully',
        data: updatedProfile 
      });
    } catch (error: any) {
      console.error('Update business profile error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async uploadBusinessLogo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const logoUrl = await this.settingsService.uploadBusinessLogo(req.file);
      res.json({ 
        success: true, 
        message: 'Logo uploaded successfully',
        data: { logo_url: logoUrl } 
      });
    } catch (error: any) {
      console.error('Upload logo error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ============================================
  // Team Management
  // ============================================
  async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      const members = await this.settingsService.getTeamMembers();
      res.json({ success: true, data: members });
    } catch (error: any) {
      console.error('Get team members error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async addTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phone, role, password } = req.body;

      if (!name || !email || !role || !password) {
        res.status(400).json({ 
          success: false, 
          error: 'Name, email, role, and password are required' 
        });
        return;
      }

      const newMember = await this.settingsService.addTeamMember({
        name,
        email,
        phone,
        role,
        password
      });
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'team_member.created',
        entityType: 'user',
        entityId: newMember.id,
        newValues: { name, email, phone, role },
        ipAddress: req.ip,
      });

      res.json({ 
        success: true, 
        message: 'Team member added successfully',
        data: newMember 
      });
    } catch (error: any) {
      console.error('Add team member error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const memberId = parseInt(req.params.id);

      const updatedMember = await this.settingsService.updateTeamMember(
        memberId,
        req.body
      );
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'team_member.updated',
        entityType: 'user',
        entityId: memberId,
        newValues: req.body,
        ipAddress: req.ip,
      });

      res.json({ 
        success: true, 
        message: 'Team member updated successfully',
        data: updatedMember 
      });
    } catch (error: any) {
      console.error('Update team member error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const memberId = parseInt(req.params.id);
      const currentUserId = req.user?.id;

      if (memberId === currentUserId) {
        res.status(400).json({ 
          success: false, 
          error: 'Cannot delete your own account' 
        });
        return;
      }

      await this.settingsService.deleteTeamMember(memberId);
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'team_member.deleted',
        entityType: 'user',
        entityId: memberId,
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Team member removed successfully' });
    } catch (error: any) {
      console.error('Delete team member error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ============================================
  // Billing & Subscription
  // ============================================
  async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const subscription = await this.settingsService.getSubscription();
      res.json({ success: true, data: subscription });
    } catch (error: any) {
      console.error('Get subscription error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getPaymentHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await this.settingsService.getPaymentHistory(limit, offset);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Get payment history error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async generateUPIQR(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      const qrData = await this.settingsService.generateUPIQR(userId);
      res.json({ success: true, data: qrData });
    } catch (error: any) {
      console.error('Generate UPI QR error:', error);
      const status = String(error.message).includes('UPI_ID is not configured') ? 503 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  }

  async submitPayment(req: Request, res: Response): Promise<void> {
    try {
      const { transaction_id } = req.body;
      const userId = req.user?.id;

      if (!userId || !transaction_id || !req.file) {
        res.status(400).json({ 
          success: false, 
          error: 'Transaction ID and payment proof are required' 
        });
        return;
      }

      const payment = await this.settingsService.submitPayment({
        transaction_id,
        user_id: userId,
        payment_proof: req.file
      });

      res.json({ 
        success: true, 
        message: 'Payment submitted for verification',
        data: payment 
      });
    } catch (error: any) {
      console.error('Submit payment error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ============================================
  // Notification Preferences
  // ============================================
  async getNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const preferences = await this.settingsService.getNotificationPreferences(userId);
      res.json({ success: true, data: preferences });
    } catch (error: any) {
      console.error('Get notification preferences error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await this.settingsService.updateNotificationPreferences(
        userId,
        req.body
      );
      await AuditRepository.recordTenant({
        actorUserId: userId,
        action: 'notification_preferences.updated',
        entityType: 'user',
        entityId: userId,
        newValues: req.body,
        ipAddress: req.ip,
      });

      res.json({ 
        success: true, 
        message: 'Notification preferences updated successfully' 
      });
    } catch (error: any) {
      console.error('Update notification preferences error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
