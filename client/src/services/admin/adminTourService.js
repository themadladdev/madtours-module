// client/src/services/admin/adminTourService.js
import adminApiFetch from '../adminApiFetch.js';

// All routes in this service are prefixed with /admin/tours
const API_PREFIX = '/admin/tours';

export const getAllTours = async (activeOnly = false) => {
  const query = activeOnly ? '?active=true' : '';
  return await adminApiFetch(`${API_PREFIX}${query}`);
};

export const getTourById = async (id) => {
  return await adminApiFetch(`${API_PREFIX}/${id}`);
};

export const createTour = async (tourData) => {
  return await adminApiFetch(API_PREFIX, {
    method: 'POST',
    body: JSON.stringify(tourData)
  });
};

export const updateTour = async (id, tourData) => {
  return await adminApiFetch(`${API_PREFIX}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(tourData)
  });
};

export const deleteTour = async (id) => {
  return await adminApiFetch(`${API_PREFIX}/${id}`, {
    method: 'DELETE'
  });
};

export const getSchedulesForTour = async (tourId) => {
  return await adminApiFetch(`${API_PREFIX}/${tourId}/schedules`);
};

export const createSchedule = async (tourId, scheduleConfig) => {
  return await adminApiFetch(`${API_PREFIX}/${tourId}/schedules`, {
    method: 'POST',
    body: JSON.stringify(scheduleConfig)
  });
};

export const updateSchedule = async (scheduleId, scheduleConfig) => {
  return await adminApiFetch(`${API_PREFIX}/schedules/${scheduleId}`, {
    method: 'PUT',
    body: JSON.stringify(scheduleConfig)
  });
};

export const generateInstances = async (scheduleId, startDate, endDate) => {
  return await adminApiFetch(`${API_PREFIX}/schedules/${scheduleId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ startDate, endDate })
  });
};

export const getTourInstances = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return await adminApiFetch(`${API_PREFIX}/instances?${params}`);
};

export const getManifest = async (instanceId) => {
  return await adminApiFetch(`${API_PREFIX}/instances/${instanceId}/manifest`);
};

// === NEW UNIFIED CANCELLATION FUNCTION ===
/**
 * Performs an "Operational Cancellation".
 * This cancels the tour and moves all affected bookings to a 'pending_triage'
 * queue for later, separate processing (refund/transfer).
 * @param {object} cancelData - { tourId, date, time, reason, capacity }
 */
export const operationalCancelInstance = async (cancelData) => {
  return await adminApiFetch(`${API_PREFIX}/instances/cancel-operationally`, {
    method: 'POST',
    body: JSON.stringify(cancelData)
  });
};
// === END NEW FUNCTION ===

// === NEW RE-INSTATEMENT FUNCTION ===
/**
 * Re-instates a previously cancelled tour.
 * This sets the tour back to 'scheduled' and re-confirms any
 * bookings that are still in the 'pending_triage' queue.
 * @param {object} reInstateData - { tourId, date, time }
 */
export const reInstateInstance = async (reInstateData) => {
  return await adminApiFetch(`${API_PREFIX}/instances/re-instate`, {
    method: 'POST',
    body: JSON.stringify(reInstateData)
  });
};
// === END NEW FUNCTION ===

// === NEW BATCH BLACKOUT/CANCELLATION FUNCTION ===
/**
 * Applies a blackout range to a tour.
 * This does two things:
 * 1. Updates the tour's schedule_config to prevent new bookings.
 * 2. Operationally cancels all existing 'scheduled' instances in that range.
 * @param {object} blackoutData - { tourId, startDate, endDate, reason }
 */
export const applyBlackout = async (blackoutData) => {
  console.log('[applyBlackout service] Sending blackout data:', blackoutData);
  return await adminApiFetch(`${API_PREFIX}/instances/batch-cancel-blackout`, {
    method: 'POST',
    body: JSON.stringify(blackoutData)
  });
};
// === END NEW FUNCTION ===