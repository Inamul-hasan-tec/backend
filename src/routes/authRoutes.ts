import { Router } from 'express';
import * as authController from '../controllers/authController';
import { auth } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/loginRateLimiter';
import InvitationController from '../controllers/InvitationController';

const router = Router();

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', loginRateLimiter, authController.login);
router.get('/invitations/:token', InvitationController.inspect.bind(InvitationController));
router.post('/invitations/:token/accept', loginRateLimiter, InvitationController.accept.bind(InvitationController));

// @route   GET /api/auth/user
// @desc    Get current user data
// @access  Private
router.get('/user', auth, authController.getCurrentUser);

// @route   POST /api/auth/logout
// @desc    Revoke every access token for the authenticated user
// @access  Private
router.post('/logout', auth, authController.logout);

export default router;
