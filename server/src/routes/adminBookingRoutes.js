// ==========================================
// ROUTES: Admin Booking Management
// server/src/routes/adminBookingRoutes.js
// ==========================================

import express from 'express';
import { authenticateAdmin } from '../middleware/adminAuth.js';
// FIXED: Corrected the controller filename
import * as adminBookingController from '../controllers/adminTourBookingController.js';

const router = express.Router();

// All routes in this file are protected by admin auth
router.use(authenticateAdmin);

// === Dashboard Stats ===
// GET    /api/admin/bookings/dashboard/stats
router.get('/dashboard/stats', adminBookingController.getDashboardStats);

// === Bookings Management ===
// GET    /api/admin/bookings
router.get('/', adminBookingController.getAllBookings);

// GET    /api/admin/bookings/:id
router.get('/:id', adminBookingController.getBookingById);

// POST   /api/admin/bookings/:id/cancel
router.post('/:id/cancel', adminBookingController.cancelBooking);

// POST   /api/admin/bookings/:id/refund
router.post('/:id/refund', adminBookingController.refundBooking);

export default router;