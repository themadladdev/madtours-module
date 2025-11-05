// client/src/services/admin/adminTicketService.js
// Frontend service to interact with the admin ticket library API.

import adminApiFetch from '../adminApiFetch.js';

// === 1. Ticket Definitions (tour_tickets) ===

export const getAllTicketDefinitions = async () => {
  return adminApiFetch('/admin/tickets/definitions');
};

export const createTicketDefinition = async (data) => {
  // data = { name: '...', type: '...' }
  return adminApiFetch('/admin/tickets/definitions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateTicketDefinition = async (id, data) => {
  // data = { name: '...', type: '...' }
  return adminApiFetch(`/admin/tickets/definitions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteTicketDefinition = async (id) => {
  return adminApiFetch(`/admin/tickets/definitions/${id}`, {
    method: 'DELETE',
  });
};

// === 2. Combined Ticket Recipes (tour_tickets_combined) ===

export const getCombinedTicketRecipe = async (combinedTicketId) => {
  return adminApiFetch(`/admin/tickets/definitions/${combinedTicketId}/recipe`);
};

export const setCombinedTicketRecipe = async (combinedTicketId, recipe) => {
  // recipe = [{ atomic_ticket_id: 1, quantity: 2 }, ...]
  return adminApiFetch(`/admin/tickets/definitions/${combinedTicketId}/recipe`, {
    method: 'POST',
    body: JSON.stringify({ recipe }),
  });
};

// === 3. Tour Pricing (tour_pricing) ===

export const getPricingForTour = async (tourId) => {
  return adminApiFetch(`/admin/tickets/pricing/tour/${tourId}`);
};

export const setPricingForTour = async (tourId, pricing) => {
  // pricing = [{ ticket_id: 1, price: 100.00 }, ...]
  return adminApiFetch(`/admin/tickets/pricing/tour/${tourId}`, {
    method: 'POST',
    body: JSON.stringify({ pricing }),
  });
};

// === 4. Pricing Exceptions (tour_pricing_exceptions) ===

/**
 * Applies a "Macro" price adjustment as a batch of "Micro" exceptions.
 * The backend will iterate the date range, find-or-create all
 * relevant tour_instances, and UPSERT rows into tour_pricing_exceptions.
 * * @param {object} adjustmentData
 * @param {number} adjustmentData.tourId
 * @param {number} adjustmentData.ticketId
 * @param {string} adjustmentData.startDate
 * @param {string} adjustmentData.endDate
 * @param {number} adjustmentData.price
 * @returns {Promise<object>}
 */
export const applyPriceExceptionBatch = async (adjustmentData) => {
  return adminApiFetch('/admin/tickets/exceptions/batch-apply', {
    method: 'POST',
    body: JSON.stringify(adjustmentData),
  });
};

/**
 * --- NEW: MICRO PRICING ---
 * Gets the complete, resolved pricing for a single instance.
 * Backend finds/creates the instance and returns all "Rule" prices
 * merged with any "Exception" prices.
 * @param {object} instanceData - { tourId, date, time, capacity }
 * @returns {Promise<Array>} Array of price objects
 */
export const getInstancePricing = async ({ tourId, date, time, capacity }) => {
  const params = new URLSearchParams({ tourId, date, time, capacity }).toString();
  return adminApiFetch(`/admin/tickets/exceptions/instance-prices?${params}`);
};

/**
 * --- NEW: MICRO PRICING ---
 * Sets the "Micro" price exceptions for a single instance.
 * @param {object} pricingData
 * @param {number} pricingData.tourId
 * @param {string} pricingData.date
 * @param {string} pricingData.time
 * @param {number} pricingData.capacity
 * @param {Array} pricingData.prices - [{ ticket_id: 1, price: 150.00 }, ...]
 * @returns {Promise<object>}
 */
export const setInstancePricing = async (pricingData) => {
  return adminApiFetch('/admin/tickets/exceptions/instance-prices', {
    method: 'POST',
    body: JSON.stringify(pricingData),
  });
};