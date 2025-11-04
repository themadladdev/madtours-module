// server/src/services/publicTicketService.js
// Manages all PUBLIC database interactions for the Ticket Library.

import { pool } from '../db/db.js';

/**
 * Gets all available ticket prices for a single, active tour.
 * This is public-safe and only returns what's needed for the booking widget.
 * @param {number} tourId - The ID of the tour.
 * @returns {Promise<Array<object>>} - A list of pricing objects.
 */
export const getPublicPricingForTour = async (tourId) => {
  const { rows } = await pool.query(
    `SELECT 
       tp.ticket_id, 
       tp.price, 
       tt.name AS ticket_name,
       tt.type AS ticket_type,
       -- Fetch the recipe for combined tickets
       (
         SELECT json_agg(json_build_object(
           'atomic_ticket_id', ttc.atomic_ticket_id,
           'quantity', ttc.quantity
         ))
         FROM tour_tickets_combined ttc
         WHERE ttc.combined_ticket_id = tt.id
       ) AS recipe
     FROM tour_pricing tp
     JOIN tour_tickets tt ON tp.ticket_id = tt.id
     JOIN tours t ON tp.tour_id = t.id
     WHERE tp.tour_id = $1
       AND t.active = true -- Ensure the tour itself is active
     ORDER BY tt.type, tt.name`,
    [tourId]
  );
  return rows;
};