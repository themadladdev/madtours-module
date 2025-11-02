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

// === NEW FUNCTION ===
/**
 * Gets all schedules for a specific tour.
 * Corresponds to: GET /api/admin/tours/:tourId/schedules
 */
export const getSchedulesForTour = async (tourId) => {
  return await adminApiFetch(`${API_PREFIX}/${tourId}/schedules`);
};

export const createSchedule = async (tourId, scheduleConfig) => {
  return await adminApiFetch(`${API_PREFIX}/${tourId}/schedules`, {
    method: 'POST',
    body: JSON.stringify(scheduleConfig)
  });
};

// === NEW FUNCTION ===
/**
 * Updates an existing schedule.
 * Corresponds to: PUT /api/admin/schedules/:id
 */
export const updateSchedule = async (scheduleId, scheduleConfig) => {
  // Note: This endpoint is not prefixed with /tours
  return await adminApiFetch(`/admin/schedules/${scheduleId}`, {
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

export const cancelTourInstance = async (instanceId, reason) => {
  return await adminApiFetch(`${API_PREFIX}/instances/${instanceId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

export const getManifest = async (instanceId) => {
  return await adminApiFetch(`${API_PREFIX}/instances/${instanceId}/manifest`);
};