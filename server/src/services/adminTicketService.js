// server/src/services/adminTicketService.js
// Manages all database interactions for the Ticket Library.

import { pool } from '../db/db.js';
// --- NEW ---
// Import the helper function from tourService
import { findOrCreateInstance } from './tourService.js';
// --- END NEW ---

// --- 1. tour_tickets (Ticket Definitions) ---

export const getAllTicketDefinitions = async () => {
  const { rows } = await pool.query(
    'SELECT * FROM tour_tickets ORDER BY type, name'
  );
  return rows;
};

export const createTicketDefinition = async ({ name, type }) => {
  const { rows } = await pool.query(
    'INSERT INTO tour_tickets (name, type) VALUES ($1, $2) RETURNING *',
    [name, type]
  );
  return rows[0];
};

export const updateTicketDefinition = async (id, { name, type }) => {
  const { rows } = await pool.query(
    'UPDATE tour_tickets SET name = $1, type = $2 WHERE id = $3 RETURNING *',
    [name, type, id]
  );
  if (rows.length === 0) {
    throw new Error('Ticket definition not found');
  }
  return rows[0];
};

export const deleteTicketDefinition = async (id) => {
  // This will fail if the ticket is in use (e.g., in a recipe or pricing),
  // which is handled by the ON DELETE RESTRICT constraints.
  const { rowCount } = await pool.query(
    'DELETE FROM tour_tickets WHERE id = $1',
    [id]
  );
  if (rowCount === 0) {
    throw new Error('Ticket definition not found');
  }
  return { message: 'Ticket definition deleted' };
};

// --- 2. tour_tickets_combined (Combined Ticket Recipes) ---

export const getCombinedTicketRecipe = async (combinedTicketId) => {
  const { rows } = await pool.query(
    `SELECT 
       ttc.atomic_ticket_id, 
       ttc.quantity,
       tt.name AS atomic_ticket_name
     FROM tour_tickets_combined ttc
     JOIN tour_tickets tt ON ttc.atomic_ticket_id = tt.id
     WHERE ttc.combined_ticket_id = $1
     ORDER BY tt.name`,
    [combinedTicketId]
  );
  return rows;
};

