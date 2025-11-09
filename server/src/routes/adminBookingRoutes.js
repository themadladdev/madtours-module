// ==========================================
// server/src/routes/adminBookingRoutes.js
// ==========================================

import express from 'express';
import { authenticateAdmin } from '../middleware/adminAuth.js';
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

// POST   /api/admin/bookings/manual
router.post('/manual', adminBookingController.createManualBooking);

// POST   /api/admin/bookings/foc
router.post('/foc', adminBookingController.createFocBooking);

// POST   /api/admin/bookings/:id/cancel
router.post('/:id/cancel', adminBookingController.cancelBooking);

// POST   /api/admin/bookings/:id/refund
// This is the Triage "Process Stripe Refund" action
router.post('/:id/refund', adminBookingController.refundBooking);

// --- [NEW] Triage Resolver Routes ---
// POST   /api/admin/bookings/:id/manual-refund
router.post('/:id/manual-refund', adminBookingController.manualMarkRefunded);

// POST   /api/admin/bookings/:id/retry-refund
router.post('/:id/retry-refund', adminBookingController.retryStripeRefund);
// --- [END NEW] ---

// PUT    /api/admin/bookings/:id/passengers
// (Used by the Manifest Editor)
router.put('/:id/passengers', adminBookingController.updateBookingPassengers);

// === Manual Admin Actions ===

// PUT    /api/admin/bookings/:id/manual-confirm
router.put('/:id/manual-confirm', adminBookingController.manualConfirmBooking);

// PUT    /api/admin/bookings/:id/manual-pay
router.put('/:id/manual-pay', adminBookingController.manualMarkAsPaid);

// --- [FIX] Removed the duplicate/broken manual-cancel route ---

// --- Admin Notes ---
// PUT    /api/admin/bookings/:id/notes
router.put('/:id/notes', adminBookingController.updateAdminNotes);

export default router;