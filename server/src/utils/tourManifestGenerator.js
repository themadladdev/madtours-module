// ==========================================
// UTILITIES: Manifest Generator
// server/src/utils/tourManifestGenerator.js
// ==========================================

import { pool } from '../db/db.js';

export const generateManifest = async (tourInstanceId) => {
  // --- REFACTORED MANIFEST QUERY ---
  // This query is now more complex. It first gets the instance and tour details.
  // Then, it aggregates bookings, and *within* each booking, it aggregates
  // the passenger list (from the new table) OR falls back to the customer name.
  
  const result = await pool.query(
    `SELECT 
      ti.id,
      ti.date,
      ti.time,
      ti.capacity,
      ti.booked_seats,
      t.name as tour_name,
      t.duration_minutes,
      t.description,
      
      -- Aggregate all bookings for this instance
      json_agg(
        json_build_object(
          'booking_id', b.id,
          'booking_reference', b.booking_reference,
          'seats_total', b.seats,
          'special_requests', b.special_requests,
          'payment_status', b.payment_status,
          'booking_status', b.status,
          
          -- NEW: Passenger List Sub-query
          -- This finds all passengers in tour_booking_passengers
          'passengers', (
            SELECT json_agg(
              json_build_object(
                'first_name', p.first_name,
                'last_name', p.last_name,
                'ticket_type', p.ticket_type
              )
            )
            FROM tour_booking_passengers p
            WHERE p.booking_id = b.id
          ),
          
          -- FALLBACK: Get the primary customer (payer) details
          'customer', json_build_object(
            'first_name', c.first_name,
            'last_name', c.last_name,
            'email', c.email,
            'phone', c.phone
          )
        ) ORDER BY b.created_at
      ) FILTER (WHERE b.status IN ('confirmed', 'pending_triage')) as bookings 
      -- We now also include 'pending_triage' in the main manifest
      -- so the captain knows about unresolved cancellations.

    FROM tour_instances ti
    JOIN tours t ON ti.tour_id = t.id
    LEFT JOIN tour_bookings b ON ti.id = b.tour_instance_id
    LEFT JOIN tour_customers c ON b.customer_id = c.id
    WHERE ti.id = $1
    GROUP BY ti.id, t.id`,
    [tourInstanceId]
  );
  // --- END REFACTORED QUERY ---

  if (result.rows.length === 0) {
    throw new Error('Tour instance not found');
  }

  const manifest = result.rows[0];
  
  // --- NEW: Process bookings to use new structure ---
  const allBookings = manifest.bookings || [];
  
  const confirmedBookings = allBookings.filter(b => b.booking_status === 'confirmed');
  
  // Calculate total seats from CONFIRMED bookings only
  const totalSeats = confirmedBookings.reduce((sum, b) => sum + b.seats_total, 0);

  return {
    ...manifest,
    bookings: allBookings, // All confirmed AND pending_triage
    confirmed_bookings: confirmedBookings,
    total_confirmed_seats: totalSeats,
    available_seats: manifest.capacity - manifest.booked_seats
  };
};