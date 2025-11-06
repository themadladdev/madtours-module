// ==========================================
// UPDATED FILE
// client/src/services/admin/adminBookingService.js
// ==========================================

import adminApiFetch from '../adminApiFetch.js';

// All routes in this service are prefixed with /admin/bookings
const API_PREFIX = '/admin/bookings';

export const getAllBookings = async (filters = {}) => {
  // --- [MODIFIED] Pass all filters directly ---
  const params = new URLSearchParams();
  
  // Clean up filters to avoid sending empty strings
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.append(key, value);
    }
  });

  return await adminApiFetch(`${API_PREFIX}?${params.toString()}`);
};

export const getBookingById = async (id) => {
  return await adminApiFetch(`${API_PREFIX}/${id}`);
};

/**
 * Used by Triage/Refund flow.
 * This is tied to the refund endpoint and implies a financial action.
 */
export const cancelBooking = async (id, reason) => {
  return await adminApiFetch(`${API_PREFIX}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

export const refundBooking = async (id, amount, reason) => {
  return await adminApiFetch(`${API_PREFIX}/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason })
  });
};

export const getDashboardStats = async () => {
  return await adminApiFetch(`${API_PREFIX}/dashboard/stats`);
};

export const updateBookingPassengers = async (bookingId, passengers) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/passengers`, {
    method: 'PUT',
    body: JSON.stringify({ passengers })
  });
};

// --- [FUNCTIONS FOR MANUAL ADMIN ACTIONS] ---

/**
 * Manually confirms a booking (e.g., phone booking).
 * Sets status = 'confirmed'. Does NOT affect payment_status.
 */
export const manualConfirmBooking = async (bookingId) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/manual-confirm`, {
    method: 'PUT',
    body: JSON.stringify({ reason: 'Manual admin confirmation' })
  });
};

/**
 * Manually marks a booking as paid (e.g., cash payment).
 * Sets payment_status = 'paid'. Does NOT affect status.
 */
export const manualMarkAsPaid = async (bookingId) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/manual-pay`, {
    method: 'PUT',
    body: JSON.stringify({ reason: 'Manual admin payment received' })
  });
};

/**
 * Manually cancels a 'pending' booking.
 * Sets status = 'cancelled' and DECREMENTS booked_seats.
 */
export const adminCancelBooking = async (bookingId, reason) => {
  if (!reason) {
    reason = 'Manual admin cancellation';
  }
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/manual-cancel`, {
    method: 'PUT',
    body: JSON.stringify({ reason })
  });
};
// --- [END NEW FUNCTIONS] ---