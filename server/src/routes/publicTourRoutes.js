// server/src/routes/publicTourRoutes.js
import express from 'express';
import * as publicTourController from '../controllers/publicTourController.js'; 
import { bookingRateLimit } from '../middleware/tourBookingRateLimit.js';

const router = express.Router();

// === Tour Discovery ===
// GET    /api/tours
router.get('/', publicTourController.getActiveTours);

// === Booking Flow (Specific routes MUST come before dynamic :id) ===

// --- OLD BOOKING ROUTE (for AvailabilityBookingWidget) ---
// POST   /api/tours/bookings
router.post('/bookings', bookingRateLimit, publicTourController.createBooking);

// --- NEW BOOKING ROUTE (for TicketBookingWidget) ---
// POST   /api/tours/ticket-bookings
router.post('/ticket-bookings', bookingRateLimit, publicTourController.createTicketBooking);
// --- END NEW ROUTE ---

// --- [NEW] PAYMENT VERIFICATION ROUTE ---
// POST   /api/tours/bookings/verify-payment
router.post('/bookings/verify-payment', publicTourController.verifyPayment);
// --- [END NEW] ---

// GET    /api/tours/bookings/:reference
router.get('/bookings/:reference', publicTourController.getBookingByReference);

// === NEW: Get Resolved Instance Pricing (MUST be before /:id/pricing) ===
// GET    /api/tours/:id/pricing/instance?date=...&time=...
router.get('/:id/pricing/instance', publicTourController.getResolvedInstancePricing);
// === END NEW ROUTE ===

// === Public Pricing (Dynamic route) ===
// GET    /api/tGours/:id/pricing
router.get('/:id/pricing', publicTourController.getTourPricing);

// === NEW: Availability Indicator (Dynamic route) ===
// GET /api/tours/:id/instances?date=YYYY-MM-DD
router.get('/:id/instances', publicTourController.getPublicTourInstances);
// === END NEW ROUTE ===

// === Availability Check (Dynamic route) ===
// GET    /api/tours/:id/availability
router.get('/:id/availability', publicTourController.getTourAvailability);

// --- NEW: Tour Detail (Dynamic route) ---
// GET    /api/tours/:id
// This MUST be after /bookings to avoid "bookings" being treated as an :id
router.get('/:id', publicTourController.getTourById);
// --- END NEW ROUTE ---

export default router;