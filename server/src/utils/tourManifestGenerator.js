// ==========================================
// UTILITIES: Manifest Generator
// server/src/utils/tourManifestGenerator.js
// ==========================================

import { pool } from '../db/db.js';

export const generateManifest = async (tourInstanceId) => {
  
  // --- [REFACTORED QUERY] ---
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
      
      -- Aggregate all CONFIRMED bookings for this instance
      json_agg(
        json_build_object(
          'booking_id', b.id,
          'booking_reference', b.booking_reference,
          'seats_total', b.seats,
          'special_requests', b.special_requests,
          'payment_status', b.payment_status,
          'seat_status', b.seat_status, -- Use new column
          
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
          
          'customer', json_build_object(
            'first_name', c.first_name,
            'last_name', c.last_name,
            'email', c.email,
            'phone', c.phone
          )
        ) ORDER BY b.created_at
      ) 
      -- Filter for 'seat_confirmed' ONLY. 
      -- 'triage' bookings are not on the manifest.
      --
      FILTER (WHERE b.seat_status = 'seat_confirmed') as confirmed_bookings 

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
  
  // --- [REFACTORED LOGIC] ---
  // The database now *only* returns confirmed bookings.
  const confirmedBookings = manifest.confirmed_bookings || [];
  
  // Calculate total seats from CONFIRMED bookings
  const totalSeats = confirmedBookings.reduce((sum, b) => sum + b.seats_total, 0);

  return {
    ...manifest,
    // 'bookings' is deprecated, just return 'confirmed_bookings'
    confirmed_bookings: confirmedBookings,
    total_confirmed_seats: totalSeats,
    available_seats: manifest.capacity - manifest.booked_seats
  };
};