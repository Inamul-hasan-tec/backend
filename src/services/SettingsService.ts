import { SettingsRepository } from '../repositories/SettingsRepository';
import { CloudinaryService } from './CloudinaryService';
import SubscriptionRepository from '../repositories/SubscriptionRepository';
import bcrypt from 'bcryptjs';
import { getTenantId } from '../utils/tenantContext';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface UpdateProfileData {
  name?: string;
  email?: string;
  phone?: string;
}

interface UpdateBusinessProfileData {
  business_name?: string | null;
  subdomain?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  gst_number?: string | null;
  upi_id?: string | null;
  upi_name?: string | null;
  description?: string | null;
  business_hours?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

const allowedLogoMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

const logoExtensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

interface AddTeamMemberData {
  name: string;
  email: string;
  phone?: string;
  role: string;
  password: string;
}

interface SubmitPaymentData {
  transaction_id: string;
  user_id: number;
  payment_proof: Express.Multer.File;
}

export class SettingsService {
  private settingsRepository: SettingsRepository;
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.settingsRepository = new SettingsRepository();
    this.cloudinaryService = new CloudinaryService();
  }

  // ============================================
  // Personal Settings
  // ============================================
  async getUserProfile(userId: number) {
    return await this.settingsRepository.getUserById(userId);
  }

  async updateUserProfile(userId: number, data: UpdateProfileData) {
    return await this.settingsRepository.updateUser(userId, data);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    // Get user with password
    const user = await this.settingsRepository.getUserWithPassword(userId);
    
    if (!user || !user.password) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.settingsRepository.updateUserPassword(userId, hashedPassword);
  }

  // ============================================
  // Business Profile
  // ============================================
  async getBusinessProfile() {
    const tenantId = getTenantId();
    return await this.settingsRepository.getBusinessProfile(tenantId);
  }

  async updateBusinessProfile(data: UpdateBusinessProfileData) {
    const tenantId = getTenantId();
    const existing = await this.settingsRepository.getBusinessProfile(tenantId);
    if (!existing) {
      return await this.settingsRepository.createBusinessProfile(tenantId, data);
    }
    return await this.settingsRepository.updateBusinessProfile(tenantId, data);
  }

  async uploadBusinessLogo(file: Express.Multer.File) {
    const tenantId = getTenantId();

    if (!allowedLogoMimeTypes.has(file.mimetype)) {
      throw new Error('Unsupported logo format. Please upload JPG, PNG, WebP, or SVG.');
    }

    let logoUrl: string;
    if (this.cloudinaryService.isConfigured()) {
      const folder = this.cloudinaryService.getTenantFolder('logos');
      logoUrl = await this.cloudinaryService.uploadFromBuffer(file, folder);
    } else {
      logoUrl = await this.saveBusinessLogoLocally(tenantId, file);
    }
    
    // Update business profile with logo URL
    await this.settingsRepository.updateBusinessProfile(tenantId, { logo_url: logoUrl });
    
    return logoUrl;
  }

  private async saveBusinessLogoLocally(
    tenantId: number,
    file: Express.Multer.File
  ): Promise<string> {
    const uploadRoot = process.env.LOCAL_UPLOAD_ROOT || path.join(process.cwd(), 'uploads');
    const relativeFolder = path.join('business-logos', `tenant-${tenantId}`);
    const absoluteFolder = path.join(uploadRoot, relativeFolder);
    await fs.mkdir(absoluteFolder, { recursive: true });

    const extension = logoExtensionByMimeType[file.mimetype] || 'bin';
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    const absolutePath = path.join(absoluteFolder, fileName);
    await fs.writeFile(absolutePath, file.buffer);

    const publicBaseUrl = (process.env.PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').replace(/\/$/, '');
    const relativeUrl = `/uploads/${relativeFolder.split(path.sep).join('/')}/${fileName}`;

    logger.info('business_logo_stored_locally', {
      tenant_id: tenantId,
      storage: 'local',
      mime_type: file.mimetype,
    });

    return publicBaseUrl ? `${publicBaseUrl}${relativeUrl}` : relativeUrl;
  }

  // ============================================
  // Team Management
  // ============================================
  async getTeamMembers() {
    const tenantId = getTenantId();
    return await this.settingsRepository.getTeamMembers(tenantId);
  }

  async addTeamMember(data: AddTeamMemberData) {
    const tenantId = getTenantId();
    // Check if email already exists
    const existingUser = await this.settingsRepository.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    return await this.settingsRepository.createUser({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      password: hashedPassword,
      is_active: true
    });
  }

  async updateTeamMember(memberId: number, data: any) {
    const tenantId = getTenantId();
    // Verify member belongs to tenant
    const member = await this.settingsRepository.getUserById(memberId);
    if (!member || member.tenant_id !== tenantId) {
      throw new Error('Team member not found');
    }

    return await this.settingsRepository.updateUser(memberId, data);
  }

  async deleteTeamMember(memberId: number) {
    const tenantId = getTenantId();
    // Verify member belongs to tenant
    const member = await this.settingsRepository.getUserById(memberId);
    if (!member || member.tenant_id !== tenantId) {
      throw new Error('Team member not found');
    }

    await this.settingsRepository.deleteUser(memberId);
  }

  // ============================================
  // Billing & Subscription
  // ============================================
  async getSubscription() {
    const tenantId = getTenantId();
    const subscription = await SubscriptionRepository.ensureTrialSubscription(tenantId);

    const now = new Date();
    const periodEnd = new Date(subscription?.current_period_end || now);
    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...subscription,
      plan: subscription.plan_name || subscription.plan,
      billingCycle: subscription.billing_cycle,
      nextBillingDate: subscription.current_period_end,
      daysRemaining,
    };
  }

