// ==========================================
// SERVICES: Booking Admin Service
// client/src/services/admin/adminBookingService.js
// ==========================================

import adminApiFetch from '../adminApiFetch.js';

// All routes in this service are prefixed with /admin/bookings
const API_PREFIX = '/admin/bookings';

export const getAllBookings = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  // MODIFIED: Added prefix
  return await adminApiFetch(`${API_PREFIX}?${params}`);
};

export const getBookingById = async (id) => {
  // MODIFIED: Added prefix
  return await adminApiFetch(`${API_PREFIX}/${id}`);
};

export const cancelBooking = async (id, reason) => {
  // MODIFIED: Added prefix
  return await adminApiFetch(`${API_PREFIX}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

export const refundBooking = async (id, amount, reason) => {
  // MODIFIED: Added prefix
  return await adminApiFetch(`${API_PREFIX}/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason })
  });
};

export const getDashboardStats = async () => {
  // MODIFIED: Added prefix
  return await adminApiFetch(`${API_PREFIX}/dashboard/stats`);
};