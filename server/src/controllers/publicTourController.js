// ==========================================
// CONTROLLERS: Public Tour Controller
// server/src/controllers/publicTourController.js
// ==========================================

import * as tourService from '../services/tourService.js';
import * as bookingService from '../services/tourBookingService.js';
import * as stripeService from '../services/tourStripeService.js';
import * as availabilityCalculator from '../utils/tourAvailabilityCalculator.js';
import { sanitizeBookingData } from '../utils/tourSanitize.js';

/**
 * Get all active tours
 * GET /api/tours
 */
export const getActiveTours = async (req, res, next) => {
  try {
    const tours = await tourService.getAllTours(true); // true = activeOnly
    res.json(tours);
  } catch (error) {
    console.error('Error fetching active tours:', error);
    next(error);
  }
};

/**
 * Get available times for a tour based on on-demand rules
 * GET /api/tours/:id/availability?month=YYYY-MM&seats=N
 */
export const getTourAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month, seats } = req.query;

    if (!month) {
      return res.status(400).json({ message: 'Month query parameter (YYYY-MM) is required' });
    }

    const seatsRequired = parseInt(seats) || 1;
    
    // Calculate start and end dates for the given month
    // Dates must be in UTC to match database logic
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    // Get the last day of the month by going to the next month and subtracting 1 day
    const endDate = new Date(startDate.getFullYear(), startDate.getUTCMonth() + 1, 0);

    const availability = await availabilityCalculator.getAvailableTimes({
      tourId: parseInt(id),
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      seats: seatsRequired
    });
    
    res.json(availability);
  } catch (error) {
    console.error('Error fetching tour availability:', error);
    next(error);
  }
};

/**
 * Create a new booking and payment intent using "Just-in-Time" logic
 * POST /api/tours/bookings
 */
export const createBooking = async (req, res, next) => {
  try {
    // === REFACTORED: Sanitize new "on-demand" fields ===
    const sanitizedData = sanitizeBookingData({
      tourId: req.body.tourId,
      date: req.body.date,
      time: req.body.time,
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      seats: req.body.seats,
      totalAmount: req.body.totalAmount,
      specialRequests: req.body.specialRequests
    });

    // === REFACTORED: Pass new fields to the booking service ===
    const bookingData = {
      tour_id: sanitizedData.tourId,
      date: sanitizedData.date,
      time: sanitizedData.time,
      email: sanitizedData.email,
      first_name: sanitizedData.firstName,
      last_name: sanitizedData.lastName,
      phone: sanitizedData.phone,
      seats: sanitizedData.seats,
      total_amount: sanitizedData.totalAmount,
      special_requests: sanitizedData.specialRequests
    };

    const booking = await bookingService.createBooking(bookingData);
    const paymentIntent = await stripeService.createPaymentIntent(booking);

    res.status(201).json({
      booking: {
        id: booking.id,
        reference: booking.booking_reference,
        status: booking.status
      },
      payment: {
        clientSecret: paymentIntent.clientSecret
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    // Send specific error message for availability issues
    if (error.message.includes('seats available') || error.message.includes('tour is no longer scheduled')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Get booking details by reference
 * GET /api/tours/bookings/:reference
 */
export const getBookingByReference = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const booking = await bookingService.getBookingByReference(reference.toUpperCase());
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error(`Error fetching booking ${req.params.reference}:`, error);
    next(error);
  }
};

/**
 * Handle incoming Stripe webhooks
 * POST /api/webhooks/stripe
 */
export const handleStripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  
  // Use req.rawBody provided by the server.js middleware
  const rawBody = req.rawBody; 

  try {
    await stripeService.handleWebhook(rawBody, sig);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    next(error);
  }
};