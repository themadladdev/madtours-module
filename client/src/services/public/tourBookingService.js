// client/src/services/public/tourBookingService.js
import publicApiFetch from '../publicApiFetch.js';

/**
 * Fetches all active tours.
 * Corresponds to: GET /api/tours
 */
export const getActiveTours = () => {
  return publicApiFetch('/tours');
};

/**
 * NEW: Fetches a single active tour by its ID.
 * Corresponds to: GET /api/tours/:id
 * @param {number} id - The ID of the tour.
 */
export const getTourById = (id) => {
  return publicApiFetch(`/tours/${id}`);
};

/**
 * Fetches available tour times for a given tour, month, and seat count.
 * Corresponds to: GET /api/tours/:id/availability
 * @param {number} tourId - The ID of the tour.
 * @param {string} month - The month to check (format YYYY-MM).
 * @param {number} seats - The number of seats required.
 */
export const getTourAvailability = (tourId, month, seats) => {
  return publicApiFetch(`/tours/${tourId}/availability?month=${month}&seats=${seats}`);
};

// --- NEW: Function to get pricing from the Ticket Library ---
/**
 * Fetches all available ticket prices for a tour. (DEPRECATED FOR WIDGET)
 * Corresponds to: GET /api/tours/:id/pricing
 * @param {number} tourId - The ID of the tour.
 */
export const getTourPricing = (tourId) => {
  return publicApiFetch(`/tours/${tourId}/pricing`);
};
// --- END NEW FUNCTION ---

/**
 * Creates a new booking. (OLD WIDGET)
 * This sends the "on-demand" data (tourId, date, time) instead of an instance ID.
 * Corresponds to: POST /api/tours/bookings
 * @param {object} bookingData - The booking details.
 */
export const createBooking = (bookingData) => {
  return publicApiFetch('/tours/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
};

// --- NEW: Function to create a booking from the TicketBookingWidget ---
/**
 * Creates a new, complex booking with passenger details. (NEW WIDGET)
 * Corresponds to: POST /api/tours/ticket-bookings
 * @param {object} bookingData - The complex booking details.
 * { tourId, date, time, customer: {...}, tickets: [...], passengers: [...] }
 */
export const createTicketBooking = (bookingData) => {
  return publicApiFetch('/tours/ticket-bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
};
// --- END NEW FUNCTION ---

/**
 * Fetches a booking by its 8-character reference.
 * Corresponds to: GET /api/tours/bookings/:reference
 * @param {string} reference - The booking reference.
 */
export const getBookingByReference = (reference) => {
  return publicApiFetch(`/tours/bookings/${reference}`);
};

/**
 * --- NEW: Get Resolved Pricing for a Specific Instance ---
 * Fetches the final, resolved prices (Rule + Exception) for one instance.
 * Corresponds to: GET /api/tours/:id/pricing/instance
 * @param {string} tourId - The ID of the tour
 * @param {string} date - The selected date (YYYY-MM-DD)
 * @param {string} time - The selected time (HH:MM:SS)
 */
// --- THIS IS THE FIX: Added 'export' ---
export const getResolvedInstancePricing = (tourId, date, time) => {
  const params = new URLSearchParams({ date, time }).toString();
  // We use the full HH:MM:SS time from the instance to match the DB
  return publicApiFetch(`/tours/${tourId}/pricing/instance?${params}`);
};


// --- [NEW] PAYMENT VERIFICATION FUNCTION ---
/**
 * Asks the server to verify a payment intent after a redirect.
 * This is the "pull" mechanism.
 * Corresponds to: POST /api/tours/bookings/verify-payment
 * @param {string} paymentIntentId - The 'pi_...' ID from the URL
 */
export const verifyBookingPayment = (paymentIntentId) => {
  return publicApiFetch('/tours/bookings/verify-payment', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId }),
  });
};
// --- [END NEW] ---