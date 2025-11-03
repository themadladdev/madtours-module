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

/**
 * Creates a new booking.
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

/**
 * Fetches a booking by its 8-character reference.
 * Corresponds to: GET /api/tours/bookings/:reference
 * @param {string} reference - The booking reference.
 */
export const getBookingByReference = (reference) => {
  return publicApiFetch(`/tours/bookings/${reference}`);
};