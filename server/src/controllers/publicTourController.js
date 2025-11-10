// server/src/controllers/publicTourController.js
import * as tourService from '../services/tourService.js';
import * as bookingService from '../services/tourBookingService.js';
import * as stripeService from '../services/tourStripeService.js';
import * as availabilityCalculator from '../utils/tourAvailabilityCalculator.js';
// --- Import the sanitizer ---
import { sanitizeBookingData, sanitizeTicketBookingData } from '../utils/tourSanitize.js';

// --- Import public ticket service ---
import * as publicTicketService from '../services/publicTicketService.js';


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
 * --- NEW: Get a single tour by its ID ---
 * GET /api/tours/:id
 */
export const getTourById = async (req, res, next) => {
  try {
    const { id } = req.params;
    // We re-use the tourService function
    const tour = await tourService.getTourById(id); 

    if (!tour || !tour.active) {
      return res.status(404).json({ message: 'Tour not found or is not active' });
    }
    
    res.json(tour);
  } catch (error) {
    console.error(`Error fetching tour ${req.params.id}:`, error);
    next(error);
  }
};
// --- END NEW FUNCTION ---

/**
 * === NEW: Get all instances for a single day (for indicator widget) ===
 * GET /api/tours/:id/instances?date=YYYY-MM-DD
 */
export const getPublicTourInstances = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date query parameter (YYYY-MM-DD) is required' });
    }
    
    // Use the new public-safe calculator function
    const instances = await availabilityCalculator.getPublicInstancesForDate({
      tourId: parseInt(id, 10),
      date: date,
    });
    
    res.json(instances);
  } catch (error) {
    console.error('Error fetching public tour instances:', error);
    next(error);
  }
};
// === END NEW FUNCTION ===


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

    // --- FIX: Replaced STUB with correct call to the calculator ---
    const availability = await availabilityCalculator.getAvailableTimes({
      tourId: parseInt(id, 10),
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      seats: seatsRequired
    });
    // --- END FIX ---
    
    res.json(availability);
  } catch (error) {
    console.error('Error fetching tour availability:', error);
    next(error);
  }
};

// --- NEW: Get public pricing for a tour ---
/**
 * Get all available ticket prices for a tour
 * GET /api/tours/:id/pricing
 */
export const getTourPricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pricing = await publicTicketService.getPublicPricingForTour(parseInt(id, 10));
    res.json(pricing);
  } catch (error) {
    console.error(`Error fetching pricing for tour ${req.params.id}:`, error);
    next(error);
  }
};
// --- END NEW FUNCTION ---

// --- NEW: Get resolved pricing for a single instance ---
/**
 * Get the final, resolved ticket prices for a specific tour instance
 * GET /api/tours/:id/pricing/instance?date=...&time=...
 */
export const getResolvedInstancePricing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, time } = req.query;

    if (!id || !date || !time) {
      return res.status(400).json({ message: 'Tour ID, date, and time are required' });
    }

    const pricing = await publicTicketService.getResolvedInstancePricing({
      tourId: parseInt(id, 10),
      date,
      time
    });
    
    res.json(pricing);
  } catch (error) {
    console.error(`Error fetching resolved pricing for tour ${req.params.id}:`, error);
    next(error);
  }
};
// --- END NEW FUNCTION ---


/**
 * Create a new booking and payment intent using "Just-in-Time" logic
 * POST /api/tours/bookings
 */
export const createBooking = async (req, res, next) => {
  try {
    // === Sanitize data ===
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

    // === [FIX] Re-ordered flow to solve constraint violation ===
    
    // 1. Create PaymentIntent FIRST with minimal data
    const paymentIntent = await stripeService.createPaymentIntent(
      sanitizedData.totalAmount,
      {
        // Add minimal metadata for logging, in case booking fails
        customer_email: sanitizedData.email,
        tour_id: sanitizedData.tourId
      }
    );

    // 2. Create booking, passing in the new PaymentIntent ID
    const booking = await bookingService.createBooking(sanitizedData, paymentIntent.id);
    
    // 3. Update the PaymentIntent metadata with the new booking ID
    // This is critical for the webhook to find the booking
    await stripeService.updatePaymentIntentMetadata(paymentIntent.id, booking.id);

    // 4. Send the client secret back to the user
    res.status(201).json({
      booking: {
        id: booking.id,
        reference: booking.booking_reference,
        seat_status: booking.seat_status 
      },
      payment: {
        clientSecret: paymentIntent.client_secret
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

// --- UPDATED: Controller for the new TicketBookingWidget ---
/**
 * Create a new, complex booking with passenger details.
 * POST /api/tours/ticket-bookings
 */
export const createTicketBooking = async (req, res, next) => {
  try {
    // 1. Sanitize the complex data
    const sanitizedData = sanitizeTicketBookingData(req.body);

    // === [FIX] Re-ordered flow to solve constraint violation ===

    // 2. Create PaymentIntent FIRST with minimal data
    const paymentIntent = await stripeService.createPaymentIntent(
      sanitizedData.totalAmount,
      {
        customer_email: sanitizedData.customer.email,
        tour_id: sanitizedData.tourId,
        total_seats: sanitizedData.totalSeats
      }
    );

    // 3. Create booking, passing in the new PaymentIntent ID
    const booking = await bookingService.createTicketBooking(sanitizedData, paymentIntent.id);

    // 4. Update the PaymentIntent metadata with the new booking ID
    // This is critical for the webhook to find the booking
    await stripeService.updatePaymentIntentMetadata(paymentIntent.id, booking.id);
    
    // 5. Send the client secret back to the user
    res.status(201).json({
      booking: {
        id: booking.id,
        reference: booking.booking_reference,
        seat_status: booking.seat_status
      },
      payment: {
        clientSecret: paymentIntent.client_secret
      }
    });
    // --- END FIX ---

  } catch (error) {
    console.error('Error creating ticket booking:', error);
    if (error.message.includes('seats available') || error.message.includes('tour is no longer scheduled')) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};
// --- END UPDATED FUNCTION ---

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
    console.error('Webhook error:', error);
    // Send 400 status for webhook errors as per Stripe docs
    res.status(400).json({ message: error.message });
  }
};