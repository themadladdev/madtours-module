// server/src/services/adminTicketService.js
// Manages all database interactions for the Ticket Library.

import { pool } from '../db/db.js';

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