// server/src/routes/publicTourRoutes.js
import express from 'express';
import * as publicTourController from '../controllers/publicTourController.js'; 
import { bookingRateLimit } from '../middleware/tourBookingRateLimit.js';

const router = express.Router();

// === Tour Discovery ===
// GET    /api/tours
router.get('/', publicTourController.getActiveTours);

// === Booking Flow (Specific routes MUST come before dynamic :id) ===
// POST   /api/tours/bookings
router.post('/bookings', bookingRateLimit, publicTourController.createBooking);

// GET    /api/tours/bookings/:reference
router.get('/bookings/:reference', publicTourController.getBookingByReference);

// === Availability Check (Dynamic route) ===
// GET    /api/tours/:id/availability
router.get('/:id/availability', publicTourController.getTourAvailability);

// --- NEW: Tour Detail (Dynamic route) ---
// GET    /api/tours/:id
// This MUST be after /bookings to avoid "bookings" being treated as an :id
router.get('/:id', publicTourController.getTourById);
// --- END NEW ROUTE ---

export default router;