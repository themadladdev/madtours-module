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

/**
 * --- NEW: Get Resolved Pricing for a Specific Instance ---
 *
 * Gets the final, resolved price for a specific tour instance (virtual or real)
 * by checking all 3 tiers of our pricing model.
 *
 * Tier 3: "Micro" Exception (tour_pricing_exceptions)
 * Tier 2: "Macro" Exception (tour_pricing_exceptions)
 * Tier 1: "Default Rule" (tour_pricing)
 *
 * @param {object} data - { tourId, date, time }
 * @returns {Promise<Array<object>>} - A list of final pricing objects.
 */
export const getResolvedInstancePricing = async ({ tourId, date, time }) => {
  // 1. Find the instance ID if an exception row exists.
  // We use a subquery for this. It will be NULL if the instance is virtual.
  // 2. We LEFT JOIN the rules to the exceptions.
  // 3. We use COALESCE to pick the exception price if it exists,
  //    otherwise we fall back to the rule price.
  
  const query = `
    WITH instance AS (
      SELECT id 
      FROM tour_instances
      WHERE tour_id = $1 AND date = $2 AND "time" = $3
    )
    SELECT 
      tp.ticket_id,
      tt.name AS ticket_name,
      tt.type AS ticket_type,
      
      -- The 3-Tier Price Resolution:
      -- Tier 3/2: Check for an exception price
      -- Tier 1:   Fall back to the default rule price
      COALESCE(tpe.price, tp.price) AS price,
      
      -- Include the recipe for combined tickets
      (
        SELECT json_agg(json_build_object(
          'atomic_ticket_id', ttc.atomic_ticket_id,
          'quantity', ttc.quantity
        ))
        FROM tour_tickets_combined ttc
        WHERE ttc.combined_ticket_id = tt.id
      ) AS recipe
      
    FROM tour_pricing tp
    
    JOIN tour_tickets tt 
      ON tp.ticket_id = tt.id
      
    LEFT JOIN tour_pricing_exceptions tpe 
      ON tpe.ticket_id = tp.ticket_id
      AND tpe.tour_instance_id = (SELECT id FROM instance)
      
    WHERE tp.tour_id = $1;
  `;

  try {
    const { rows } = await pool.query(query, [tourId, date, time]);
    
    if (rows.length === 0) {
      // This means the tour has no "Default Rule" prices set up at all.
      console.warn(`[Service] No default pricing rules found for tourId ${tourId}.`);
    }
    
    return rows;
  } catch (error) {
    console.error('Error in getResolvedInstancePricing:', error);
    throw new Error('Error fetching prices for this tour.');
  }
};