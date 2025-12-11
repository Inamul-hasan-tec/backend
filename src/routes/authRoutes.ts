import { Router } from 'express';
import * as authController from '../controllers/authController';
import { auth } from '../middleware/auth';

const router = Router();

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', authController.register);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authController.login);

// @route   GET /api/auth/user
// @desc    Get current user data
// @access  Private
router.get('/user', auth, authController.getCurrentUser);

export default router;
