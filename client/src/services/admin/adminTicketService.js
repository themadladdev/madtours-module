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