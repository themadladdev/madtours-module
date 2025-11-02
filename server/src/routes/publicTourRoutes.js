// ==========================================
// ROUTES: Public Tour Booking
// server/src/routes/publicTourRoutes.js
// ==========================================

import express from 'express';
// **You must create 'tourPublicController.js' next**
import * as publicTourController from '../controllers/publicTourController.js'; 
import { bookingRateLimit } from '../middleware/tourBookingRateLimit.js';

const router = express.Router();

// === Tour Discovery ===
// GET    /api/tours
router.get('/', publicTourController.getActiveTours);

// === Availability Check ===
// GET    /api/tours/:id/availability
router.get('/:id/availability', publicTourController.getTourAvailability);

// === Booking Flow ===
// POST   /api/tours/bookings
router.post('/bookings', bookingRateLimit, publicTourController.createBooking);

// GET    /api/tours/bookings/:reference
router.get('/bookings/:reference', publicTourController.getBookingByReference);

export default router;