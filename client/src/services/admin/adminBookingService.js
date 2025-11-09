// ==========================================
// client/src/services/admin/adminBookingService.js
// ==========================================

import adminApiFetch from '../adminApiFetch.js';

// All routes in this service are prefixed with /admin/bookings
const API_PREFIX = '/admin/bookings';

export const getAllBookings = async (filters = {}) => {
  const params = new URLSearchParams();
  
  // --- [REFACTOR] ---
  // Ensure the UI passes 'seat_status' as the key
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
 * --- [NEW] ---
 * Creates a manual booking (Origin 2).
 * @param {object} bookingData - The full booking object (customer, passengers, etc.)
 */
export const createManualBooking = async (bookingData) => {
  return await adminApiFetch(`${API_PREFIX}/manual`, {
    method: 'POST',
    body: JSON.stringify(bookingData)
  });
};

/**
 * --- [NEW] ---
 * Creates a Free-of-Charge booking (Origin 3).
 * @param {object} bookingData - The full booking object (customer, passengers, etc.)
 * @param {string} reason - The reason for the FOC booking (for admin_notes)
 */
export const createFocBooking = async (bookingData, reason) => {
  const payload = {
    ...bookingData,
    adminNotes: reason // Pass the reason in the payload
  };
  return await adminApiFetch(`${API_PREFIX}/foc`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
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

/**
 * --- [REFACTORED] ---
 * This is the Triage action to process a refund for a paid booking.
 */
export const refundBooking = async (id, amount, reason) => {
  return await adminApiFetch(`${API_PREFIX}/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason })
  });
};

/**
 * --- [NEW] ---
 * Triage Action: Mark a manually-paid booking as manually-refunded.
 *
 */
export const manualMarkRefunded = async (bookingId, reason) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/manual-refund`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

/**
 * --- [NEW] ---
 * Triage Action: Retry a failed Stripe refund.
 *
 */
export const retryStripeRefund = async (bookingId) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/retry-refund`, {
    method: 'POST'
  });
};


export const getDashboardStats = async () => {
  // This route is now deprecated by getDirectionalDashboard
  return await adminApiFetch(`${API_PREFIX}/dashboard/stats`);
};

/**
 * --- [NEW] ---
 * Fetches all consolidated data for the new directional dashboard.
 * This replaces the old getDashboardStats()
 */
export const getDirectionalDashboard = async () => {
  // Note: This endpoint is in the tour controller, not bookings
  return await adminApiFetch('/admin/tours/dashboard');
};

export const updateBookingPassengers = async (bookingId, passengers) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/passengers`, {
    method: 'PUT',
    body: JSON.stringify({ passengers })
  });
};

// --- [FUNCTIONS FOR MANUAL ADMIN ACTIONS] ---

/**
 * Manually confirms a booking's seat.
 * Sets seat_status = 'seat_confirmed'.
 */
export const manualConfirmBooking = async (bookingId) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/manual-confirm`, {
    method: 'PUT',
    body: JSON.stringify({ reason: 'Manual admin confirmation' })
  });
};

/**
 * Manually marks a booking as paid (e.g., cash payment).
 * Sets payment_status = 'payment_manual_success'.
 */
export const manualMarkAsPaid = async (bookingId, reason) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/manual-pay`, {
    method: 'PUT',
    // --- [FIX] Pass the reason from the function argument ---
    body: JSON.stringify({ reason: reason || 'Manual admin payment received' })
  });
};

/**
 * Manually cancels a booking (e.g., unpaid manual booking).
 * Sets seat_status = 'cancelled' and DECREMENTS booked_seats.
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

/**
 * Updates the admin-only notes for a booking.
 */
export const updateAdminNotes = async (bookingId, adminNotes) => {
  return await adminApiFetch(`${API_PREFIX}/${bookingId}/notes`, {
    method: 'PUT',
    body: JSON.stringify({ adminNotes })
  });
};