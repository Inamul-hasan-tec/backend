import { Request, Response } from 'express';
import InvitationRepository, { InvitationRole } from '../repositories/InvitationRepository';
import { EmailService } from '../services/EmailService';
import TenantRepository from '../repositories/TenantRepository';
import AuditRepository from '../repositories/AuditRepository';

const emailService = new EmailService();

function frontendUrl(): string {
  const configured =
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    String(process.env.CORS_ORIGIN || '').split(',')[0];
  const normalized = configured.trim().replace(/\/$/, '');

  if (!normalized) return 'http://localhost:8080';

  return normalized;
}

function responseForInvitation(invitation: { token: string; email: string; name: string; role: InvitationRole; expiresInHours: number; id: number }) {
  const inviteUrl = `${frontendUrl()}/accept-invite?token=${encodeURIComponent(invitation.token)}`;
  return { id: invitation.id, email: invitation.email, role: invitation.role, expires_in_hours: invitation.expiresInHours, invite_url: inviteUrl };
}

async function sendInvitationEmail(invitation: { email: string; name: string; expiresInHours: number }, inviteUrl: string): Promise<boolean> {
  try {
    return await emailService.sendUserInvitation({
      to: invitation.email,
      name: invitation.name,
      inviteUrl,
      expiresInHours: invitation.expiresInHours,
    });
  } catch {
    // The invitation is already committed. Keep the one-time link available
    // to the administrator when the optional SMTP provider is unavailable.
    return false;
  }
}

export class InvitationController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await InvitationRepository.listForTenant() });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to list invitations' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) return void res.status(401).json({ success: false, error: 'Unauthorized' });
      const { name, email, phone, role } = req.body;
      if (!name || !email || !role) return void res.status(400).json({ success: false, error: 'Name, email, and role are required' });
      const invitation = await InvitationRepository.create({ name, email, phone, role, invitedBy: req.user.id });
      const data = responseForInvitation(invitation);
      const emailSent = await sendInvitationEmail(invitation, data.invite_url);
      res.status(201).json({ success: true, data: { ...data, email_sent: emailSent } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create invitation';
      res.status(message.includes('already exists') ? 409 : 400).json({ success: false, error: message });
    }
  }

  async resend(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) return void res.status(401).json({ success: false, error: 'Unauthorized' });
      const invitation = await InvitationRepository.resend(Number(req.params.id), req.user.id);
      const data = responseForInvitation(invitation);
      const emailSent = await sendInvitationEmail(invitation, data.invite_url);
      res.json({ success: true, data: { ...data, email_sent: emailSent } });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to resend invitation' });
    }
  }

  async listOwnerInvitations(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = Number(req.params.id);
      if (!Number.isInteger(tenantId) || tenantId <= 0) {
        return void res.status(400).json({ success: false, error: 'Invalid tenant ID' });
      }
      if (!await TenantRepository.findById(tenantId)) {
        return void res.status(404).json({ success: false, error: 'Tenant not found' });
      }
      const invitations = await InvitationRepository.listForTenantId(tenantId, 'admin');
      res.json({ success: true, data: invitations });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to list owner invitations' });
    }
  }

  async createOwnerInvitation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) return void res.status(401).json({ success: false, error: 'Unauthorized' });
      const tenantId = Number(req.params.id);
      const { name, email, phone } = req.body;
      if (!Number.isInteger(tenantId) || tenantId <= 0) {
        return void res.status(400).json({ success: false, error: 'Invalid tenant ID' });
      }
      if (!name || !email) {
        return void res.status(400).json({ success: false, error: 'Owner name and email are required' });
      }
      if (!await TenantRepository.findById(tenantId)) {
        return void res.status(404).json({ success: false, error: 'Tenant not found' });
      }
      const invitation = await InvitationRepository.createForTenant(tenantId, {
        name,
        email,
        phone,
        role: 'admin',
        invitedBy: req.user.id,
      });
      const data = responseForInvitation(invitation);
      const emailSent = await sendInvitationEmail(invitation, data.invite_url);
      await AuditRepository.recordPlatform({
        actorUserId: req.user.id,
        action: 'tenant.owner_invited',
        targetType: 'tenant',
        targetId: String(tenantId),
        metadata: { invitation_id: invitation.id, email: invitation.email, email_sent: emailSent },
        requestId: req.requestId,
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: { ...data, email_sent: emailSent } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite tenant owner';
      res.status(message.includes('already exists') ? 409 : 400).json({ success: false, error: message });
    }
  }

  async resendOwnerInvitation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) return void res.status(401).json({ success: false, error: 'Unauthorized' });
      const tenantId = Number(req.params.id);
      const invitationId = Number(req.params.invitationId);
      if (!Number.isInteger(tenantId) || !Number.isInteger(invitationId)) {
        return void res.status(400).json({ success: false, error: 'Invalid tenant or invitation ID' });
      }
      const invitation = await InvitationRepository.resendForTenant(tenantId, invitationId, req.user.id, 'admin');
      const data = responseForInvitation(invitation);
      const emailSent = await sendInvitationEmail(invitation, data.invite_url);
      await AuditRepository.recordPlatform({
        actorUserId: req.user.id,
        action: 'tenant.owner_invitation_resent',
        targetType: 'tenant',
        targetId: String(tenantId),
        metadata: { invitation_id: invitation.id, email: invitation.email, email_sent: emailSent },
        requestId: req.requestId,
        ipAddress: req.ip,
      });
      res.json({ success: true, data: { ...data, email_sent: emailSent } });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to resend owner invitation' });
    }
  }

  async inspect(req: Request, res: Response): Promise<void> {
    const invitation = await InvitationRepository.inspect(String(req.params.token || ''));
    if (!invitation) return void res.status(404).json({ success: false, error: 'Invitation is invalid or expired' });
    res.json({ success: true, data: invitation });
  }

  async accept(req: Request, res: Response): Promise<void> {
    try {
      const { password } = req.body;
      if (!password) return void res.status(400).json({ success: false, error: 'Password is required' });
      const result = await InvitationRepository.accept(String(req.params.token || ''), password);
      res.json({ success: true, data: result, message: 'Invitation accepted. You can now sign in.' });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to accept invitation' });
    }
  }
}

export default new InvitationController();