export const setCombinedTicketRecipe = async (combinedTicketId, recipe) => {
  // This is a full overwrite. We run it in a transaction.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First, delete the old recipe
    await client.query(
      'DELETE FROM tour_tickets_combined WHERE combined_ticket_id = $1',
      [combinedTicketId]
    );

    // Second, insert all new recipe components
    // We use a loop here because batch inserts are complex to build dynamically
    for (const item of recipe) {
      if (!item.atomic_ticket_id || !item.quantity || item.quantity <= 0) {
        throw new Error('Invalid recipe item. Must have atomic_ticket_id and positive quantity.');
      }
      await client.query(
        'INSERT INTO tour_tickets_combined (combined_ticket_id, atomic_ticket_id, quantity) VALUES ($1, $2, $3)',
        [combinedTicketId, item.atomic_ticket_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    
    // Return the newly created recipe
    return getCombinedTicketRecipe(combinedTicketId);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// --- 3. tour_pricing (Tour-specific Pricing) ---

export const getPricingForTour = async (tourId) => {
  const { rows } = await pool.query(
    `SELECT 
       tp.ticket_id, 
       tp.price, 
       tt.name AS ticket_name,
       tt.type AS ticket_type
     FROM tour_pricing tp
     JOIN tour_tickets tt ON tp.ticket_id = tt.id
     WHERE tp.tour_id = $1
     ORDER BY tt.type, tt.name`,
    [tourId]
  );
  return rows;
};

export const setPricingForTour = async (tourId, pricing) => {
  // This is also a full overwrite, run in a transaction.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First, delete old pricing rules for this tour
    await client.query(
      'DELETE FROM tour_pricing WHERE tour_id = $1',
      [tourId]
    );

    // Second, insert all new pricing rules
    for (const rule of pricing) {
      // Don't add rules for 0 or negative prices, just skip them
      if (!rule.ticket_id || !rule.price || parseFloat(rule.price) <= 0) {
        continue;
      }
      await client.query(
        'INSERT INTO tour_pricing (tour_id, ticket_id, price) VALUES ($1, $2, $3)',
        [tourId, rule.ticket_id, rule.price]
      );
    }

    await client.query('COMMIT');
    
    // Return the newly created pricing rules
    return getPricingForTour(tourId);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// --- 4. tour_pricing_exceptions (NEW BATCH FUNCTION) ---

/**
 * Applies a "Macro" price adjustment as a batch of "Micro" exceptions.
 * This function iterates a date range, finds/creates all relevant
 * tour_instances, and UPSERTS their price into tour_pricing_exceptions.
 */
export const applyPriceExceptionBatch = async ({ tourId, ticketId, startDate, endDate, price }) => {
  console.log(`[Service] Starting batch-price-adjustment for Tour ${tourId}...`);
  const client = await pool.connect();
  let affected_instances_count = 0;

  try {
    await client.query('BEGIN');

    // --- Step 1: Get Tour Rules (Schedule and default capacity) ---
    // This logic is mirrored from batchCancelBlackout
    const tourRulesResult = await client.query(
      `SELECT 
         t.capacity AS default_capacity,
         ts.schedule_config
       FROM tours t
       JOIN tour_schedules ts ON t.id = ts.tour_id
       WHERE t.id = $1 AND ts.active = true
       LIMIT 1`,
      [tourId]
    );

    if (tourRulesResult.rows.length === 0) {
      throw new Error(`No active tour or schedule found for Tour ID ${tourId}.`);
    }

    const { default_capacity, schedule_config } = tourRulesResult.rows[0];

    // --- THIS IS THE FIX ---
    // The schedule_config object has a nested 'schedule' object.
    const scheduleRules = schedule_config.schedule;
    // --- END FIX ---

    if (!scheduleRules || !scheduleRules.times || !scheduleRules.days_of_week) {
      throw new Error(`Tour ${tourId} has invalid or missing schedule config.`);
    }

    // --- Step 2: Generate list of all virtual tours for this range ---
    const toursToPrice = [];
    const start = new Date(`${startDate}T00:00:00Z`); // Explicitly UTC
    const end = new Date(`${endDate}T00:00:00Z`);   // Explicitly UTC

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayOfWeek = d.getUTCDay(); // 0 = Sunday
      const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD

      // Check if this day is a scheduled day
      if (scheduleRules.days_of_week.includes(dayOfWeek)) {
        // Add all times for this day
        for (const time of scheduleRules.times) {
          toursToPrice.push({
            date: dateString,
            time: `${time}:00`
          });
        }
      }
    }
    
    if (toursToPrice.length === 0) {
       console.log(`[Service] No virtual tours scheduled in this range.`);
       // We can still commit, as no action is needed.
    }

    // --- Step 3: Loop virtual tours, find/create instance, upsert price ---
    console.log(`[Service] Found ${toursToPrice.length} virtual tours to price...`);
    
    for (const tour of toursToPrice) {
      const { date, time } = tour;
      
      // 1. Get the tour_instance_id (atomically)
      const instance = await findOrCreateInstance(client, {
        tourId: tourId,
        date: date,
        time: time,
        defaultCapacity: default_capacity
      });
      
      const instanceId = instance.id;

      // 2. UPSERT the price into tour_pricing_exceptions
      const priceResult = await client.query(
        `INSERT INTO tour_pricing_exceptions 
           (tour_instance_id, ticket_id, price)
         VALUES 
           ($1, $2, $3)
         ON CONFLICT (tour_instance_id, ticket_id)
         DO UPDATE SET
           price = $3,
           updated_at = NOW()
         RETURNING id`,
        [instanceId, ticketId, price]
      );
      
      if (priceResult.rows.length > 0) {
        affected_instances_count++;
      }
    }

    await client.query('COMMIT');
    console.log(`[Service] Batch-price-adjustment transaction committed.`);

    return {
      affected_instances: affected_instances_count,
      tour_id: tourId,
      ticket_id: ticketId,
      new_price: price,
      start_date: startDate,
      end_date: endDate
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Service] Error in applyPriceExceptionBatch:', error);
    throw new Error(`Failed to apply price adjustment: ${error.message}`);
  } finally {
    client.release();
  }
};