  async getPaymentHistory(limit: number, offset: number) {
    const tenantId = getTenantId();
    const payments = await SubscriptionRepository.listTenantPayments(
      tenantId,
      limit,
      offset
    );
    const total = await SubscriptionRepository.countTenantPayments(tenantId);

    return {
      payments,
      total,
      limit,
      offset
    };
  }

  async generateUPIQR(userId: number) {
    const tenantId = getTenantId();
    let order = await SubscriptionRepository.getLatestOpenOrder(tenantId);
    if (!order) {
      const subscription = await SubscriptionRepository.ensureTrialSubscription(tenantId);
      order = await SubscriptionRepository.createRenewalOrder(
        tenantId,
        userId,
        subscription.plan,
        ['annual', 'yearly'].includes(subscription.billing_cycle)
          ? 'annual'
          : 'monthly'
      );
    }
    const amount = Number(order.amount);
    const upiId = String(process.env.UPI_ID || '').trim();
    if (!upiId) {
      throw new Error('UPI_ID is not configured for subscription payments');
    }
    const merchantName = 'HallSync';
    const upiString =
      `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}` +
      `&tn=${encodeURIComponent(order.order_number)}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
    
    return {
      upi_id: upiId,
      upiId,
      amount,
      qr_code_url: qrCodeUrl,
      qrCodeUrl,
      upi_link: upiString
    };
  }

  async submitPayment(data: SubmitPaymentData) {
    const tenantId = getTenantId();
    let order = await SubscriptionRepository.getLatestOpenOrder(tenantId);
    if (order?.status === 'payment_submitted') {
      throw new Error('A subscription payment is already awaiting verification');
    }
    if (!order) {
      const subscription = await SubscriptionRepository.ensureTrialSubscription(tenantId);
      order = await SubscriptionRepository.createRenewalOrder(
        tenantId,
        data.user_id,
        subscription.plan,
        ['annual', 'yearly'].includes(subscription.billing_cycle)
          ? 'annual'
          : 'monthly'
      );
    }

    const folder = this.cloudinaryService.getTenantFolder('payment-proofs');
    const { publicId: proofPublicId } = await this.cloudinaryService.uploadProof(
      data.payment_proof,
      folder
    );

    const payment = await SubscriptionRepository.submitPayment(
      order.id,
      tenantId,
      data.user_id,
      'upi',
      data.transaction_id,
      proofPublicId
    );

    logger.info('subscription.proof_submitted', { tenant_id: tenantId, order_id: order.id });

    return {
      payment_id: payment.id,
      order_number: payment.order_number,
      status: 'pending',
      estimated_verification_time: '24 hours'
    };
  }

  // ============================================
  // Notification Preferences
  // ============================================
  async getNotificationPreferences(userId: number) {
    const tenantId = getTenantId();
    let preferences = await this.settingsRepository.getNotificationPreferences(userId, tenantId);
    
    // If no preferences exist, create defaults
    if (!preferences || preferences.length === 0) {
      await this.createDefaultNotificationPreferences(userId);
      preferences = await this.settingsRepository.getNotificationPreferences(userId, tenantId);
    }

    return this.formatNotificationPreferences(preferences || []);
  }

  private formatNotificationPreferences(preferences: any[]) {
    // Format preferences into structured object
    const formatted: any = {
      email: {
        booking_created: true,
        booking_updated: true,
        booking_cancelled: true,
        payment_received: true,
        payment_reminder: true,
        daily_summary: true,
      },
      sms: {
        booking_created: true,
        booking_updated: true,
        booking_cancelled: true,
        payment_received: true,
        payment_reminder: true,
      },
      whatsapp: {
        booking_created: true,
        booking_updated: true,
        booking_cancelled: true,
        payment_received: true,
        payment_reminder: true,
      }
    };

    preferences.forEach((pref: any) => {
      if (formatted[pref.channel] && pref.event_type in formatted[pref.channel]) {
        formatted[pref.channel][pref.event_type] = pref.enabled;
      }
    });

    return formatted;
  }

  async updateNotificationPreferences(userId: number, preferences: any) {
    const tenantId = getTenantId();
    const updates: any[] = [];

    // Flatten preferences object
    for (const channel of ['email', 'sms', 'whatsapp']) {
      if (preferences[channel]) {
        for (const [eventType, enabled] of Object.entries(preferences[channel])) {
          updates.push({
            user_id: userId,
            tenant_id: tenantId,
            channel,
            event_type: eventType,
            enabled: enabled as boolean
          });
        }
      }
    }

    // Update or insert preferences
    for (const update of updates) {
      await this.settingsRepository.upsertNotificationPreference(update);
    }
  }

  private async createDefaultNotificationPreferences(userId: number) {
    const tenantId = getTenantId();
    const channels = ['email', 'sms', 'whatsapp'];
    const events = [
      'booking_created',
      'booking_updated',
      'booking_cancelled',
      'payment_received',
      'payment_reminder',
      'daily_summary'
    ];

    for (const channel of channels) {
      for (const event of events) {
        // Skip daily_summary for sms and whatsapp
        if (event === 'daily_summary' && channel !== 'email') continue;

        await this.settingsRepository.createNotificationPreference({
          user_id: userId,
          tenant_id: tenantId,
          channel,
          event_type: event,
          enabled: true
        });
      }
    }
  }
}
