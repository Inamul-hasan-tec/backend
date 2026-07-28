import { Request, Response } from 'express';
import NotificationRepository from '../repositories/NotificationRepository';

export const listNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const onlyUnread = String(req.query.unread || '').toLowerCase() === 'true';
    const [notifications, unreadCount] = await Promise.all([
      NotificationRepository.listForCurrentUser(limit, onlyUnread),
      NotificationRepository.unreadCountForCurrentUser(),
    ]);

    res.json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        unread_count: unreadCount,
      },
    });
  } catch (error) {
    console.error('Error in listNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getUnreadCount = async (_req: Request, res: Response): Promise<void> => {
  try {
    const unreadCount = await NotificationRepository.unreadCountForCurrentUser();
    res.json({
      success: true,
      data: {
        unread_count: unreadCount,
      },
    });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve unread notification count',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    if (!Number.isFinite(notificationId)) {
      res.status(400).json({ success: false, message: 'Invalid notification id' });
      return;
    }

    const updated = await NotificationRepository.markReadForCurrentUser(notificationId);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error in markNotificationRead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const markAllNotificationsRead = async (_req: Request, res: Response): Promise<void> => {
  try {
    const updated = await NotificationRepository.markAllReadForCurrentUser();
    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { updated },
    });
  } catch (error) {
    console.error('Error in markAllNotificationsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
