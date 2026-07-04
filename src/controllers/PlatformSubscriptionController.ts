import { Request, Response } from 'express';
import SubscriptionRepository from '../repositories/SubscriptionRepository';
import cloudinaryService from '../services/CloudinaryService';
import { SlotService } from '../services/SlotService';

const slotService = new SlotService();

export class PlatformSubscriptionController {
  async listPending(_req: Request, res: Response): Promise<void> {
    try {
      const payments = await SubscriptionRepository.listPendingPayments();
      res.json({ success: true, data: payments });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load payments';
      res.status(500).json({ success: false, error: message });
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      const approval = await SubscriptionRepository.approvePayment(
        Number(req.params.paymentId),
        req.user.id
      );
      const slotGeneration = approval?.tenantId
        ? await slotService.generateSlotsForTenantUntilSubscriptionEnd(approval.tenantId)
        : null;
      res.json({
        success: true,
        message: 'Subscription payment approved',
        data: { slot_generation: slotGeneration },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Approval failed';
      res.status(400).json({ success: false, error: message });
    }
  }

  async reject(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      const reason = String(req.body.reason || '').trim();
      if (!reason) {
        res.status(400).json({ success: false, error: 'Rejection reason is required' });
        return;
      }
      await SubscriptionRepository.rejectPayment(
        Number(req.params.paymentId),
        req.user.id,
        reason
      );
      res.json({ success: true, message: 'Subscription payment rejected' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rejection failed';
      res.status(400).json({ success: false, error: message });
    }
  }

  async getProofUrl(req: Request, res: Response): Promise<void> {
    try {
      const paymentId = Number(req.params.paymentId);
      if (!Number.isFinite(paymentId) || paymentId < 1) {
        res.status(400).json({ success: false, error: 'Invalid payment ID' });
        return;
      }
      const payment = await SubscriptionRepository.getPaymentForPlatform(paymentId);
      if (!payment || !payment.proof_url) {
        res.status(404).json({ success: false, error: 'Proof not found' });
        return;
      }
      const { signedUrl, expiresAt } = cloudinaryService.getSignedProofUrl(payment.proof_url);
      res.json({ success: true, data: { signed_url: signedUrl, expires_at: expiresAt } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate signed URL';
      res.status(500).json({ success: false, error: message });
    }
  }
}

export default new PlatformSubscriptionController();
